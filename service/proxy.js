/* jshint node: true, undef: true, unused: true, strict: true, esversion: 5 */
/* global Buffer */
'use strict';

var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');
var zlib = require('zlib');

var server = null;
var PROXY_PORT = 3001;
var FALLBACK_PORT = 3000;
var activeListenPort = PROXY_PORT;
var BACKUP_FILE_PATH = '/tmp/smartstb_backup.json';
var endpointCache = {};
var cookieJar = {};
var lastPortalReferer = '';
var memoryBackupJson = '';
var activeVideoUpReq = null;
var MAG_UA = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

if (http.globalAgent) {
    http.globalAgent.maxSockets = 64;
}
if (https.globalAgent) {
    https.globalAgent.maxSockets = 64;
}

// Persistent Keep-Alive agents with high socket concurrency so 4K streams never block API requests
var httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 3000, maxSockets: 64, maxFreeSockets: 8 });
var httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 3000, maxSockets: 64, maxFreeSockets: 8, rejectUnauthorized: false });

function allocBufferUtf8(str) {
    var text = String(str || '');
    if (typeof Buffer.from === 'function') {
        return Buffer.from(text, 'utf8');
    }
    return new Buffer(text, 'utf8');
}

function safeDecodeURIComponent(str) {
    if (!str) {
        return '';
    }
    try {
        return decodeURIComponent(String(str));
    } catch (e) {
        return String(str);
    }
}

function extendHeaders(baseObj, extraObj) {
    var out = {};
    var k;
    if (baseObj) {
        for (k in baseObj) {
            if (Object.prototype.hasOwnProperty.call(baseObj, k)) {
                out[k] = baseObj[k];
            }
        }
    }
    if (extraObj) {
        for (k in extraObj) {
            if (Object.prototype.hasOwnProperty.call(extraObj, k)) {
                out[k] = extraObj[k];
            }
        }
    }
    return out;
}

function storeSetCookies(hostname, setCookieHeaders) {
    if (!hostname || !setCookieHeaders) {
        return;
    }
    if (!cookieJar[hostname]) {
        cookieJar[hostname] = {};
    }
    var list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (var i = 0; i < list.length; i++) {
        var raw = String(list[i] || '');
        var firstPart = raw.split(';')[0] || '';
        var eqIdx = firstPart.indexOf('=');
        if (eqIdx > 0) {
            var name = firstPart.substring(0, eqIdx).trim();
            var val = firstPart.substring(eqIdx + 1).trim();
            if (name) {
                cookieJar[hostname][name] = val;
            }
        }
    }
}

function getHostCookieHeader(hostname, baseCookie) {
    var jarCookies = cookieJar[hostname] || {};
    var pairs = [];
    if (baseCookie) {
        pairs.push(baseCookie);
    }
    var keys = Object.keys(jarCookies);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!baseCookie || baseCookie.indexOf(k + '=') === -1) {
            pairs.push(k + '=' + jarCookies[k]);
        }
    }
    return pairs.join('; ');
}

function decodeBufferByEncoding(rawBuf, encoding, callback) {
    var enc = String(encoding || '').toLowerCase();
    if (enc.indexOf('gzip') !== -1) {
        zlib.gunzip(rawBuf, function(err, decoded) {
            callback(err ? rawBuf : decoded);
        });
    } else if (enc.indexOf('deflate') !== -1) {
        zlib.inflate(rawBuf, function(err, decoded) {
            if (!err && decoded) {
                callback(decoded);
            } else {
                zlib.inflateRaw(rawBuf, function(err2, decoded2) {
                    callback(err2 ? rawBuf : decoded2);
                });
            }
        });
    } else {
        callback(rawBuf);
    }
}

function normalizePortalKey(rawPortal) {
    return (rawPortal || '').trim().replace(/\/+$/, '').toLowerCase();
}

function getCandidateUrls(rawPortal, search) {
    var clean = (rawPortal || '').trim().replace(/\/+$/, '');
    if (clean.indexOf('http://') !== 0 && clean.indexOf('https://') !== 0) {
        clean = 'http://' + clean;
    }
    var qs = search || '';
    if (qs && qs.charAt(0) !== '?') {
        qs = '?' + qs.replace(/^\/+/, '');
    }
    var portalKey = normalizePortalKey(rawPortal);
    var list = [];
    if (clean.indexOf('.php') !== -1) {
        list.push(clean + qs);
        return list;
    }
    var base = clean
        .replace(/\/stalker_portal\/c$/i, '')
        .replace(/\/stalker_portal$/i, '')
        .replace(/\/c$/i, '');
    var defaults = [
        base + '/portal.php',
        base + '/stalker_portal/server/load.php',
        base + '/server/load.php'
    ];
    var cachedBaseEndpoint = endpointCache[portalKey];
    if (cachedBaseEndpoint) {
        list.push(cachedBaseEndpoint + qs);
        if (qs.indexOf('action=handshake') === -1) {
            return list;
        }
    }
    for (var i = 0; i < defaults.length; i++) {
        if (defaults[i] !== cachedBaseEndpoint) {
            list.push(defaults[i] + qs);
        }
    }
    return list;
}

function extractBaseEndpoint(candidateUrl) {
    var qIdx = candidateUrl.indexOf('?');
    if (qIdx !== -1) {
        return candidateUrl.slice(0, qIdx);
    }
    return candidateUrl;
}

function getReferer(rawPortal) {
    var clean = (rawPortal || '').trim().replace(/\/+$/, '');
    if (clean.indexOf('http://') !== 0 && clean.indexOf('https://') !== 0) {
        clean = 'http://' + clean;
    }
    var base = clean.replace(/\/(portal|load)\.php.*$/i, '').replace(/\/server$/i, '');
    if (base.slice(-2) !== '/c') {
        base += '/c/';
    } else {
        base += '/';
    }
    return base;
}

function requestWithFallback(reqState, callback) {
    var portalKey = reqState.portalKey;
    var candidates = reqState.candidates;
    var idx = reqState.idx || 0;
    var headers = reqState.headers;
    var redirectsLeft = typeof reqState.redirectsLeft === 'number' ? reqState.redirectsLeft : 3;
    var useFreshSocket = Boolean(reqState.useFreshSocket);

    if (idx >= candidates.length) {
        callback(new Error('All portal endpoints returned empty/invalid JSON'));
        return;
    }
    var currentUrl = candidates[idx];
    var target = url.parse(currentUrl);
    var isHttps = target.protocol === 'https:';
    var client = isHttps ? https : http;
    var mergedCookie = getHostCookieHeader(target.hostname, headers.Cookie || '');
    var reqHeaders = extendHeaders(headers, {
        Host: target.host,
        Cookie: mergedCookie,
        Connection: useFreshSocket ? 'close' : 'keep-alive'
    });
    var options = {
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: target.path,
        method: 'GET',
        headers: reqHeaders,
        agent: useFreshSocket ? false : (isHttps ? httpsAgent : httpAgent),
        rejectUnauthorized: false,
        timeout: 12000
    };
    var settled = false;
    function retryOrNextCandidate() {
        if (settled) {
            return;
        }
        settled = true;
        if (!useFreshSocket) {
            requestWithFallback({
                portalKey: portalKey,
                candidates: candidates,
                idx: idx,
                headers: headers,
                redirectsLeft: redirectsLeft,
                useFreshSocket: true
            }, callback);
            return;
        }
        requestWithFallback({
            portalKey: portalKey,
            candidates: candidates,
            idx: idx + 1,
            headers: headers,
            redirectsLeft: 3,
            useFreshSocket: false
        }, callback);
    }
    var proxyReq = client.request(options, function(proxyRes) {
        storeSetCookies(target.hostname, proxyRes.headers['set-cookie']);
        var status = proxyRes.statusCode;
        if ((status === 301 || status === 302 || status === 303 || status === 307 || status === 308) &&
            proxyRes.headers.location && redirectsLeft > 0) {
            if (settled) {
                return;
            }
            settled = true;
            proxyRes.resume();
            var nextUrl = url.resolve(currentUrl, proxyRes.headers.location);
            var redirectedList = candidates.slice();
            redirectedList[idx] = nextUrl;
            requestWithFallback({
                portalKey: portalKey,
                candidates: redirectedList,
                idx: idx,
                headers: headers,
                redirectsLeft: redirectsLeft - 1,
                useFreshSocket: useFreshSocket
            }, callback);
            return;
        }
        var chunks = [];
        proxyRes.on('data', function(chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : allocBufferUtf8(chunk));
        });
        proxyRes.on('end', function() {
            if (settled) {
                return;
            }
            var rawBuf = Buffer.concat(chunks);
            decodeBufferByEncoding(rawBuf, proxyRes.headers['content-encoding'], function(decodedBuf) {
                if (settled) {
                    return;
                }
                var body = (decodedBuf || rawBuf).toString('utf8');
                var trimmed = (body || '').trim();
                var isEpgOrWatchdog = currentUrl.indexOf('get_short_epg') !== -1 ||
                                      currentUrl.indexOf('get_epg_info') !== -1 ||
                                      currentUrl.indexOf('type=watchdog') !== -1;
                if (status >= 200 && status < 300 && trimmed.length > 0) {
                    if (/authorization\s+failed/i.test(trimmed)) {
                        settled = true;
                        callback(null, JSON.stringify({ error: 'AUTH_FAILED', message: 'Authorization failed' }));
                        return;
                    }
                    try {
                        JSON.parse(trimmed);
                        settled = true;
                        if (portalKey) {
                            endpointCache[portalKey] = extractBaseEndpoint(currentUrl);
                        }
                        callback(null, trimmed);
                        return;
                    } catch (ex) {}
                }
                if (isEpgOrWatchdog) {
                    settled = true;
                    callback(null, JSON.stringify({ js: [] }));
                    return;
                }
                retryOrNextCandidate();
            });
        });
    });
    proxyReq.on('error', function() {
        retryOrNextCandidate();
    });
    proxyReq.on('timeout', function() {
        proxyReq.abort();
        retryOrNextCandidate();
    });
    proxyReq.end();
}

function rewriteManifestTagUri(line, baseStreamUrl) {
    var proxyBase = 'http://127.0.0.1:' + activeListenPort + '/stream?url=';
    return line.replace(/URI="([^"]+)"/gi, function(match, uriVal) {
        var absUri = url.resolve(baseStreamUrl, uriVal);
        return 'URI="' + proxyBase + encodeURIComponent(absUri) + '"';
    });
}

function rewriteM3u8Manifest(manifestText, baseStreamUrl) {
    var proxyBase = 'http://127.0.0.1:' + activeListenPort + '/stream?url=';
    var lines = String(manifestText || '').split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmed = line.trim();
        if (!trimmed) {
            out.push(line);
            continue;
        }
        if (trimmed.charAt(0) === '#') {
            out.push(rewriteManifestTagUri(line, baseStreamUrl));
            continue;
        }
        var absSegmentUrl = url.resolve(baseStreamUrl, trimmed);
        out.push(proxyBase + encodeURIComponent(absSegmentUrl));
    }
    return out.join('\n');
}

function proxyVideoStream(streamUrl, clientReq, clientRes, redirectsLeft) {
    if (redirectsLeft <= 0) {
        clientRes.writeHead(502);
        clientRes.end();
        return;
    }
    var target = url.parse(streamUrl);
    if (!target.hostname) {
        clientRes.writeHead(400);
        clientRes.end('Invalid stream URL');
        return;
    }
    var isHttps = target.protocol === 'https:';
    var client = isHttps ? https : http;
    var mergedCookie = getHostCookieHeader(target.hostname, '');
    var headers = {
        'User-Agent': MAG_UA,
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Host': target.host
    };
    if (mergedCookie) {
        headers.Cookie = mergedCookie;
    }
    if (lastPortalReferer) {
        headers.Referer = lastPortalReferer;
    }
    if (clientReq.headers.range) {
        headers.Range = clientReq.headers.range;
    }
    var isSegmentOrSubRequest = /\.ts(\?|$)|\.m4s(\?|$)|\.aac(\?|$)|\.vtt(\?|$)/i.test(target.path || '');
    if (!isSegmentOrSubRequest && activeVideoUpReq) {
        try {
            activeVideoUpReq.abort();
        } catch (eAbort) {}
        activeVideoUpReq = null;
    }
    var upReq = client.request({
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: target.path,
        method: 'GET',
        headers: headers,
        rejectUnauthorized: false
    }, function(upRes) {
        if (!isSegmentOrSubRequest) {
            activeVideoUpReq = upReq;
        }
        storeSetCookies(target.hostname, upRes.headers['set-cookie']);
        if ([301, 302, 303, 307, 308].indexOf(upRes.statusCode) !== -1 && upRes.headers.location) {
            upRes.resume();
            proxyVideoStream(url.resolve(streamUrl, upRes.headers.location), clientReq, clientRes, redirectsLeft - 1);
            return;
        }
        var contentType = String(upRes.headers['content-type'] || '').toLowerCase();
        var isM3u8 = contentType.indexOf('mpegurl') !== -1 ||
                     contentType.indexOf('m3u') !== -1 ||
                     /\.m3u8(\?|$)/i.test(target.path || '');

        if (isM3u8 && (upRes.statusCode === 200 || upRes.statusCode === 206)) {
            var m3u8Chunks = [];
            upRes.on('data', function(chunk) {
                m3u8Chunks.push(Buffer.isBuffer(chunk) ? chunk : allocBufferUtf8(chunk));
            });
            upRes.on('end', function() {
                var rawBuf = Buffer.concat(m3u8Chunks);
                decodeBufferByEncoding(rawBuf, upRes.headers['content-encoding'], function(decodedBuf) {
                    var rawText = (decodedBuf || rawBuf).toString('utf8');
                    if (rawText.indexOf('#EXTM3U') !== -1) {
                        var rewritten = rewriteM3u8Manifest(rawText, streamUrl);
                        var outBuf = allocBufferUtf8(rewritten);
                        clientRes.writeHead(200, {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/vnd.apple.mpegurl',
                            'Content-Length': outBuf.length,
                            'Cache-Control': 'no-cache'
                        });
                        clientRes.end(outBuf);
                    } else {
                        clientRes.writeHead(upRes.statusCode || 200, {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': upRes.headers['content-type'] || 'video/mp2t'
                        });
                        clientRes.end(decodedBuf || rawBuf);
                    }
                });
            });
            return;
        }

        var resHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': upRes.headers['content-type'] || 'video/mp2t'
        };
        if (upRes.headers['content-length']) {
            resHeaders['Content-Length'] = upRes.headers['content-length'];
        }
        if (upRes.headers['content-range']) {
            resHeaders['Content-Range'] = upRes.headers['content-range'];
        }
        if (upRes.headers['accept-ranges']) {
            resHeaders['Accept-Ranges'] = upRes.headers['accept-ranges'];
        }

        clientRes.writeHead(upRes.statusCode || 200, resHeaders);
        upRes.pipe(clientRes);
    });
    upReq.on('error', function() {
        if (!clientRes.headersSent) {
            clientRes.writeHead(502);
        }
        clientRes.end();
    });
    clientReq.on('close', function() {
        upReq.abort();
    });
    upReq.end();
}

function startProxyServer(port) {
    if (server) {
        return server;
    }
    var listenPort = port || PROXY_PORT;
    server = http.createServer(function(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        if (req.url === '/health' || req.url === '/ping' || req.headers['x-stalker-ping'] === '1') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', port: activeListenPort, cachedPortals: Object.keys(endpointCache).length }));
            return;
        }
        var parsedUrl = url.parse(req.url, true);
        if (parsedUrl.pathname === '/backup') {
            if (req.method === 'POST') {
                var bodyParts = [];
                req.on('data', function(c) {
                    bodyParts.push(Buffer.isBuffer(c) ? c : allocBufferUtf8(c));
                });
                req.on('end', function() {
                    memoryBackupJson = Buffer.concat(bodyParts).toString('utf8');
                    try {
                        fs.writeFile(BACKUP_FILE_PATH, memoryBackupJson, 'utf8', function() {});
                    } catch (exWrite) {}
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'saved' }));
                });
                return;
            }
            if (req.method === 'GET') {
                if (memoryBackupJson) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(memoryBackupJson);
                    return;
                }
                fs.readFile(BACKUP_FILE_PATH, 'utf8', function(readErr, diskData) {
                    if (!readErr && diskData) {
                        memoryBackupJson = diskData;
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(diskData);
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'No backup stored' }));
                    }
                });
                return;
            }
        }
        if (parsedUrl.pathname === '/catalog-cache') {
            var profKey = String((parsedUrl.query && parsedUrl.query.profile) || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
            var cacheFilePath = '/tmp/smartstb_catalog_' + profKey + '.json';
            if (req.method === 'POST') {
                var catParts = [];
                var totalBytes = 0;
                var tooLarge = false;
                req.on('data', function(c) {
                    var buf = Buffer.isBuffer(c) ? c : allocBufferUtf8(c);
                    totalBytes += buf.length;
                    if (totalBytes > 4718592) {
                        tooLarge = true;
                        catParts = [];
                        return;
                    }
                    catParts.push(buf);
                });
                req.on('end', function() {
                    if (tooLarge) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'skipped_large_catalog', bytes: totalBytes }));
                        return;
                    }
                    var rawBuffer = Buffer.concat(catParts);
                    catParts = [];
                    try {
                        fs.writeFile(cacheFilePath, rawBuffer, function() {});
                    } catch (eDisk) {}
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'cached', bytes: rawBuffer.length }));
                });
                return;
            }
            if (req.method === 'GET') {
                fs.readFile(cacheFilePath, 'utf8', function(readErr, jsonStr) {
                    if (readErr || !jsonStr) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'No catalog cache' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(jsonStr);
                });
                return;
            }
        }
        if (parsedUrl.pathname === '/stream' && parsedUrl.query && parsedUrl.query.url) {
            proxyVideoStream(parsedUrl.query.url, req, res, 5);
            return;
        }

        var rawPortal = req.headers['x-stalker-portal'];
        var rawMac = req.headers['x-stalker-mac'];
        var rawToken = req.headers['x-stalker-token'];
        var rawTz = req.headers['x-stalker-tz'] || 'UTC';
        var targetSearch = req.headers['x-stalker-search'] || req.url;
        if (!rawPortal || !rawMac) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing x-stalker-portal or x-stalker-mac header' }));
            return;
        }
        var mac = safeDecodeURIComponent(rawMac).trim();
        var portal = safeDecodeURIComponent(rawPortal).trim();
        var tz = safeDecodeURIComponent(rawTz).trim() || 'UTC';
        var portalKey = normalizePortalKey(portal);
        var refererUrl = getReferer(portal);
        lastPortalReferer = refererUrl;
        var headers = {
            'User-Agent': MAG_UA,
            'X-User-Agent': 'Model: MAG250; Link: WiFi',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': 'mac=' + encodeURIComponent(mac) + '; stb_lang=en; timezone=' + encodeURIComponent(tz),
            'Referer': refererUrl
        };
        if (rawToken) {
            headers.Authorization = 'Bearer ' + safeDecodeURIComponent(rawToken).trim();
        }
        var candidates = getCandidateUrls(portal, targetSearch);
        requestWithFallback({
            portalKey: portalKey,
            candidates: candidates,
            idx: 0,
            headers: headers,
            redirectsLeft: 3,
            useFreshSocket: false
        }, function(err, result) {
            if (err) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(result);
        });
    });
    server.on('error', function(err) {
        if (err && err.code === 'EADDRINUSE' && listenPort === PROXY_PORT) {
            server = null;
            startProxyServer(FALLBACK_PORT);
        }
    });
    server.listen(listenPort, '127.0.0.1', function() {
        activeListenPort = listenPort;
        console.log('Stalker proxy listening on http://127.0.0.1:' + listenPort);
    });
    return server;
}

function stopProxyServer(cb) {
    if (!server) {
        if (cb) {
            cb();
        }
        return;
    }
    var s = server;
    server = null;
    s.close(function() {
        if (cb) {
            cb();
        }
    });
}

module.exports = {
    startProxyServer: startProxyServer,
    stopProxyServer: stopProxyServer,
    onStart: function() {
        startProxyServer(PROXY_PORT);
    },
    onRequest: function() {
        startProxyServer(PROXY_PORT);
    },
    onStop: function() {
        stopProxyServer();
    },
    onExit: function() {
        stopProxyServer();
    }
};
