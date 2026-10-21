/* jshint browser: true, devel: true, undef: true, unused: true, strict: true, esversion: 5 */
/* global tizen, webapis, Promise, Intl, Blob, URL, FileReader */
/*
 * SmartSTB Clone for Samsung Tizen TV & PC
 * Complete Application Controller (app.js)
 * Compatible with Tizen 4.0+ WebEngine & Desktop Browsers (ES5/ES6 safe)
 */
(function() {
    'use strict';
    var PROXY_URL = 'http://127.0.0.1:3001';
    var FALLBACK_PROXY_URL = 'http://127.0.0.1:3000';
    var SERVICE_ID = 'smartstbv2.StalkerProxy';
    var modes = [
        { id: 'live', title: 'Live TV', icon: '📺' },
        { id: 'vod', title: 'Movies (VOD)', icon: '🎬' },
        { id: 'series', title: 'TV Series', icon: '📁' },
        { id: 'search', title: 'Global Search', icon: '🔍' },
        { id: 'settings', title: 'Settings', icon: '⚙' }
    ];
    var modeIdx = 0;
    var lastContentModeIdx = 0;
    var catIdx = 0;
    var itemIdx = 0;
    var infoActionIdx = 0;
    var activeCol = 'modes';
    var liveGenres = [];
    var allChannels = [];
    var vodCats = [];
    var seriesCats = [];
    var rawCats = [];
    var rawItems = [];
    var currentCats = [];
    var currentItems = [];
    var catFilterText = '';
    var itemFilterText = '';
    var currentSort = 'added';
    var vodPage = 1;
    var vodLoading = false;
    var vodHasMore = true;
    var liveGenrePaged = false;
    var seriesStack = [];
    var isPlayingVod = false;
    var isPlayingCatchup = false;
    var isPaused = false;
    var currentPlayingItem = null;
    var previousLiveChannel = null;
    var retryCount = 0;
    var playSessionId = 0;
    var bufferingWatchdogTimer = null;
    var currentAspect = 'PLAYER_DISPLAY_MODE_LETTER_BOX';
    var audioTracks = [];
    var audioIdx = 0;
    var textTracks = [];
    var textIdx = -1;
    var subtitlesEnabled = true;
    var subtitleClearTimer = null;
    var vodDurationMs = 0;
    var vodCurrentMs = 0;
    var seekTargetMs = null;
    var seekDebounceTimer = null;
    var nextEpCandidate = null;
    var nextEpTimer = null;
    var nextEpCountdown = 0;
    var nextEpDismissedForId = null;
    var uiVisible = true;
    var zapTimeout = null;
    var osdTimeout = null;
    var previewEpgTimeout = null;
    var numBuffer = '';
    var numTimeout = null;
    var exitConfirmPending = false;
    var exitConfirmTimeout = null;
    var hasAutoResumedOnBoot = false;
    var shortEpgCache = {};
    var favLiveCache = null;
    var favVodCache = null;
    var favSeriesCache = null;
    var favLookupCache = { live: null, vod: null, series: null };
    var watchedLookupCache = null;
    var pinnedCatsCache = {};
    var recLiveCache = null;
    var recVodCache = null;
    var genreChannelCounts = {};
    var genreChannelsMap = {};
    var channelByIdMap = {};
    var channelByNumMap = {};
    var previewDebounceTimer = null;
    var playerVolume = Number(localStorage.getItem('cfg_volume') || 100);
    var playerMuted = false;
    var toastTimeout = null;
    var accountInfoText = '';
    var quickActionButtons = [];

    // Settings Modal 2D Grid State
    var settingsOpen = false;
    var settingsRow = 0;
    var settingsCol = 0;
    var imeActive = false;
    var profiles = [];
    var activeProfileId = '';
    var editingProfileIndex = 0;

    // Parental PIN Modal State
    var pinModalOpen = false;
    var pinModalRow = 0;
    var pinModalCol = 0;
    var pinModalCallback = null;

    // Search Modal State
    var searchOpen = false;
    var searchFocusArea = 'input';
    var searchIdx = 0;
    var searchResults = [];
    var searchDebounce = null;
    var searchSeq = 0;

    // Filter Modal 2D Grid State
    var filterOpen = false;
    var filterRow = 0;
    var filterCol = 0;
    var filterTargetCol = 'items';

    // Full EPG Modal State
    var epgModalOpen = false;
    var epgModalChannel = null;
    var epgModalItems = [];
    var epgModalIdx = 0;

    // Interactive Audio & Subtitle Track Picker Modal State
    var tracksModalOpen = false;
    var tracksModalItems = [];
    var tracksModalIdx = 0;
    var subtitleColor = localStorage.getItem('cfg_sub_color') || 'white';
    var subtitleSize = localStorage.getItem('cfg_sub_size') || 'normal';

    // Fullscreen Quick Channel Zapper Drawer State
    var miniZapOpen = false;
    var miniZapIdx = 0;

    // Sleep Timer State
    var sleepTimerMinutes = 0;
    var sleepTimerDeadline = 0;
    var sleepTimerInterval = null;

    function extendObj(baseObj, extraObj) {
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

    // DOM References (Supports both #col-modes and #modes-col IDs)
    var subtitleBoxEl = document.getElementById('subtitle-box');
    var serviceBannerEl = document.getElementById('service-banner');
    var profileBadgeEl = document.getElementById('profile-badge');
    var accountBadgeEl = document.getElementById('account-exp-badge');
    var sleepTimerBadgeEl = document.getElementById('sleep-timer-badge');
    var modesColEl = document.getElementById('col-modes') || document.getElementById('modes-col');
    var catsColEl = document.getElementById('col-cats') || document.getElementById('cats-col');
    var itemsColEl = document.getElementById('col-items') || document.getElementById('items-col');
    var infoColEl = document.getElementById('col-info') || document.getElementById('info-col');
    var modesListEl = document.getElementById('modes-list');
    var catsListEl = document.getElementById('cats-list');
    var itemsListEl = document.getElementById('items-list');
    var catsHeaderEl = document.getElementById('cats-header');
    var itemsHeaderEl = document.getElementById('items-header');
    var previewPosterWrapEl = document.getElementById('preview-poster-wrap');
    var previewPosterEl = document.getElementById('preview-poster');
    var previewTitleEl = document.getElementById('preview-title');
    var previewMetaEl = document.getElementById('preview-meta');
    var previewDescEl = document.getElementById('preview-desc');
    var filterBadgeEl = document.getElementById('filter-badge');
    var clockDisplayEl = document.getElementById('clock-display');
    var overlayEl = document.getElementById('ui-overlay');
    var numOsdEl = document.getElementById('num-osd');
    var osdBar = document.getElementById('osd-bar');
    var osdTitle = document.getElementById('osd-title');
    var osdStatus = document.getElementById('osd-status');
    var osdTechBadgesEl = document.getElementById('osd-tech-badges');
    var epgNow = document.getElementById('epg-now');
    var epgNext = document.getElementById('epg-next');
    var vodProgressWrap = document.getElementById('vod-progress-wrap');
    var vodProgressBar = document.getElementById('vod-progress-bar');
    var vodSeekMarker = document.getElementById('vod-seek-marker');
    var vodTimeRow = document.getElementById('vod-time-row');
    var vodTimeLabel = document.getElementById('vod-time-label') || document.getElementById('vod-time-cur');
    var vodTimeDurEl = document.getElementById('vod-time-dur');
    var vodSeekPreview = document.getElementById('vod-seek-preview');
    var nextEpBanner = document.getElementById('next-ep-banner');
    var nextEpTitleEl = document.getElementById('next-ep-title');
    var nextEpSubEl = document.getElementById('next-ep-sub');
    var miniZapDrawerEl = document.getElementById('mini-zap-drawer');
    var miniZapTitleEl = document.getElementById('mini-zap-title');
    var miniZapSubEl = document.getElementById('mini-zap-sub');
    var miniZapListEl = document.getElementById('mini-zap-list');
    var tracksModalEl = document.getElementById('tracks-modal');
    var tracksModalTitleEl = document.getElementById('tracks-modal-title');
    var tracksModalSubtitleEl = document.getElementById('tracks-modal-subtitle');
    var tracksListEl = document.getElementById('tracks-list');
    var tracksStyleColorEl = document.getElementById('tracks-style-color');
    var tracksStyleSizeEl = document.getElementById('tracks-style-size');
    var settingsModal = document.getElementById('settings-modal');
    var selProfileEl = document.getElementById('sel-profile');
    var inpProfileNameEl = document.getElementById('inp-profile-name');
    var inpPortalEl = document.getElementById('inp-portal');
    var inpMacEl = document.getElementById('inp-mac');
    var selThemeEl = document.getElementById('sel-theme');
    var inpPinEl = document.getElementById('inp-pin');
    var btnSaveEl = document.getElementById('btn-save');
    var btnProfileNewEl = document.getElementById('btn-profile-new');
    var btnProfileDelEl = document.getElementById('btn-profile-del');
    var btnRestartEl = document.getElementById('btn-restart');
    var btnCancelEl = document.getElementById('btn-cancel');
    var btnBackupExportEl = document.getElementById('btn-backup-export');
    var btnBackupImportEl = document.getElementById('btn-backup-import');

    if (!subtitleBoxEl) {
        subtitleBoxEl = document.createElement('div');
        subtitleBoxEl.id = 'subtitle-box';
        document.body.insertBefore(subtitleBoxEl, overlayEl || document.body.firstChild);
    }
    if (!btnRestartEl && btnCancelEl && btnCancelEl.parentNode) {
        btnRestartEl = document.createElement('div');
        btnRestartEl.id = 'btn-restart';
        btnRestartEl.className = 'btn';
        btnRestartEl.textContent = 'Restart App';
        btnCancelEl.parentNode.insertBefore(btnRestartEl, btnCancelEl);
    }
    if (!accountBadgeEl && profileBadgeEl && profileBadgeEl.parentNode) {
        accountBadgeEl = document.createElement('span');
        accountBadgeEl.id = 'account-exp-badge';
        accountBadgeEl.className = 'account-exp-badge';
        accountBadgeEl.textContent = 'Connecting...';
        profileBadgeEl.parentNode.insertBefore(accountBadgeEl, profileBadgeEl.nextSibling);
    }
    if (!btnBackupExportEl && btnCancelEl && btnCancelEl.parentNode && btnCancelEl.parentNode.parentNode) {
        var backupRow = document.createElement('div');
        backupRow.className = 'btn-row';
        btnBackupExportEl = document.createElement('div');
        btnBackupExportEl.id = 'btn-backup-export';
        btnBackupExportEl.className = 'btn';
        btnBackupExportEl.textContent = '⬇ Save Backup';
        btnBackupImportEl = document.createElement('div');
        btnBackupImportEl.id = 'btn-backup-import';
        btnBackupImportEl.className = 'btn';
        btnBackupImportEl.textContent = '⬆ Restore Backup';
        backupRow.appendChild(btnBackupExportEl);
        backupRow.appendChild(btnBackupImportEl);
        btnCancelEl.parentNode.parentNode.appendChild(backupRow);
    }

    var settingsGrid = [
        [selProfileEl, inpProfileNameEl].filter(Boolean),
        [inpPortalEl].filter(Boolean),
        [inpMacEl].filter(Boolean),
        [selThemeEl, inpPinEl].filter(Boolean),
        [btnSaveEl, btnProfileNewEl, btnProfileDelEl, btnRestartEl, btnCancelEl].filter(Boolean),
        [btnBackupExportEl, btnBackupImportEl].filter(Boolean)
    ].filter(function(r) { return r.length > 0; });

    var settingsEls = [
        selProfileEl, inpProfileNameEl, inpPortalEl, inpMacEl,
        selThemeEl, inpPinEl, btnSaveEl, btnProfileNewEl, btnProfileDelEl,
        btnRestartEl, btnCancelEl, btnBackupExportEl, btnBackupImportEl
    ].filter(Boolean);

    var pinModalEl = document.getElementById('pin-modal');
    var inpPinVerifyEl = document.getElementById('inp-pin-verify');
    var btnPinUnlockEl = document.getElementById('btn-pin-unlock');
    var btnPinCancelEl = document.getElementById('btn-pin-cancel');
    var pinStatusMsgEl = document.getElementById('pin-status-msg');
    var pinGrid = [
        [inpPinVerifyEl].filter(Boolean),
        [btnPinUnlockEl, btnPinCancelEl].filter(Boolean)
    ];
    var pinEls = [inpPinVerifyEl, btnPinUnlockEl, btnPinCancelEl].filter(Boolean);

    var searchModal = document.getElementById('search-modal');
    var searchInput = document.getElementById('inp-search');
    var searchResultsContainer = document.getElementById('search-results');
    var filterModal = document.getElementById('filter-modal');
    var filterModalTitle = document.getElementById('filter-modal-title');
    var inpFilterEl = document.getElementById('inp-filter');
    var btnFilterApplyEl = document.getElementById('btn-filter-apply');
    var btnFilterClearEl = document.getElementById('btn-filter-clear');
    var filterGrid = [
        [inpFilterEl].filter(Boolean),
        [btnFilterApplyEl, btnFilterClearEl].filter(Boolean)
    ];
    var filterEls = [inpFilterEl, btnFilterApplyEl, btnFilterClearEl].filter(Boolean);

    var epgModal = document.getElementById('epg-modal');
    var epgModalTitle = document.getElementById('epg-modal-title');
    var epgModalList = document.getElementById('epg-modal-list');
    var epgModalProgTitle = document.getElementById('epg-modal-prog-title');
    var epgModalProgTime = document.getElementById('epg-modal-prog-time');
    var epgModalDesc = document.getElementById('epg-modal-desc');

    if (previewPosterEl) {
        previewPosterEl.onerror = function() {
            if (previewPosterWrapEl) {
                previewPosterWrapEl.classList.remove('visible');
            }
        };
    }

    function showToast(message) {
        if (!message) {
            return;
        }
        var toastEl = document.getElementById('smartstb-toast');
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.id = 'smartstb-toast';
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = message;
        toastEl.classList.add('visible');
        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }
        toastTimeout = setTimeout(function() {
            toastEl.classList.remove('visible');
        }, 2500);
    }

    function applySubtitleAppearance() {
        if (!subtitleBoxEl) {
            return;
        }
        subtitleBoxEl.classList.remove('sub-yellow');
        subtitleBoxEl.classList.remove('sub-cyan');
        subtitleBoxEl.classList.remove('sub-size-lg');
        subtitleBoxEl.classList.remove('sub-size-xl');
        if (subtitleColor === 'yellow') {
            subtitleBoxEl.classList.add('sub-yellow');
        } else if (subtitleColor === 'cyan') {
            subtitleBoxEl.classList.add('sub-cyan');
        }
        if (subtitleSize === 'large') {
            subtitleBoxEl.classList.add('sub-size-lg');
        } else if (subtitleSize === 'xl') {
            subtitleBoxEl.classList.add('sub-size-xl');
        }
        if (tracksStyleColorEl) {
            tracksStyleColorEl.textContent = '◀ Color: ' + subtitleColor.toUpperCase();
        }
        if (tracksStyleSizeEl) {
            tracksStyleSizeEl.textContent = 'Size: ' + subtitleSize.toUpperCase() + ' ▶';
        }
    }

    function cycleSubtitleColor() {
        var colors = ['white', 'yellow', 'cyan'];
        var idx = colors.indexOf(subtitleColor);
        subtitleColor = colors[(idx + 1) % colors.length];
        safeSetStorage('cfg_sub_color', subtitleColor);
        applySubtitleAppearance();
        showToast('💬 Subtitle Color: ' + subtitleColor.toUpperCase());
    }

    function cycleSubtitleSize() {
        var sizes = ['normal', 'large', 'xl'];
        var idx = sizes.indexOf(subtitleSize);
        subtitleSize = sizes[(idx + 1) % sizes.length];
        safeSetStorage('cfg_sub_size', subtitleSize);
        applySubtitleAppearance();
        showToast('💬 Subtitle Size: ' + subtitleSize.toUpperCase());
    }

    function clearSubtitleBox() {
        if (subtitleClearTimer) {
            clearTimeout(subtitleClearTimer);
            subtitleClearTimer = null;
        }
        if (subtitleBoxEl) {
            subtitleBoxEl.textContent = '';
            subtitleBoxEl.classList.remove('visible');
        }
    }

    function renderSubtitleCue(rawText, durationMs) {
        if (!subtitleBoxEl || !subtitlesEnabled) {
            return;
        }
        if (subtitleClearTimer) {
            clearTimeout(subtitleClearTimer);
            subtitleClearTimer = null;
        }
        var cleaned = String(rawText || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/\{[^}]*\}/g, '')
            .replace(/<[^>]+>/g, '')
            .trim();
        if (!cleaned) {
            subtitleBoxEl.textContent = '';
            subtitleBoxEl.classList.remove('visible');
            return;
        }
        applySubtitleAppearance();
        subtitleBoxEl.textContent = cleaned;
        subtitleBoxEl.classList.add('visible');
        var dur = Number(durationMs) || 0;
        if (dur > 0) {
            subtitleClearTimer = setTimeout(function() {
                if (subtitleBoxEl) {
                    subtitleBoxEl.textContent = '';
                    subtitleBoxEl.classList.remove('visible');
                }
            }, Math.min(dur, 12000));
        }
    }

    function rebuildGenreChannelCounts() {
        var counts = { '*': allChannels.length };
        var byGenre = {};
        var byId = {};
        var byNum = {};
        for (var i = 0; i < allChannels.length; i++) {
            var ch = allChannels[i];
            if (!ch) {
                continue;
            }
            var gid = String(ch.genreId || '*');
            counts[gid] = (counts[gid] || 0) + 1;
            if (!byGenre[gid]) {
                byGenre[gid] = [];
            }
            byGenre[gid].push(ch);
            if (ch.id !== undefined && ch.id !== null) {
                byId[String(ch.id)] = ch;
            }
            if (ch.num) {
                byNum[String(ch.num)] = ch;
            }
        }
        genreChannelCounts = counts;
        genreChannelsMap = byGenre;
        channelByIdMap = byId;
        channelByNumMap = byNum;
    }

    function safeGetJson(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (ex) {
            return fallback;
        }
    }
    function safeSetStorage(key, valueStr) {
        try {
            localStorage.setItem(key, valueStr);
            return true;
        } catch (ex1) {
            try {
                if (key !== 'stalker_live') {
                    localStorage.removeItem('stalker_live');
                }
                localStorage.setItem(key, valueStr);
                return true;
            } catch (ex2) {
                return false;
            }
        }
    }
    function getProfileScopedKey(baseKey) {
        var pid = activeProfileId || 'prof_default';
        return baseKey + '_' + pid;
    }
    function getScopedJsonWithLegacyFallback(baseKey, fallback) {
        var scopedKey = getProfileScopedKey(baseKey);
        var rawScoped = localStorage.getItem(scopedKey);
        if (rawScoped !== null) {
            return safeGetJson(scopedKey, fallback);
        }
        if (activeProfileId === 'prof_default' || editingProfileIndex === 0) {
            var legacyVal = safeGetJson(baseKey, null);
            if (legacyVal !== null) {
                safeSetStorage(scopedKey, JSON.stringify(legacyVal));
                return legacyVal;
            }
        }
        return fallback;
    }

    function loadProfiles() {
        var saved = safeGetJson('cfg_profiles', null);
        var legacyPortal = localStorage.getItem('cfg_portal') || '';
        var legacyMac = localStorage.getItem('cfg_mac') || '00:1A:79:00:00:01';
        if (!Array.isArray(saved) || saved.length === 0) {
            saved = [{ id: 'prof_default', name: 'Main Portal', portal: legacyPortal, mac: legacyMac }];
            safeSetStorage('cfg_profiles', JSON.stringify(saved));
        }
        profiles = saved;
        var activeId = localStorage.getItem('cfg_active_profile');
        var foundIdx = -1;
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === activeId) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx === -1) {
            foundIdx = 0;
        }
        activeProfileId = profiles[foundIdx].id;
        editingProfileIndex = foundIdx;
        syncActiveProfileToLegacyKeys(profiles[foundIdx]);
    }
    function syncActiveProfileToLegacyKeys(prof) {
        if (!prof) {
            return;
        }
        activeProfileId = prof.id;
        safeSetStorage('cfg_active_profile', prof.id);
        safeSetStorage('cfg_portal', prof.portal || '');
        safeSetStorage('cfg_mac', prof.mac || '');
        if (profileBadgeEl) {
            profileBadgeEl.textContent = '⚡ ' + (prof.name || 'Default');
            profileBadgeEl.title = 'Click to open Portal & Profile Settings';
        }
    }
    function getActiveProfile() {
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === activeProfileId) {
                return profiles[i];
            }
        }
        return profiles[0] || { id: 'prof_default', name: 'Main Portal', portal: '', mac: '' };
    }

    function getDeviceTimezone() {
        try {
            var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            return tz || 'UTC';
        } catch (ex) {
            return 'UTC';
        }
    }
    function simpleHashHex(input, length) {
        var str = String(input || '');
        var out = '';
        var seed1 = 2166136261;
        var seed2 = 463116947;
        while (out.length < length) {
            for (var i = 0; i < str.length; i++) {
                seed1 = ((seed1 + str.charCodeAt(i)) * 16777619) % 4294967296;
                seed2 = ((seed2 * 33) + str.charCodeAt(i)) % 4294967296;
            }
            var h1 = Math.abs(seed1).toString(16);
            var h2 = Math.abs(seed2).toString(16);
            out += ('00000000' + h1).slice(-8) + ('00000000' + h2).slice(-8);
            seed1 = (seed1 + 248729395) % 4294967296;
        }
        return out.slice(0, length).toUpperCase();
    }
    function deriveMagIdentity(mac) {
        var cleanMac = String(mac || '00:1A:79:00:00:01').toUpperCase().trim();
        var sn = '022018' + simpleHashHex('SN:' + cleanMac, 7);
        var devId = simpleHashHex('DEVID1:' + cleanMac + ':' + sn, 64);
        var devId2 = simpleHashHex('DEVID2:' + cleanMac + ':' + sn, 64);
        var sig = simpleHashHex('SIG:' + cleanMac + ':' + sn + ':' + devId, 64);
        return { sn: sn, device_id: devId, device_id2: devId2, signature: sig };
    }
    function getPortalBaseUrl() {
        var portal = (localStorage.getItem('cfg_portal') || '').trim().replace(/\/+$/, '');
        if (!portal) {
            return '';
        }
        if (portal.indexOf('http://') !== 0 && portal.indexOf('https://') !== 0) {
            portal = 'http://' + portal;
        }
        return portal.replace(/\/(portal|load)\.php.*$/i, '').replace(/\/c$/i, '');
    }
    function resolveLogoUrl(rawLogo) {
        if (!rawLogo) {
            return '';
        }
        var trimmed = String(rawLogo).trim();
        if (!trimmed) {
            return '';
        }
        if (trimmed.indexOf('http://') === 0 || trimmed.indexOf('https://') === 0 || trimmed.indexOf('data:') === 0) {
            return trimmed;
        }
        var base = getPortalBaseUrl();
        if (!base) {
            return '';
        }
        if (trimmed.charAt(0) === '/') {
            var m = base.match(/^(https?:\/\/[^\/]+)/i);
            return (m ? m[1] : base) + trimmed;
        }
        return base + '/' + trimmed;
    }

    function showServiceBanner(msg) {
        if (!serviceBannerEl) {
            return;
        }
        if (msg) {
            serviceBannerEl.textContent = msg;
            serviceBannerEl.classList.add('visible');
        } else {
            serviceBannerEl.classList.remove('visible');
        }
    }
    function pingProxyCandidate(baseUrl) {
        return new Promise(function(resolve) {
            var controller = (typeof window !== 'undefined' && typeof window.AbortController !== 'undefined') ? new window.AbortController() : null;
            var timer = setTimeout(function() {
                if (controller) {
                    controller.abort();
                }
                resolve(false);
            }, 900);
            fetch(baseUrl + '/health', {
                method: 'GET',
                headers: { 'x-stalker-ping': '1' },
                signal: controller ? controller.signal : undefined
            }).then(function(res) {
                clearTimeout(timer);
                resolve(Boolean(res && (res.status === 200 || res.status === 400)));
            }).catch(function() {
                clearTimeout(timer);
                resolve(false);
            });
        });
    }
    function verifyProxyReachable(maxAttempts) {
        var attempts = 0;
        var limit = maxAttempts || 16;
        function tryNext() {
            attempts++;
            return pingProxyCandidate(PROXY_URL).then(function(okPrimary) {
                if (okPrimary) {
                    api.proxyUrl = PROXY_URL;
                    showServiceBanner('');
                    return true;
                }
                return pingProxyCandidate(FALLBACK_PROXY_URL).then(function(okFallback) {
                    if (okFallback) {
                        api.proxyUrl = FALLBACK_PROXY_URL;
                        showServiceBanner('');
                        return true;
                    }
                    if (attempts < limit) {
                        return new Promise(function(r) {
                            setTimeout(r, 280);
                        }).then(tryNext);
                    }
                    showServiceBanner('Warning: Local proxy service (' + SERVICE_ID + ') is not responding.');
                    return false;
                });
            });
        }
        return tryNext();
    }
    function wakeLocalService() {
        return new Promise(function(resolve) {
            try {
                if (typeof tizen !== 'undefined' && tizen.application && tizen.application.launchAppControl && typeof tizen.ApplicationControl === 'function') {
                    tizen.application.launchAppControl(
                        new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default'),
                        SERVICE_ID,
                        function() {
                            verifyProxyReachable(16).then(resolve);
                        },
                        function() {
                            verifyProxyReachable(10).then(resolve);
                        }
                    );
                    return;
                }
            } catch (ex) {}
            verifyProxyReachable(4).then(resolve);
        });
    }

    function normalizeChannelObj(c, defaultIdx, fallbackGenreId) {
        var hasArchive = String(c.enable_tv_archive) === '1' || Number(c.tv_archive_duration) > 0;
        var firstCmdObj = (Array.isArray(c.cmds) && c.cmds.length > 0 && c.cmds[0]) ? c.cmds[0] : null;
        var rawCmd = String(c.cmd || (firstCmdObj && (firstCmdObj.url || firstCmdObj.cmd)) || '').trim();
        var useTmp = String(c.use_http_tmp_link) === '1' ||
            (firstCmdObj && String(firstCmdObj.use_http_tmp_link) === '1');
        return {
            id: String(c.id || defaultIdx),
            num: Number(c.number) || defaultIdx,
            name: String(c.name || 'Channel ' + defaultIdx),
            cmd: rawCmd,
            useTmpLink: useTmp ? 1 : 0,
            genreId: String(c.tv_genre_id || fallbackGenreId || '*'),
            logo: String(c.logo || ''),
            archive: hasArchive ? 1 : 0,
            archiveDuration: Number(c.tv_archive_duration) || (hasArchive ? 168 : 0),
            censored: String(c.censored) === '1' ? 1 : 0,
            isVod: false,
            isSeries: false
        };
    }

    function updateAccountBadgeFromProfile(profile) {
        if (!accountBadgeEl) {
            return;
        }
        if (!profile || typeof profile !== 'object') {
            accountBadgeEl.textContent = '✓ Connected';
            accountBadgeEl.classList.remove('warn');
            return;
        }
        var expRaw = profile.expire_billing_date || profile.end_date || profile.tariff_expired_date || profile.phone || '';
        var cleanExp = String(expRaw || '').trim();
        if (cleanExp && cleanExp !== '0000-00-00 00:00:00' && cleanExp !== '0000-00-00') {
            var dateOnly = cleanExp.split(' ')[0];
            accountInfoText = 'Exp: ' + dateOnly;
            accountBadgeEl.textContent = '📅 ' + accountInfoText;
            accountBadgeEl.classList.remove('warn');
        } else if (profile.fname || profile.login) {
            accountInfoText = String(profile.fname || profile.login);
            accountBadgeEl.textContent = '✓ ' + accountInfoText;
            accountBadgeEl.classList.remove('warn');
        } else {
            accountInfoText = 'Active MAC';
            accountBadgeEl.textContent = '✓ Active MAC';
            accountBadgeEl.classList.remove('warn');
        }
    }

    function StalkerAPI(proxyUrl) {
        this.proxyUrl = proxyUrl;
        this.token = '';
        this.parentalPin = localStorage.getItem('cfg_pin') || '0000';
        this.watchdogTimer = null;
        this.seriesModule = null;
        this.handshakePromise = null;
        this.authPromise = null;
    }
    StalkerAPI.prototype.request = function(params, isRetry) {
        var self = this;
        var portal = (localStorage.getItem('cfg_portal') || '').trim();
        var mac = (localStorage.getItem('cfg_mac') || '').trim();
        if (!portal || !mac) {
            return Promise.reject(new Error('Portal URL or MAC not configured'));
        }
        var fullParams = extendObj(params, { JsHttpRequest: '1-xml' });
        if (this.token && fullParams.token === undefined && fullParams.action !== 'handshake') {
            fullParams.token = this.token;
        }
        var qsParts = [];
        var keys = Object.keys(fullParams);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (fullParams[k] !== undefined && fullParams[k] !== null) {
                qsParts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(fullParams[k])));
            }
        }
        var queryString = '?' + qsParts.join('&');
        var headers = {
            'x-stalker-portal': encodeURIComponent(portal),
            'x-stalker-mac': encodeURIComponent(mac),
            'x-stalker-tz': encodeURIComponent(getDeviceTimezone()),
            'x-stalker-search': queryString
        };
        if (this.token) {
            headers['x-stalker-token'] = encodeURIComponent(this.token);
        }
        var isEpgOrWatchdog = params.action === 'get_short_epg' ||
                              params.action === 'get_epg_info' ||
                              params.type === 'watchdog';
        var controller = (typeof window !== 'undefined' && typeof window.AbortController !== 'undefined') ? new window.AbortController() : null;
        var reqTimeoutMs = isEpgOrWatchdog ? 6000 : 14000;
        var timeoutId = setTimeout(function() {
            if (controller) {
                try {
                    controller.abort();
                } catch (eAbort) {}
            }
        }, reqTimeoutMs);
        var fetchOpts = {
            method: 'GET',
            headers: headers
        };
        if (controller) {
            fetchOpts.signal = controller.signal;
        }
        return fetch(this.proxyUrl + '/' + queryString, fetchOpts).then(function(res) {
            clearTimeout(timeoutId);
            if (!res.ok) {
                throw new Error('HTTP ' + res.status);
            }
            return res.json();
        }).then(function(data) {
            showServiceBanner('');
            if (!data || data.error) {
                if (isEpgOrWatchdog && (!data || data.error !== 'AUTH_FAILED')) {
                    return [];
                }
                throw new Error((data && data.error) || 'Empty portal response');
            }
            if (typeof data.text === 'string' && /authorization\s+failed/i.test(data.text)) {
                throw new Error('AUTH_FAILED');
            }
            if (data.js !== undefined) {
                return data.js;
            }
            return data;
        }).catch(function(reqErr) {
            clearTimeout(timeoutId);
            if (isEpgOrWatchdog) {
                return [];
            }
            if (!isRetry && params.action !== 'handshake' && params.action !== 'get_profile') {
                return self.ensureAuthenticatedSession().then(function() {
                    return self.request(params, true);
                });
            }
            throw reqErr;
        });
    };
    StalkerAPI.prototype.doHandshake = function() {
        var self = this;
        if (this.handshakePromise) {
            return this.handshakePromise;
        }
        this.handshakePromise = this.request({
            type: 'stb',
            action: 'handshake',
            token: '',
            prehash: '0'
        }, true).then(function(js) {
            self.handshakePromise = null;
            if (js && js.token) {
                self.token = String(js.token);
            }
            return js;
        }).catch(function(err) {
            self.handshakePromise = null;
            throw err;
        });
        return this.handshakePromise;
    };
    StalkerAPI.prototype.getProfile = function() {
        var self = this;
        var mac = localStorage.getItem('cfg_mac') || '00:1A:79:00:00:01';
        var id = deriveMagIdentity(mac);
        return this.request({
            type: 'stb',
            action: 'get_profile',
            hd: '1',
            ver: 'ImageDescription: 0.2.18-r14-pub-250; PORTAL version: 5.1.0;',
            num_banks: '2',
            sn: id.sn,
            stb_type: 'MAG250',
            image_version: '218',
            video_out: 'hdmi',
            device_id: id.device_id,
            device_id2: id.device_id2,
            signature: id.signature,
            auth_second_step: '0',
            hw_version: '1.7-BD-00',
            not_valid_token: '0',
            client_type: 'STB',
            hw_version_2: id.sn,
            timestamp: Math.floor(Date.now() / 1000),
            timezone: getDeviceTimezone()
        }, true).then(function(profile) {
            var customPin = localStorage.getItem('cfg_pin');
            if (customPin && customPin.length === 4) {
                self.parentalPin = customPin;
            } else if (profile && profile.parent_password) {
                self.parentalPin = String(profile.parent_password).trim() || '0000';
            } else {
                self.parentalPin = '0000';
            }
            updateAccountBadgeFromProfile(profile);
            return profile;
        });
    };
    StalkerAPI.prototype.ensureAuthenticatedSession = function() {
        var self = this;
        if (this.authPromise) {
            return this.authPromise;
        }
        this.authPromise = this.doHandshake().then(function() {
            return self.getProfile();
        }).then(function(profile) {
            self.authPromise = null;
            return profile;
        }).catch(function(err) {
            self.authPromise = null;
            throw err;
        });
        return this.authPromise;
    };
    StalkerAPI.prototype.boot = function() {
        var self = this;
        if (this.watchdogTimer) {
            clearInterval(this.watchdogTimer);
            this.watchdogTimer = null;
        }
        return this.ensureAuthenticatedSession().then(function(profile) {
            self.watchdogTimer = setInterval(function() {
                self.request({
                    type: 'watchdog',
                    action: 'get_events',
                    cur_play_type: isPlayingVod ? '2' : '1',
                    event_active_id: '0',
                    init: '0'
                }, true).catch(function() {});
            }, 120000);
            return profile;
        });
    };

    StalkerAPI.prototype.fetchLiveCatalog = function(forceRefresh) {
        var self = this;
        var activeProf = getActiveProfile();
        var cacheKey = 'stalker_live';
        function triggerBackgroundRefresh() {
            setTimeout(function() {
                self.refreshLiveInBackground().then(function(fresh) {
                    if (fresh && Array.isArray(fresh.genres) && fresh.genres.length > 3) {
                        liveGenres = fresh.genres;
                    }
                    if (fresh && Array.isArray(fresh.channels) && fresh.channels.length > 0) {
                        allChannels = fresh.channels;
                        rebuildGenreChannelCounts();
                        if (modes[modeIdx] && modes[modeIdx].id === 'live') {
                            rawCats = liveGenres;
                            var freshMap = {};
                            for (var i = 0; i < allChannels.length; i++) {
                                freshMap[String(allChannels[i].id)] = allChannels[i];
                            }
                            for (var j = 0; j < rawItems.length; j++) {
                                var updated = freshMap[String(rawItems[j].id)];
                                if (updated) {
                                    rawItems[j].cmd = updated.cmd;
                                    rawItems[j].useTmpLink = updated.useTmpLink;
                                }
                            }
                            applyColumnFilters();
                            renderCats();
                        }
                    }
                }).catch(function() {});
            }, 1500);
        }
        if (!forceRefresh) {
            var cached = safeGetJson(cacheKey, null);
            if (cached && cached.profileId === activeProf.id &&
                Array.isArray(cached.genres) && cached.genres.length > 0 &&
                Array.isArray(cached.channels) && cached.channels.length > 0) {
                if (!cached.updatedAt || (Date.now() - cached.updatedAt) > 1800000) {
                    triggerBackgroundRefresh();
                }
                return Promise.resolve({
                    genres: self.getOrderedGenres(cached.genres),
                    channels: cached.channels
                });
            }
            return fetch(this.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent(activeProf.id), {
                method: 'GET'
            }).then(function(r) {
                if (!r.ok) {
                    throw new Error('No proxy cache');
                }
                return r.json();
            }).then(function(diskCached) {
                if (diskCached && Array.isArray(diskCached.genres) && diskCached.genres.length > 0 &&
                    Array.isArray(diskCached.channels) && diskCached.channels.length > 0) {
                    if (!diskCached.updatedAt || (Date.now() - diskCached.updatedAt) > 1800000) {
                        triggerBackgroundRefresh();
                    }
                    return {
                        genres: self.getOrderedGenres(diskCached.genres),
                        channels: diskCached.channels
                    };
                }
                return self.refreshLiveInBackground();
            }).catch(function() {
                return self.refreshLiveInBackground();
            });
        }
        return this.refreshLiveInBackground();
    };
    StalkerAPI.prototype.getOrderedGenres = function(rawGenreList) {
        var base = [
            { id: '*', title: 'All Channels', censored: false },
            { id: 'fav', title: '★ Favorites', censored: false },
            { id: 'rec', title: '⏱ History', censored: false }
        ];
        var seen = { '*': true, fav: true, rec: true };
        var list = Array.isArray(rawGenreList) ? rawGenreList : [];
        for (var i = 0; i < list.length; i++) {
            var g = list[i];
            if (!g) {
                continue;
            }
            var gid = String(g.id || '');
            var gtitle = String(g.title || g.name || '').trim();
            if (!gid || !gtitle || seen[gid]) {
                continue;
            }
            seen[gid] = true;
            var isAdult = String(g.censored) === '1' || /adult|xxx|18\+|18\||for adults|erotic|porn/i.test(gtitle);
            base.push({ id: gid, title: gtitle, censored: isAdult });
        }
        return base;
    };
    StalkerAPI.prototype.refreshLiveInBackground = function(isRetryAttempt) {
        var self = this;
        var activeProf = getActiveProfile();
        var genresPromise = this.request({ type: 'itv', action: 'get_genres' }).catch(function() {
            return [];
        });
        var channelsPromise = this.request({ type: 'itv', action: 'get_all_channels' }).catch(function() {
            return [];
        });
        return Promise.all([genresPromise, channelsPromise]).then(function(results) {
            var genresRaw = Array.isArray(results[0]) ? results[0] : (results[0] && results[0].data ? results[0].data : []);
            var chRes = results[1] || {};
            var chData = Array.isArray(chRes.data) ? chRes.data : (Array.isArray(chRes) ? chRes : []);
            var slimGenres = [];
            for (var i = 0; i < genresRaw.length; i++) {
                var g = genresRaw[i];
                if (g && g.id !== undefined && String(g.id) !== '*') {
                    var title = String(g.title || g.name || 'Category').trim();
                    if (!title) {
                        continue;
                    }
                    var isAdult = String(g.censored || '0') === '1' || /adult|xxx|18\+|18\||for adults|erotic|porn/i.test(title);
                    slimGenres.push({
                        id: String(g.id),
                        title: title,
                        censored: isAdult ? 1 : 0
                    });
                }
            }
            if (slimGenres.length === 0 && !isRetryAttempt) {
                return self.ensureAuthenticatedSession().then(function() {
                    return self.refreshLiveInBackground(true);
                });
            }
            var slimChannels = [];
            for (var j = 0; j < chData.length; j++) {
                var c = chData[j];
                if (!c) {
                    continue;
                }
                slimChannels.push(normalizeChannelObj(c, j + 1, '*'));
            }
            if (slimGenres.length > 0 && slimChannels.length > 0) {
                setTimeout(function() {
                    try {
                        var cachePayloadStr = JSON.stringify({
                            profileId: activeProf.id,
                            updatedAt: Date.now(),
                            genres: slimGenres,
                            channels: slimChannels
                        });
                        if (slimChannels.length <= 6000) {
                            safeSetStorage('stalker_live', cachePayloadStr);
                        }
                        fetch(self.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent(activeProf.id), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: cachePayloadStr
                        }).catch(function() {});
                    } catch (eCache) {}
                }, 2500);
            }
            return {
                genres: self.getOrderedGenres(slimGenres),
                channels: slimChannels
            };
        });
    };
    StalkerAPI.prototype.fetchLiveGenrePage = function(genreId, page) {
        var p = page || 1;
        return this.request({
            type: 'itv',
            action: 'get_ordered_list',
            genre: genreId,
            force_ch_link_check: '0',
            fav: '0',
            sortby: 'number',
            hd: '0',
            p: p
        }).then(function(res) {
            var rows = (res && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
            var totalItems = Number(res && res.total_items) || 0;
            var maxPageItems = Number(res && res.max_page_items) || 14;
            var out = [];
            for (var i = 0; i < rows.length; i++) {
                var c = rows[i];
                if (!c) {
                    continue;
                }
                out.push(normalizeChannelObj(c, ((p - 1) * maxPageItems) + i + 1, genreId));
            }
            var hasMore = false;
            if (totalItems > 0) {
                hasMore = (p * maxPageItems) < totalItems;
            } else {
                hasMore = out.length >= maxPageItems && out.length > 0;
            }
            return {
                items: out,
                hasMore: hasMore
            };
        });
    };

    StalkerAPI.prototype.fetchVodCategories = function(isRetryAttempt) {
        var self = this;
        return this.request({ type: 'vod', action: 'get_categories' }).then(function(res) {
            var list = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
            var out = [
                { id: '*', title: 'All Movies', censored: false },
                { id: 'cont', title: '▶ Continue Watching', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            for (var i = 0; i < list.length; i++) {
                var c = list[i];
                if (!c || String(c.id) === '*') {
                    continue;
                }
                var title = String(c.title || c.name || 'Movies').trim();
                if (!title) {
                    continue;
                }
                var isAdult = String(c.censored) === '1' || /adult|xxx|18\+|18\||for adults|erotic|porn/i.test(title);
                out.push({ id: String(c.id), title: title, censored: isAdult });
            }
            if (out.length <= 4 && !isRetryAttempt) {
                return self.ensureAuthenticatedSession().then(function() {
                    return self.fetchVodCategories(true);
                });
            }
            return out;
        }).catch(function(err) {
            if (!isRetryAttempt) {
                return self.ensureAuthenticatedSession().then(function() {
                    return self.fetchVodCategories(true);
                });
            }
            throw err;
        });
    };
    StalkerAPI.prototype.fetchVodPage = function(categoryId, page, searchQuery, sortBy) {
        var params = {
            type: 'vod',
            action: 'get_ordered_list',
            category: categoryId || '*',
            p: page || 1,
            sortby: sortBy || 'added'
        };
        if (searchQuery) {
            params.search = searchQuery;
        }
        return this.request(params).then(function(res) {
            var rows = (res && Array.isArray(res.data)) ? res.data : [];
            var out = [];
            for (var i = 0; i < rows.length; i++) {
                var m = rows[i];
                if (!m || String(m.is_series) === '1') {
                    continue;
                }
                out.push({
                    id: String(m.id),
                    name: String(m.name || m.o_name || 'Movie'),
                    cmd: String(m.cmd || ''),
                    desc: String(m.description || m.actors || ''),
                    year: String(m.year || ''),
                    rating: String(m.rating_imdb || m.rating_kinopoisk || ''),
                    poster: String(m.screenshot_uri || m.pic || m.logo || ''),
                    genreId: String(m.category_id || categoryId || '*'),
                    censored: String(m.censored) === '1' ? 1 : 0,
                    isVod: true,
                    isSeries: false
                });
            }
            return out;
        });
    };
    StalkerAPI.prototype.fetchSeriesCategories = function(isRetryAttempt) {
        var self = this;
        return this.request({ type: 'series', action: 'get_categories' }).then(function(res) {
            var list = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
            if (list.length > 0) {
                self.seriesModule = 'series';
                return list;
            }
            self.seriesModule = 'vod';
            return self.request({ type: 'vod', action: 'get_categories' });
        }).catch(function() {
            self.seriesModule = 'vod';
            return self.request({ type: 'vod', action: 'get_categories' });
        }).then(function(list) {
            var arr = Array.isArray(list) ? list : (list && Array.isArray(list.data) ? list.data : []);
            var out = [
                { id: '*', title: 'All Series', censored: false },
                { id: 'cont', title: '▶ Continue Watching', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            for (var i = 0; i < arr.length; i++) {
                var c = arr[i];
                if (!c || String(c.id) === '*') {
                    continue;
                }
                var title = String(c.title || c.name || 'Series').trim();
                if (!title) {
                    continue;
                }
                out.push({
                    id: String(c.id),
                    title: title,
                    censored: String(c.censored) === '1' || /adult|xxx|18\+|18\||for adults|erotic|porn/i.test(title)
                });
            }
            if (out.length <= 4 && !isRetryAttempt) {
                return self.ensureAuthenticatedSession().then(function() {
                    return self.fetchSeriesCategories(true);
                });
            }
            return out;
        }).catch(function(err) {
            if (!isRetryAttempt) {
                return self.ensureAuthenticatedSession().then(function() {
                    return self.fetchSeriesCategories(true);
                });
            }
            throw err;
        });
    };
    StalkerAPI.prototype.fetchSeriesPage = function(categoryId, page, searchQuery, sortBy) {
        var mod = this.seriesModule || 'series';
        var params = {
            type: mod,
            action: 'get_ordered_list',
            category: categoryId || '*',
            p: page || 1,
            sortby: sortBy || 'added'
        };
        if (searchQuery) {
            params.search = searchQuery;
        }
        return this.request(params).then(function(res) {
            var rows = (res && Array.isArray(res.data)) ? res.data : [];
            var out = [];
            for (var i = 0; i < rows.length; i++) {
                var s = rows[i];
                if (!s) {
                    continue;
                }
                if (mod === 'vod' && String(s.is_series) !== '1') {
                    continue;
                }
                out.push({
                    id: String(s.id),
                    name: String(s.name || s.o_name || 'Series'),
                    cmd: String(s.cmd || ''),
                    desc: String(s.description || ''),
                    year: String(s.year || ''),
                    rating: String(s.rating_imdb || ''),
                    poster: String(s.screenshot_uri || s.pic || ''),
                    genreId: String(s.category_id || categoryId || '*'),
                    censored: String(s.censored) === '1' ? 1 : 0,
                    isVod: true,
                    isSeries: true,
                    streamType: mod
                });
            }
            return out;
        });
    };
    StalkerAPI.prototype.fetchSeriesSeasons = function(seriesItem) {
        var mod = seriesItem.streamType || this.seriesModule || 'series';
        return this.request({
            type: mod,
            action: 'get_ordered_list',
            movie_id: seriesItem.id,
            season_id: 0,
            episode_id: 0,
            p: 1
        }).then(function(res) {
            var rows = (res && Array.isArray(res.data)) ? res.data : [];
            var seasons = [];
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                if (!row) {
                    continue;
                }
                var epArray = Array.isArray(row.series) ? row.series : [];
                seasons.push({
                    id: String(row.id || (i + 1)),
                    name: String(row.name || ('Season ' + (i + 1))),
                    cmd: String(row.cmd || seriesItem.cmd || ''),
                    desc: String(row.description || seriesItem.desc || ''),
                    poster: String(row.screenshot_uri || seriesItem.poster || ''),
                    episodes: epArray,
                    parentSeries: seriesItem,
                    isSeason: true,
                    isVod: true,
                    isSeries: true,
                    streamType: mod
                });
            }
            return seasons;
        });
    };
    StalkerAPI.prototype.fetchShortEpg = function(channelId) {
        var key = String(channelId);
        var cached = shortEpgCache[key];
        if (cached && (Date.now() - cached.ts) < 300000) {
            return Promise.resolve(cached.list);
        }
        return this.request({
            type: 'itv',
            action: 'get_short_epg',
            ch_id: channelId,
            size: 10
        }, true).then(function(res) {
            var list = [];
            if (Array.isArray(res)) {
                list = res;
            } else if (res && Array.isArray(res.data)) {
                list = res.data;
            }
            shortEpgCache[key] = { ts: Date.now(), list: list };
            return list;
        }).catch(function() {
            shortEpgCache[key] = { ts: Date.now(), list: [] };
            return [];
        });
    };
    StalkerAPI.prototype.fetchFullEpg = function(channelId) {
        var self = this;
        return this.request({
            type: 'itv',
            action: 'get_epg_info',
            period: 24
        }).then(function(res) {
            var map = (res && res.data) ? res.data : res;
            if (map && Array.isArray(map[channelId]) && map[channelId].length > 0) {
                return map[channelId];
            }
            return self.fetchShortEpg(channelId);
        }).catch(function() {
            return self.fetchShortEpg(channelId);
        });
    };

    function cleanCmdPrefix(rawCmd) {
        return String(rawCmd || '').trim().replace(/^(?:ffrt\d*|ffmpeg|auto|solution)\s+/i, '').trim();
    }
    function extractStreamUrl(rawCmd, portalBase) {
        var str = cleanCmdPrefix(rawCmd);
        var match = str.match(/(https?:\/\/[^\s"']+|rtmp:\/\/[^\s"']+|rtsp:\/\/[^\s"']+|mms:\/\/[^\s"']+)/i);
        if (match) {
            return match[1];
        }
        if (str.charAt(0) === '/' && portalBase) {
            var originMatch = portalBase.match(/^(https?:\/\/[^\/]+)/i);
            return (originMatch ? originMatch[1] : portalBase) + str.split(/\s+/)[0];
        }
        return str.split(/\s+/)[0];
    }
    function isLocalhostOrInvalidUrl(u) {
        if (!u || u === 'error' || u.indexOf('://') === -1) {
            return true;
        }
        return /:\/\/(?:localhost|127\.0\.0\.1)(?:[:\/]|$)/i.test(u);
    }
    StalkerAPI.prototype.resolveStream = function(item, forceAlternate) {
        var self = this;
        if (item && item.isCatchup && item.channelRef && item.epgProgRef) {
            return self.createArchiveLink(item.channelRef, item.epgProgRef);
        }
        var portalBase = getPortalBaseUrl();
        var rawItemCmd = String(item.cmd || '').trim();
        var directUrl = extractStreamUrl(rawItemCmd, portalBase);
        var isLive = !item.isVod && !item.isEpisode;

        if (isLive && forceAlternate && item._preferDirectUrl && !isLocalhostOrInvalidUrl(directUrl)) {
            return Promise.resolve(directUrl);
        }
        var needsCreateLink = isLive ? (item.useTmpLink || isLocalhostOrInvalidUrl(directUrl)) : true;
        if (!needsCreateLink) {
            return Promise.resolve(directUrl);
        }

        var primaryType = item.isEpisode ? 'vod' : (item.streamType || (item.isVod ? 'vod' : 'itv'));
        var cmdToSend = isLive ? cleanCmdPrefix(rawItemCmd) : rawItemCmd;
        var params = {
            type: primaryType,
            action: 'create_link',
            cmd: cmdToSend
        };
        if (item.seriesNum !== undefined && item.seriesNum !== null) {
            params.series = item.seriesNum;
        }
        if (self.token) {
            params.token = self.token;
        }

        return this.request(params).then(function(res) {
            var returnedCmd = (res && res.cmd) ? res.cmd : (res && res.url ? res.url : '');
            var resolved = extractStreamUrl(returnedCmd, portalBase);
            if (!isLocalhostOrInvalidUrl(resolved)) {
                return resolved;
            }
            throw new Error('create_link returned localhost or empty URL');
        }).catch(function() {
            var altType = item.isVod ? (primaryType === 'vod' ? 'series' : 'vod') : 'itv';
            var altCmd = (cmdToSend === rawItemCmd) ? cleanCmdPrefix(rawItemCmd) : rawItemCmd;
            var altParams = {
                type: altType,
                action: 'create_link',
                cmd: altCmd,
                forced_storage: 'undefined',
                disable_ad: '0'
            };
            if (item.seriesNum !== undefined && item.seriesNum !== null) {
                altParams.series = item.seriesNum;
            }
            if (self.token) {
                altParams.token = self.token;
            }
            return self.request(altParams).then(function(r2) {
                var ret2 = (r2 && r2.cmd) ? r2.cmd : (r2 && r2.url ? r2.url : '');
                var res2 = extractStreamUrl(ret2, portalBase);
                if (!isLocalhostOrInvalidUrl(res2)) {
                    return res2;
                }
                if (!isLocalhostOrInvalidUrl(directUrl)) {
                    return directUrl;
                }
                return res2 || directUrl;
            }).catch(function() {
                return directUrl;
            });
        });
    };
    StalkerAPI.prototype.createArchiveLink = function(channel, epgProg) {
        var self = this;
        var portalBase = getPortalBaseUrl();
        var startTs = Number(epgProg.start_timestamp || 0);
        var stopTs = Number(epgProg.stop_timestamp || 0);
        var durationSec = stopTs > startTs ? (stopTs - startTs) : 3600;
        var archiveCmd = channel.cmd;
        return self.request({
            type: 'tv_archive',
            action: 'create_link',
            cmd: 'auto /media/' + epgProg.id + '.mpg',
            ch_id: channel.id,
            start: startTs,
            duration: durationSec
        }).then(function(res) {
            if (res && res.cmd) {
                return extractStreamUrl(res.cmd, portalBase);
            }
            throw new Error('Fallback to itv create_link');
        }).catch(function() {
            return self.request({
                type: 'itv',
                action: 'create_link',
                cmd: archiveCmd,
                forced_storage: 'undefined',
                disable_ad: '0'
            }).then(function(r2) {
                var base = (r2 && r2.cmd) ? extractStreamUrl(r2.cmd, portalBase) : extractStreamUrl(archiveCmd, portalBase);
                if (startTs > 0 && base.indexOf('utc=') === -1) {
                    var sep = base.indexOf('?') === -1 ? '?' : '&';
                    return base + sep + 'utc=' + startTs + '&lutc=' + Math.floor(Date.now() / 1000);
                }
                return base;
            });
        });
    };
    var api = new StalkerAPI(PROXY_URL);

    function getFavBaseKey(modeId) {
        if (modeId === 'vod') {
            return 'fav_vod_objs';
        }
        if (modeId === 'series') {
            return 'fav_series_objs';
        }
        return 'fav_live';
    }
    function getFavList(modeId) {
        var baseKey = getFavBaseKey(modeId);
        if (modeId === 'live') {
            if (!favLiveCache) {
                favLiveCache = getScopedJsonWithLegacyFallback(baseKey, []);
            }
            return favLiveCache;
        }
        if (modeId === 'vod') {
            if (!favVodCache) {
                favVodCache = getScopedJsonWithLegacyFallback(baseKey, []);
            }
            return favVodCache;
        }
        if (modeId === 'series') {
            if (!favSeriesCache) {
                favSeriesCache = getScopedJsonWithLegacyFallback(baseKey, []);
            }
            return favSeriesCache;
        }
        return getScopedJsonWithLegacyFallback(baseKey, []);
    }
    function invalidateFavCaches() {
        favLiveCache = null;
        favVodCache = null;
        favSeriesCache = null;
        favLookupCache = { live: null, vod: null, series: null };
        watchedLookupCache = null;
        pinnedCatsCache = {};
        recLiveCache = null;
        recVodCache = null;
    }

    function getFavLookupMap(modeId) {
        if (favLookupCache[modeId]) {
            return favLookupCache[modeId];
        }
        var list = getFavList(modeId);
        var map = {};
        for (var i = 0; i < list.length; i++) {
            var entry = list[i];
            var entryId = (typeof entry === 'object' && entry !== null) ? entry.id : entry;
            if (entryId !== undefined && entryId !== null) {
                map[String(entryId)] = true;
            }
        }
        favLookupCache[modeId] = map;
        return map;
    }
    function isFavItem(item) {
        if (!item) {
            return false;
        }
        var modeId = item.isSeries ? 'series' : (item.isVod ? 'vod' : 'live');
        var map = getFavLookupMap(modeId);
        return Boolean(map[String(item.id)]);
    }
    function toggleFavorite(item) {
        if (!item || item.isSeason || item.isEpisode) {
            return;
        }
        var modeId = item.isSeries ? 'series' : (item.isVod ? 'vod' : 'live');
        var scopedKey = getProfileScopedKey(getFavBaseKey(modeId));
        var list = getFavList(modeId).slice();
        var foundIdx = -1;
        for (var i = 0; i < list.length; i++) {
            var entry = list[i];
            var entryId = (typeof entry === 'object' && entry !== null) ? entry.id : entry;
            if (String(entryId) === String(item.id)) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx !== -1) {
            list.splice(foundIdx, 1);
            showOSD(item.name, 'Removed ★');
            showToast('★ Removed from Favorites: ' + item.name);
        } else {
            if (modeId === 'live') {
                list.push(String(item.id));
            } else {
                list.push(item);
            }
            showOSD(item.name, 'Added ★');
            showToast('★ Added to Favorites: ' + item.name);
        }
        safeSetStorage(scopedKey, JSON.stringify(list));
        invalidateFavCaches();
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
        }
        renderCats();
        renderItems();
        updatePreviewPanel();
    }
    function getRecentItems(isVodMode) {
        if (isVodMode) {
            if (!recVodCache) {
                recVodCache = getScopedJsonWithLegacyFallback('rec_vod', []);
            }
            return recVodCache;
        }
        if (!recLiveCache) {
            recLiveCache = getScopedJsonWithLegacyFallback('rec_items', []);
        }
        return recLiveCache;
    }
    function clearCurrentHistory() {
        var mode = modes[modeIdx];
        var isVodMode = mode && (mode.id === 'vod' || mode.id === 'series');
        var baseKey = isVodMode ? 'rec_vod' : 'rec_items';
        safeSetStorage(getProfileScopedKey(baseKey), JSON.stringify([]));
        if (isVodMode) {
            recVodCache = [];
        } else {
            recLiveCache = [];
        }
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
        if (currentCats[catIdx] && currentCats[catIdx].id === 'rec') {
            rawItems = [];
            applyColumnFilters();
        }
        renderUI();
        showToast('⏱ Watch History Cleared');
    }
    function pushRecentItem(item) {
        if (!item || item.isSeason) {
            return;
        }
        var baseKey = item.isVod ? 'rec_vod' : 'rec_items';
        var scopedKey = getProfileScopedKey(baseKey);
        var list = getRecentItems(item.isVod);
        var filtered = [];
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].id) !== String(item.id)) {
                filtered.push(list[i]);
            }
        }
        filtered.unshift({
            id: item.id,
            num: item.num || 0,
            name: item.name,
            cmd: item.cmd,
            useTmpLink: item.useTmpLink || 0,
            desc: item.desc || '',
            poster: item.poster || item.logo || '',
            logo: item.logo || '',
            archive: item.archive || 0,
            censored: item.censored || 0,
            isVod: Boolean(item.isVod),
            isSeries: Boolean(item.isSeries),
            seriesNum: item.seriesNum
        });
        if (filtered.length > 40) {
            filtered = filtered.slice(0, 40);
        }
        if (item.isVod) {
            recVodCache = filtered;
        } else {
            recLiveCache = filtered;
        }
        safeSetStorage(scopedKey, JSON.stringify(filtered));
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
    }
    function saveLastLiveChannel(item) {
        if (!item || item.isVod || item.isSeries) {
            return;
        }
        var currentCat = currentCats[catIdx];
        var catId = currentCat ? currentCat.id : '*';
        var isAdultCat = currentCat && (Boolean(currentCat.censored) || /adult|xxx|18\+|18\||for adults|erotic|porn/i.test(String(currentCat.title || '')));
        if (isAdultCat) {
            return;
        }
        safeSetStorage(getProfileScopedKey('last_live'), JSON.stringify({
            catId: String(catId),
            channelId: String(item.id),
            ts: Date.now()
        }));
    }
    function getLastLiveChannel() {
        return safeGetJson(getProfileScopedKey('last_live'), null);
    }
    function getPinnedCatIds(modeId) {
        var mId = modeId || (modes[modeIdx] ? modes[modeIdx].id : 'live');
        if (!pinnedCatsCache[mId]) {
            pinnedCatsCache[mId] = safeGetJson(getProfileScopedKey('pinned_cats_' + mId), []);
        }
        return pinnedCatsCache[mId];
    }
    function isPinnedCategory(modeId, catId) {
        if (!catId || catId === '*' || catId === 'cont' || catId === 'fav' || catId === 'rec') {
            return false;
        }
        var pinned = getPinnedCatIds(modeId);
        for (var i = 0; i < pinned.length; i++) {
            if (String(pinned[i]) === String(catId)) {
                return true;
            }
        }
        return false;
    }
    function togglePinCategory(catObj) {
        if (!catObj || catObj.id === '*' || catObj.id === 'cont' || catObj.id === 'fav' || catObj.id === 'rec') {
            showToast('Built-in categories are already at the top');
            return;
        }
        var mId = modes[modeIdx] ? modes[modeIdx].id : 'live';
        var pinned = getPinnedCatIds(mId).slice();
        var foundIdx = -1;
        for (var i = 0; i < pinned.length; i++) {
            if (String(pinned[i]) === String(catObj.id)) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx !== -1) {
            pinned.splice(foundIdx, 1);
            showToast('📌 Unpinned Category: ' + catObj.title);
        } else {
            pinned.unshift(String(catObj.id));
            showToast('📌 Pinned Category to Top: ' + catObj.title);
        }
        pinnedCatsCache[mId] = pinned;
        safeSetStorage(getProfileScopedKey('pinned_cats_' + mId), JSON.stringify(pinned));
        applyColumnFilters();
        for (var c = 0; c < currentCats.length; c++) {
            if (String(currentCats[c].id) === String(catObj.id)) {
                catIdx = c;
                break;
            }
        }
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
        renderCats();
    }
    function getContinueWatchingItems(isSeriesMode) {
        var rec = getRecentItems(true);
        var out = [];
        for (var i = 0; i < rec.length; i++) {
            var it = rec[i];
            if (!it) {
                continue;
            }
            var matchType = isSeriesMode ? Boolean(it.isSeries || it.isEpisode) : (!it.isSeries && !it.isEpisode);
            if (!matchType) {
                continue;
            }
            var resume = getResumeInfo(it.id);
            if (resume && resume.pos > 15 && resume.dur > 0) {
                var clone = extendObj(it, { _resumeRatio: Math.min(100, Math.round((resume.pos / resume.dur) * 100)), _resumeTs: resume.ts || 0 });
                out.push(clone);
            }
        }
        out.sort(function(a, b) {
            return (b._resumeTs || 0) - (a._resumeTs || 0);
        });
        return out;
    }
    function cycleSleepTimer() {
        var options = [0, 30, 60, 90, 120];
        var curIdx = options.indexOf(sleepTimerMinutes);
        sleepTimerMinutes = options[(curIdx + 1) % options.length];
        if (sleepTimerInterval) {
            clearInterval(sleepTimerInterval);
            sleepTimerInterval = null;
        }
        if (sleepTimerMinutes <= 0) {
            sleepTimerDeadline = 0;
            if (sleepTimerBadgeEl) {
                sleepTimerBadgeEl.textContent = '';
                sleepTimerBadgeEl.classList.remove('visible');
            }
            showToast('⏱ Sleep Timer: Off');
            return;
        }
        sleepTimerDeadline = Date.now() + (sleepTimerMinutes * 60000);
        function updateSleepBadge() {
            var remMs = sleepTimerDeadline - Date.now();
            if (remMs <= 0) {
                clearInterval(sleepTimerInterval);
                sleepTimerInterval = null;
                sleepTimerMinutes = 0;
                stopPlayback();
                showToast('⏱ Sleep Timer reached — Stopping playback');
                try {
                    if (typeof tizen !== 'undefined' && tizen.application) {
                        tizen.application.getCurrentApplication().exit();
                    }
                } catch (ex) {}
                return;
            }
            var remMin = Math.ceil(remMs / 60000);
            if (sleepTimerBadgeEl) {
                sleepTimerBadgeEl.textContent = '🌙 Sleep: ' + remMin + 'm';
                sleepTimerBadgeEl.classList.add('visible');
            }
        }
        updateSleepBadge();
        sleepTimerInterval = setInterval(updateSleepBadge, 15000);
        showToast('🌙 Sleep Timer set for ' + sleepTimerMinutes + ' minutes');
    }
    function saveResumeTime(itemId, currentSec, durationSec) {
        if (!itemId || !durationSec || durationSec <= 0) {
            return;
        }
        var scopedKey = getProfileScopedKey('vod_resume');
        var map = getScopedJsonWithLegacyFallback('vod_resume', {});
        if (currentSec / durationSec > 0.92) {
            delete map[String(itemId)];
            markItemWatched(itemId);
        } else if (currentSec < 15) {
            delete map[String(itemId)];
        } else {
            map[String(itemId)] = { pos: Math.floor(currentSec), dur: Math.floor(durationSec), ts: Date.now() };
        }
        safeSetStorage(scopedKey, JSON.stringify(map));
    }
    function getResumeInfo(itemId) {
        if (!itemId) {
            return null;
        }
        var map = getScopedJsonWithLegacyFallback('vod_resume', {});
        return map[String(itemId)] || null;
    }
    function getWatchedMap() {
        if (!watchedLookupCache) {
            watchedLookupCache = safeGetJson(getProfileScopedKey('vod_watched'), {});
        }
        return watchedLookupCache;
    }
    function markItemWatched(itemId) {
        if (!itemId) {
            return;
        }
        var map = getWatchedMap();
        map[String(itemId)] = Date.now();
        watchedLookupCache = map;
        safeSetStorage(getProfileScopedKey('vod_watched'), JSON.stringify(map));
    }
    function isItemWatched(itemId) {
        if (!itemId) {
            return false;
        }
        var map = getWatchedMap();
        return Boolean(map[String(itemId)]);
    }

    function adjustVolume(delta) {
        playerVolume = Math.max(0, Math.min(100, playerVolume + delta));
        playerMuted = (playerVolume === 0);
        safeSetStorage('cfg_volume', String(playerVolume));
        try {
            if (typeof tizen !== 'undefined' && tizen.tvaudiocontrol) {
                tizen.tvaudiocontrol.setMute(playerMuted);
                tizen.tvaudiocontrol.setVolume(playerVolume);
            }
        } catch (ex) {}
        var vids = document.querySelectorAll('video, audio');
        for (var i = 0; i < vids.length; i++) {
            try {
                vids[i].muted = playerMuted;
                vids[i].volume = playerVolume / 100;
            } catch (ex2) {}
        }
        showToast((playerMuted ? '🔇 Muted' : '🔊 Volume: ' + playerVolume + '%'));
    }
    function toggleMute() {
        playerMuted = !playerMuted;
        try {
            if (typeof tizen !== 'undefined' && tizen.tvaudiocontrol) {
                tizen.tvaudiocontrol.setMute(playerMuted);
            }
        } catch (ex) {}
        var vids = document.querySelectorAll('video, audio');
        for (var i = 0; i < vids.length; i++) {
            try {
                vids[i].muted = playerMuted;
            } catch (ex2) {}
        }
        showToast(playerMuted ? '🔇 Audio Muted' : '🔊 Audio Unmuted (' + playerVolume + '%)');
    }
    function forceRefreshCurrentCatalog() {
        showToast('🔄 Refreshing catalog from portal...');
        try {
            localStorage.removeItem('stalker_live');
        } catch (ex) {}
        liveGenres = [];
        allChannels = [];
        vodCats = [];
        seriesCats = [];
        switchMode(modeIdx);
    }

    function buildBackupPayload() {
        var payload = {
            version: 2,
            exportedAt: new Date().toISOString(),
            profiles: profiles,
            activeProfileId: activeProfileId,
            theme: localStorage.getItem('cfg_theme') || 'blue',
            storage: {}
        };
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k !== 'stalker_live' && k !== 'smartstb_local_backup') {
                payload.storage[k] = localStorage.getItem(k);
            }
        }
        return payload;
    }

    function exportBackupJson() {
        var payload = buildBackupPayload();
        var jsonStr = JSON.stringify(payload, null, 2);
        safeSetStorage('smartstb_local_backup', jsonStr);
        fetch(api.proxyUrl + '/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStr
        }).then(function() {
            showToast('⬇ Backup saved to TV / Proxy storage');
        }).catch(function() {
            showToast('⬇ Backup snapshot saved');
        });
        try {
            if (typeof tizen === 'undefined' && typeof Blob !== 'undefined') {
                var blob = new Blob([jsonStr], { type: 'application/json' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'smartstb-backup-' + new Date().toISOString().slice(0, 10) + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        } catch (ex) {}
    }

    function applyRestoredBackupData(data) {
        if (data && data.storage && typeof data.storage === 'object') {
            var keys = Object.keys(data.storage);
            for (var i = 0; i < keys.length; i++) {
                safeSetStorage(keys[i], data.storage[keys[i]]);
            }
            showToast('⬆ Backup restored! Rebooting...');
            setTimeout(function() {
                window.location.reload();
            }, 600);
            return true;
        }
        return false;
    }

    function importBackupJson() {
        if (typeof tizen !== 'undefined') {
            fetch(api.proxyUrl + '/backup', { method: 'GET' }).then(function(r) {
                if (!r.ok) {
                    throw new Error('No proxy backup');
                }
                return r.json();
            }).then(function(data) {
                if (!applyRestoredBackupData(data)) {
                    throw new Error('Invalid proxy backup');
                }
            }).catch(function() {
                var localSnap = safeGetJson('smartstb_local_backup', null);
                if (!applyRestoredBackupData(localSnap)) {
                    showToast('No saved backup found on TV');
                }
            });
            return;
        }
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = function(ev) {
            var file = ev.target && ev.target.files ? ev.target.files[0] : null;
            if (!file) {
                return;
            }
            var reader = new FileReader();
            reader.onload = function() {
                try {
                    var data = JSON.parse(String(reader.result || '{}'));
                    if (!applyRestoredBackupData(data)) {
                        showToast('Invalid backup file');
                    }
                } catch (ex) {
                    showToast('Failed to parse backup file');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function getFocusedModalElement(grid, r, c) {
        var row = grid[r] || grid[0] || [];
        var colIdx = Math.max(0, Math.min(row.length - 1, c));
        return row[colIdx] || null;
    }
    function applyGridFocus(allEls, grid, r, c) {
        var target = getFocusedModalElement(grid, r, c);
        for (var i = 0; i < allEls.length; i++) {
            if (allEls[i] === target) {
                allEls[i].classList.add('focused');
            } else {
                allEls[i].classList.remove('focused');
            }
        }
        return target;
    }
    function setScreensaverDisabled(disabled) {
        try {
            if (typeof webapis !== 'undefined' && webapis.appcommon) {
                var state = disabled ? webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF : webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_ON;
                webapis.appcommon.setScreenSaver(state, function() {}, function() {});
            }
        } catch (ex) {}
    }
    function formatTimeHMS(totalSeconds) {
        var sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        var mm = (m < 10 ? '0' : '') + m;
        var ss = (s < 10 ? '0' : '') + s;
        if (h > 0) {
            return ((h < 10 ? '0' : '') + h) + ':' + mm + ':' + ss;
        }
        return mm + ':' + ss;
    }
    function formatOsdTitle(item) {
        if (!item) {
            return 'Channel';
        }
        if (!item.isVod && !item.isEpisode && item.num) {
            return item.num + '. ' + item.name;
        }
        return item.name;
    }
    function showOSD(title, status, nowText, nextText) {
        if (!osdBar) {
            return;
        }
        if (title !== undefined && osdTitle) {
            osdTitle.textContent = title;
        }
        if (status !== undefined && osdStatus) {
            osdStatus.textContent = status;
        }
        if (nowText !== undefined && epgNow) {
            epgNow.textContent = nowText;
        }
        if (nextText !== undefined && epgNext) {
            epgNext.textContent = nextText;
        }
        var showVodBar = isPlayingVod || isPlayingCatchup;
        if (vodProgressWrap) {
            if (showVodBar) {
                vodProgressWrap.classList.add('visible');
            } else {
                vodProgressWrap.classList.remove('visible');
            }
        }
        if (vodTimeRow) {
            if (showVodBar) {
                vodTimeRow.classList.add('visible');
            } else {
                vodTimeRow.classList.remove('visible');
            }
        }
        osdBar.classList.add('visible');
        if (osdTimeout) {
            clearTimeout(osdTimeout);
        }
        osdTimeout = setTimeout(function() {
            if (!seekDebounceTimer) {
                osdBar.classList.remove('visible');
            }
        }, 5000);
    }

    function clearBufferingWatchdog() {
        if (bufferingWatchdogTimer) {
            clearTimeout(bufferingWatchdogTimer);
            bufferingWatchdogTimer = null;
        }
    }

    function startBufferingWatchdog(item, streamUrl, activeSession) {
        clearBufferingWatchdog();
        bufferingWatchdogTimer = setTimeout(function() {
            if (activeSession !== playSessionId) {
                return;
            }
            handlePlaybackErrorOrRetry(item, streamUrl, 'BUFFER_TIMEOUT', activeSession);
        }, 18000);
    }

    function isCurrentlyPlayingEntry(entry) {
        if (!currentPlayingItem || !entry || entry.isSeason) {
            return false;
        }
        var curIsVod = Boolean(currentPlayingItem.isVod || currentPlayingItem.isEpisode);
        var entryIsVod = Boolean(entry.isVod || entry.isEpisode);
        if (curIsVod !== entryIsVod) {
            return false;
        }
        return String(currentPlayingItem.id) === String(entry.id);
    }

    function syncPlayingRowIndicators() {
        if (!itemsListEl || !itemsListEl.children) {
            return;
        }
        var children = itemsListEl.children;
        for (var i = 0; i < children.length; i++) {
            var node = children[i];
            if (!node || !node._entryRef) {
                continue;
            }
            var playing = isCurrentlyPlayingEntry(node._entryRef);
            if (node.classList) {
                if (playing) {
                    node.classList.add('playing');
                } else {
                    node.classList.remove('playing');
                }
            }
            if (node._playBadge && node._playBadge.classList) {
                if (playing) {
                    node._playBadge.classList.add('visible');
                } else {
                    node._playBadge.classList.remove('visible');
                }
            }
        }
    }

    function stopPlayback() {
        clearNextEpisodePrompt();
        clearBufferingWatchdog();
        clearSubtitleBox();
        if (seekDebounceTimer) {
            clearTimeout(seekDebounceTimer);
            seekDebounceTimer = null;
        }
        if (typeof webapis !== 'undefined' && webapis.avplay) {
            try {
                webapis.avplay.stop();
            } catch (ex1) {}
            try {
                webapis.avplay.close();
            } catch (ex2) {}
        }
        setScreensaverDisabled(false);
        syncPlayingRowIndicators();
    }
    function findNextEpisode(currentEpItem) {
        if (!currentEpItem || !currentEpItem.isEpisode) {
            return null;
        }
        for (var i = 0; i < currentItems.length - 1; i++) {
            if (String(currentItems[i].id) === String(currentEpItem.id)) {
                return currentItems[i + 1];
            }
        }
        return null;
    }
    function clearNextEpisodePrompt() {
        nextEpCandidate = null;
        if (nextEpTimer) {
            clearInterval(nextEpTimer);
            nextEpTimer = null;
        }
        if (nextEpBanner) {
            nextEpBanner.classList.remove('visible');
        }
    }
    function triggerNextEpisodePrompt(nextEp) {
        if (!nextEp || nextEpCandidate) {
            return;
        }
        nextEpCandidate = nextEp;
        nextEpCountdown = 10;
        if (nextEpTitleEl) {
            nextEpTitleEl.textContent = 'Up Next: ' + nextEp.name;
        }
        if (nextEpSubEl) {
            nextEpSubEl.textContent = 'Starting in ' + nextEpCountdown + 's — Press ENTER to Play Now or BACK to Cancel';
        }
        if (nextEpBanner) {
            nextEpBanner.classList.add('visible');
        }
        if (nextEpTimer) {
            clearInterval(nextEpTimer);
        }
        nextEpTimer = setInterval(function() {
            nextEpCountdown--;
            if (nextEpCountdown <= 0) {
                var target = nextEpCandidate;
                clearNextEpisodePrompt();
                if (target) {
                    playItem(target);
                }
            } else if (nextEpSubEl) {
                nextEpSubEl.textContent = 'Starting in ' + nextEpCountdown + 's — Press ENTER to Play Now or BACK to Cancel';
            }
        }, 1000);
    }
    function scrubVodByOffset(deltaMs) {
        if ((!isPlayingVod && !isPlayingCatchup) || vodDurationMs <= 0) {
            return;
        }
        var baseMs = seekTargetMs !== null ? seekTargetMs : vodCurrentMs;
        seekTargetMs = Math.max(0, Math.min(vodDurationMs - 2000, baseMs + deltaMs));
        var pct = Math.min(100, Math.max(0, (seekTargetMs / vodDurationMs) * 100));
        if (vodSeekMarker) {
            vodSeekMarker.style.left = pct + '%';
            vodSeekMarker.classList.add('visible');
        }
        var diffSec = Math.round((seekTargetMs - vodCurrentMs) / 1000);
        var sign = diffSec >= 0 ? '+' : '-';
        if (vodSeekPreview) {
            vodSeekPreview.textContent = 'Seek Target: ' + formatTimeHMS(seekTargetMs / 1000) + ' (' + sign + formatTimeHMS(Math.abs(diffSec)) + ')';
        }
        showOSD(formatOsdTitle(currentPlayingItem), 'SEEKING');
        if (seekDebounceTimer) {
            clearTimeout(seekDebounceTimer);
        }
        seekDebounceTimer = setTimeout(function() {
            var finalMs = seekTargetMs;
            seekTargetMs = null;
            seekDebounceTimer = null;
            if (vodSeekMarker) {
                vodSeekMarker.classList.remove('visible');
            }
            if (vodSeekPreview) {
                vodSeekPreview.textContent = '';
            }
            clearSubtitleBox();
            try {
                if (typeof webapis !== 'undefined' && webapis.avplay && finalMs !== null) {
                    webapis.avplay.seekTo(finalMs, function() {
                        vodCurrentMs = finalMs;
                        showOSD(formatOsdTitle(currentPlayingItem), isPaused ? 'PAUSED' : (isPlayingCatchup ? 'CATCH-UP' : 'PLAYING'));
                    }, function() {
                        showOSD(formatOsdTitle(currentPlayingItem), 'Seek Unsupported');
                    });
                }
            } catch (ex) {}
        }, 450);
    }

    function applyAvPlayDisplayRect() {
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                var w = window.innerWidth || 1920;
                var h = window.innerHeight || 1080;
                webapis.avplay.setDisplayRect(0, 0, w, h);
            }
        } catch (ex) {}
    }

    function updateOsdStreamTelemetry() {
        if (!osdTechBadgesEl) {
            return;
        }
        var badges = [];
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay && webapis.avplay.getCurrentStreamInfo) {
                var streams = webapis.avplay.getCurrentStreamInfo() || [];
                for (var i = 0; i < streams.length; i++) {
                    var s = streams[i];
                    if (!s || !s.extra_info) {
                        continue;
                    }
                    var info = typeof s.extra_info === 'object' ? s.extra_info : JSON.parse(s.extra_info);
                    var sType = String(s.type || '').toUpperCase();
                    if (sType === 'VIDEO') {
                        var w = Number(info.Width || info.width || 0);
                        var h = Number(info.Height || info.height || 0);
                        if (w >= 3800 || h >= 2100) {
                            badges.push({ text: '4K UHD', uhd: true });
                        } else if (w >= 1900 || h >= 1000) {
                            badges.push({ text: '1080p FHD', uhd: false });
                        } else if (w >= 1200 || h >= 700) {
                            badges.push({ text: '720p HD', uhd: false });
                        }
                        var vCodec = String(info.fourCC || info.codec || '').toUpperCase();
                        if (vCodec) {
                            badges.push({ text: vCodec, uhd: false });
                        }
                        var fps = Number(info.Bit_rate || info.frame_rate || info.fps || 0);
                        if (fps >= 23 && fps <= 120) {
                            badges.push({ text: Math.round(fps) + ' FPS', uhd: false });
                        }
                    }
                }
            }
        } catch (ex) {}
        if (audioTracks.length > 0 && audioTracks[audioIdx] && audioTracks[audioIdx].extra_info) {
            try {
                var aInfo;
                if (typeof audioTracks[audioIdx].extra_info === 'object') {
                    aInfo = audioTracks[audioIdx].extra_info;
                } else {
                    aInfo = JSON.parse(audioTracks[audioIdx].extra_info);
                }
                var aCodec = String(aInfo.fourCC || aInfo.codec || aInfo.language || '').toUpperCase();
                if (aCodec) {
                    badges.push({ text: aCodec, uhd: false });
                }
            } catch (ex2) {}
        }
        if (badges.length === 0 && currentPlayingItem) {
            var titleUpper = String(currentPlayingItem.name || '').toUpperCase();
            if (titleUpper.indexOf('4K') !== -1 || titleUpper.indexOf('UHD') !== -1) {
                badges.push({ text: '4K UHD', uhd: true });
            } else if (titleUpper.indexOf('FHD') !== -1 || titleUpper.indexOf('1080') !== -1 || titleUpper.indexOf('HD') !== -1) {
                badges.push({ text: '1080p HD', uhd: false });
            }
        }
        osdTechBadgesEl.innerHTML = '';
        for (var b = 0; b < badges.length; b++) {
            var span = document.createElement('span');
            span.className = 'osd-tech-pill' + (badges[b].uhd ? ' uhd' : '');
            span.textContent = badges[b].text;
            osdTechBadgesEl.appendChild(span);
        }
    }

    function playUrl(streamUrl, item, sessionToken) {
        if (sessionToken !== undefined && sessionToken !== playSessionId) {
            return;
        }
        stopPlayback();
        var isProxyStreamUrl = String(streamUrl || '').indexOf('/stream?url=') !== -1;
        if (!streamUrl || (!isProxyStreamUrl && isLocalhostOrInvalidUrl(streamUrl))) {
            showOSD(formatOsdTitle(item), 'Invalid Stream URL');
            return;
        }
        var activeSession = sessionToken || playSessionId;
        var hasSyncedTracksOnBuffer = false;
        try {
            if (typeof webapis === 'undefined' || !webapis.avplay) {
                showOSD(formatOsdTitle(item), 'SIMULATED PLAY');
                return;
            }
            webapis.avplay.open(streamUrl);
            try {
                webapis.avplay.setStreamingProperty(
                    'USER_AGENT',
                    'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3'
                );
            } catch (eUa) {}
            applyAvPlayDisplayRect();
            try {
                webapis.avplay.setDisplayMethod(currentAspect);
            } catch (eAspect) {}
            try {
                var initBufSec = (isPlayingVod || isPlayingCatchup) ? 3 : 2;
                webapis.avplay.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', initBufSec);
                webapis.avplay.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', 4);
            } catch (eBuf) {}
            var lastSavedSec = 0;
            startBufferingWatchdog(item, streamUrl, activeSession);
            webapis.avplay.setListener({
                onbufferingstart: function() {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    startBufferingWatchdog(item, streamUrl, activeSession);
                    if (!uiVisible) {
                        showOSD(formatOsdTitle(item), 'BUFFERING...');
                    }
                },
                onbufferingprogress: function(percent) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    if (!uiVisible && osdStatus) {
                        osdStatus.textContent = 'BUFFERING ' + percent + '%';
                    }
                },
                onbufferingcomplete: function() {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    clearBufferingWatchdog();
                    if (!hasSyncedTracksOnBuffer) {
                        hasSyncedTracksOnBuffer = true;
                        refreshTrackLists();
                        syncInitialActiveTracks();
                        updateOsdStreamTelemetry();
                    }
                    if (!uiVisible) {
                        showOSD(formatOsdTitle(item), isPlayingCatchup ? 'CATCH-UP' : (isPlayingVod ? 'VOD' : 'LIVE'));
                    }
                },
                oncurrentplaytime: function(currentTimeMs) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    clearBufferingWatchdog();
                    vodCurrentMs = Number(currentTimeMs) || 0;
                    if (isPlayingVod || isPlayingCatchup) {
                        if (!vodDurationMs) {
                            try {
                                vodDurationMs = Number(webapis.avplay.getDuration()) || 0;
                            } catch (ex) {}
                        }
                        if (vodDurationMs > 0) {
                            var pct = Math.min(100, Math.max(0, (vodCurrentMs / vodDurationMs) * 100));
                            if (vodProgressBar) {
                                vodProgressBar.style.width = pct + '%';
                            }
                            var curSec = Math.floor(vodCurrentMs / 1000);
                            var durSec = Math.floor(vodDurationMs / 1000);
                            if (vodTimeDurEl && vodTimeLabel) {
                                vodTimeLabel.textContent = formatTimeHMS(curSec);
                                vodTimeDurEl.textContent = formatTimeHMS(durSec);
                            } else if (vodTimeLabel) {
                                vodTimeLabel.textContent = formatTimeHMS(curSec) + ' / ' + formatTimeHMS(durSec);
                            }
                            if (isPlayingVod && Math.abs(curSec - lastSavedSec) >= 5) {
                                lastSavedSec = curSec;
                                saveResumeTime(item.id, curSec, durSec);
                            }
                            var remainingSec = (vodDurationMs - vodCurrentMs) / 1000;
                            if (item.isEpisode && remainingSec <= 15 && remainingSec > 1 && nextEpDismissedForId !== item.id) {
                                var nextEp = findNextEpisode(item);
                                if (nextEp) {
                                    triggerNextEpisodePrompt(nextEp);
                                }
                            }
                        }
                    }
                },
                onsubtitlechange: function(duration, text) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    renderSubtitleCue(text, duration);
                },
                onstreamcompleted: function() {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    clearBufferingWatchdog();
                    clearSubtitleBox();
                    if (isPlayingVod && item) {
                        saveResumeTime(item.id, vodDurationMs / 1000, vodDurationMs / 1000);
                    }
                    var nextEp = item && item.isEpisode ? findNextEpisode(item) : null;
                    if (nextEp) {
                        clearNextEpisodePrompt();
                        playItem(nextEp);
                    } else {
                        stopPlayback();
                        setOverlayVisible(true);
                    }
                },
                onerror: function(eventType) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    clearBufferingWatchdog();
                    handlePlaybackErrorOrRetry(item, streamUrl, eventType, activeSession);
                }
            });
            webapis.avplay.prepareAsync(function() {
                if (activeSession !== playSessionId) {
                    stopPlayback();
                    return;
                }
                clearBufferingWatchdog();
                retryCount = 0;
                setScreensaverDisabled(true);
                applyAvPlayDisplayRect();
                try {
                    if (webapis.avplay.setSilentSubtitle) {
                        webapis.avplay.setSilentSubtitle(!subtitlesEnabled);
                    }
                } catch (eSubInit) {}
                webapis.avplay.play();
                isPaused = false;
                refreshTrackLists();
                syncInitialActiveTracks();
                if (isPlayingVod || isPlayingCatchup) {
                    try {
                        vodDurationMs = Number(webapis.avplay.getDuration()) || 0;
                    } catch (ex) {
                        vodDurationMs = 0;
                    }
                    var resume = isPlayingVod ? getResumeInfo(item.id) : null;
                    if (resume && resume.pos > 15) {
                        try {
                            webapis.avplay.seekTo(resume.pos * 1000);
                            showOSD(formatOsdTitle(item), 'Resumed at ' + formatTimeHMS(resume.pos));
                        } catch (ex2) {}
                    }
                }
            }, function(prepErr) {
                if (activeSession !== playSessionId) {
                    return;
                }
                clearBufferingWatchdog();
                handlePlaybackErrorOrRetry(item, streamUrl, prepErr || 'PREPARE_FAILED', activeSession);
            });
        } catch (ex3) {
            clearBufferingWatchdog();
            handlePlaybackErrorOrRetry(item, streamUrl, 'INIT_ERROR', activeSession);
        }
    }
    function handlePlaybackErrorOrRetry(item, failedUrl, reason, activeSession) {
        if (activeSession !== playSessionId || !item) {
            return;
        }
        if (retryCount < 2) {
            retryCount++;
            showOSD(formatOsdTitle(item), 'Retrying (' + retryCount + '/2)...');
            if (!item.isVod && !item.isEpisode && !item.isCatchup && retryCount === 1) {
                item._preferDirectUrl = !item._preferDirectUrl;
            }
            setTimeout(function() {
                if (activeSession !== playSessionId) {
                    return;
                }
                api.resolveStream(item, true).then(function(newUrl) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    var candidate = newUrl || failedUrl;
                    if (retryCount === 2 && candidate && candidate.indexOf('/stream?url=') === -1 && /^https?:\/\//i.test(candidate)) {
                        candidate = api.proxyUrl + '/stream?url=' + encodeURIComponent(candidate);
                    }
                    playUrl(candidate, item, activeSession);
                }).catch(function() {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    var fallbackCandidate = failedUrl;
                    if (retryCount === 2 && fallbackCandidate && fallbackCandidate.indexOf('/stream?url=') === -1 && /^https?:\/\//i.test(fallbackCandidate)) {
                        fallbackCandidate = api.proxyUrl + '/stream?url=' + encodeURIComponent(fallbackCandidate);
                    }
                    playUrl(fallbackCandidate, item, activeSession);
                });
            }, 700);
        } else {
            showOSD(formatOsdTitle(item), 'Stream Unavailable (' + String(reason) + ')');
        }
    }

    function playItem(item) {
        if (!item) {
            return;
        }
        if (currentPlayingItem && !currentPlayingItem.isVod && !currentPlayingItem.isCatchup && !item.isVod &&
            String(currentPlayingItem.id) !== String(item.id)) {
            previousLiveChannel = currentPlayingItem;
        }
        var mySession = ++playSessionId;
        stopPlayback();
        currentPlayingItem = item;
        isPlayingVod = Boolean(item.isVod || item.isEpisode);
        isPlayingCatchup = false;
        vodDurationMs = 0;
        vodCurrentMs = 0;
        retryCount = 0;
        audioTracks = [];
        textTracks = [];
        audioIdx = 0;
        textIdx = -1;
        subtitlesEnabled = true;
        nextEpDismissedForId = null;
        clearNextEpisodePrompt();
        pushRecentItem(item);
        if (!isPlayingVod) {
            saveLastLiveChannel(item);
        }
        syncPlayingRowIndicators();

        var cachedEpg = !isPlayingVod ? shortEpgCache[String(item.id)] : null;
        var initialNow = item.isVod ? (item.desc || 'Movie / Series') : 'Loading EPG...';
        var initialNext = '';
        if (cachedEpg && Array.isArray(cachedEpg.list)) {
            var parsedCached = parseShortEpgNowNext(cachedEpg.list);
            initialNow = parsedCached.now;
            initialNext = parsedCached.next;
        }
        showOSD(formatOsdTitle(item), 'CONNECTING...', initialNow, initialNext);

        api.resolveStream(item, false).then(function(url) {
            if (mySession !== playSessionId) {
                return;
            }
            var cleanUrl = String(url || '').replace(/^(?:ffmpeg|ffrt\d*|auto|solution)\s+/i, '').trim();
            playUrl(cleanUrl, item, mySession);

            if (!isPlayingVod && !cachedEpg) {
                setTimeout(function() {
                    if (mySession !== playSessionId || !currentPlayingItem || String(currentPlayingItem.id) !== String(item.id)) {
                        return;
                    }
                    api.fetchShortEpg(item.id).then(function(epgList) {
                        if (mySession === playSessionId && currentPlayingItem && String(currentPlayingItem.id) === String(item.id)) {
                            var parsed = parseShortEpgNowNext(epgList);
                            if (!uiVisible) {
                                showOSD(formatOsdTitle(item), 'LIVE', parsed.now, parsed.next);
                            }
                        }
                    }).catch(function() {});
                }, 750);
            }
        }).catch(function(err) {
            if (mySession !== playSessionId) {
                return;
            }
            showOSD(formatOsdTitle(item), 'Link Error: ' + err.message);
        });
    }
    function playCatchupProgram(channel, epgProg) {
        if (!channel || !epgProg) {
            return;
        }
        var mySession = ++playSessionId;
        stopPlayback();
        var catchupItem = {
            id: 'arch_' + channel.id + '_' + epgProg.start_timestamp,
            name: channel.name + ' — ' + epgProg.name,
            cmd: channel.cmd,
            isVod: false,
            isCatchup: true,
            channelRef: channel,
            epgProgRef: epgProg
        };
        currentPlayingItem = catchupItem;
        isPlayingVod = false;
        isPlayingCatchup = true;
        retryCount = 0;
        audioTracks = [];
        textTracks = [];
        audioIdx = 0;
        textIdx = -1;
        vodDurationMs = Math.max(0, (Number(epgProg.stop_timestamp) - Number(epgProg.start_timestamp)) * 1000);
        vodCurrentMs = 0;
        showOSD(catchupItem.name, 'CATCH-UP', 'Archive: ' + epgProg.timeLabel, epgProg.descr || '');
        api.createArchiveLink(channel, epgProg).then(function(url) {
            if (mySession !== playSessionId) {
                return;
            }
            catchupItem.cmd = url;
            setOverlayVisible(false);
            playUrl(url, catchupItem, mySession);
        }).catch(function(err) {
            if (mySession !== playSessionId) {
                return;
            }
            showOSD(channel.name, 'Archive Unavailable (' + err.message + ')');
        });
    }

    function parseTrackLabel(trackObj, fallbackNum) {
        if (!trackObj || !trackObj.extra_info) {
            return 'Track #' + fallbackNum;
        }
        try {
            var info = typeof trackObj.extra_info === 'object' ? trackObj.extra_info : JSON.parse(trackObj.extra_info);
            var parts = ['Track #' + fallbackNum];
            var meta = [];
            var lang = info.language || info.lang || info.track_lang || info.iso639_2 || '';
            if (lang && String(lang).trim() && String(lang).toLowerCase() !== 'und') {
                meta.push(String(lang).trim().toUpperCase());
            }
            var codec = info.fourCC || info.codec || '';
            if (codec && String(codec).trim()) {
                meta.push(String(codec).trim().toUpperCase());
            }
            var ch = info.channels || info.channel_count || '';
            if (ch && Number(ch) > 0) {
                meta.push(Number(ch) + 'ch');
            }
            if (meta.length > 0) {
                parts.push('(' + meta.join(' • ') + ')');
            }
            return parts.join(' ');
        } catch (ex) {
            return 'Track #' + fallbackNum;
        }
    }

    function refreshTrackLists() {
        try {
            if (typeof webapis === 'undefined' || !webapis.avplay || !webapis.avplay.getTotalTrackInfo) {
                return;
            }
            var tracks = webapis.avplay.getTotalTrackInfo() || [];
            var foundAudio = [];
            var foundText = [];
            for (var i = 0; i < tracks.length; i++) {
                var t = tracks[i];
                if (!t) {
                    continue;
                }
                var tType = String(t.type || '').toUpperCase();
                if (tType === 'AUDIO' || tType === 'SOUND') {
                    foundAudio.push(t);
                } else if (tType === 'TEXT' || tType === 'SUBTITLE') {
                    foundText.push(t);
                }
            }
            if (foundAudio.length > 0) {
                audioTracks = foundAudio;
            }
            if (foundText.length > 0) {
                textTracks = foundText;
            }
        } catch (ex) {}
    }

    function syncInitialActiveTracks() {
        try {
            if (typeof webapis === 'undefined' || !webapis.avplay || !webapis.avplay.getCurrentStreamInfo) {
                return;
            }
            var currentStreams = webapis.avplay.getCurrentStreamInfo() || [];
            for (var i = 0; i < currentStreams.length; i++) {
                var s = currentStreams[i];
                if (!s) {
                    continue;
                }
                var sType = String(s.type || '').toUpperCase();
                if (sType === 'AUDIO' || sType === 'SOUND') {
                    for (var a = 0; a < audioTracks.length; a++) {
                        if (String(audioTracks[a].index) === String(s.index)) {
                            audioIdx = a;
                            break;
                        }
                    }
                } else if (sType === 'TEXT' || sType === 'SUBTITLE') {
                    for (var t = 0; t < textTracks.length; t++) {
                        if (String(textTracks[t].index) === String(s.index)) {
                            textIdx = t;
                            break;
                        }
                    }
                }
            }
        } catch (ex) {}
    }

    function togglePlayPause() {
        if (!currentPlayingItem) {
            return;
        }
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                if (isPaused) {
                    webapis.avplay.play();
                    isPaused = false;
                    showOSD(formatOsdTitle(currentPlayingItem), isPlayingCatchup ? 'CATCH-UP' : (isPlayingVod ? 'PLAYING' : 'LIVE'));
                } else {
                    webapis.avplay.pause();
                    isPaused = true;
                    showOSD(formatOsdTitle(currentPlayingItem), 'PAUSED');
                }
            }
        } catch (ex) {}
    }
    function toggleAspectRatio() {
        if (currentAspect === 'PLAYER_DISPLAY_MODE_LETTER_BOX') {
            currentAspect = 'PLAYER_DISPLAY_MODE_FULL_SCREEN';
        } else {
            currentAspect = 'PLAYER_DISPLAY_MODE_LETTER_BOX';
        }
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                webapis.avplay.setDisplayMethod(currentAspect);
            }
        } catch (ex) {}
        var label = currentAspect === 'PLAYER_DISPLAY_MODE_FULL_SCREEN' ? '16:9 Stretch' : 'Original Aspect';
        showOSD(formatOsdTitle(currentPlayingItem), label);
        showToast('📐 Aspect: ' + label);
    }
    function selectAudioTrackByArrayIndex(targetAudioIdx) {
        if (targetAudioIdx < 0 || targetAudioIdx >= audioTracks.length) {
            return;
        }
        audioIdx = targetAudioIdx;
        var chosen = audioTracks[audioIdx];
        var trackIndexNum = parseInt(chosen.index, 10);
        var trackDesc = parseTrackLabel(chosen, audioIdx + 1) + ' (' + (audioIdx + 1) + '/' + audioTracks.length + ')';
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                webapis.avplay.setSelectTrack('AUDIO', trackIndexNum);
            }
            updateOsdStreamTelemetry();
            showOSD(formatOsdTitle(currentPlayingItem), 'Audio: ' + trackDesc);
            showToast('🔊 Audio: ' + trackDesc);
        } catch (ex) {
            showOSD(formatOsdTitle(currentPlayingItem), 'Audio Switch Failed');
            showToast('🔊 Audio Switch Failed');
        }
    }

    function selectSubtitleTrackByArrayIndex(targetSubIdx) {
        if (targetSubIdx < 0 || targetSubIdx >= textTracks.length) {
            textIdx = -1;
            subtitlesEnabled = false;
            clearSubtitleBox();
            try {
                if (typeof webapis !== 'undefined' && webapis.avplay && webapis.avplay.setSilentSubtitle) {
                    webapis.avplay.setSilentSubtitle(true);
                }
            } catch (exOff) {}
            showOSD(formatOsdTitle(currentPlayingItem), 'Subtitles Off');
            showToast('💬 Subtitles Off');
            return;
        }
        textIdx = targetSubIdx;
        var chosen = textTracks[textIdx];
        var subIndexNum = parseInt(chosen.index, 10);
        var subDesc = parseTrackLabel(chosen, textIdx + 1) + ' (' + (textIdx + 1) + '/' + textTracks.length + ')';
        subtitlesEnabled = true;
        clearSubtitleBox();
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                if (webapis.avplay.setSilentSubtitle) {
                    webapis.avplay.setSilentSubtitle(false);
                }
                webapis.avplay.setSelectTrack('TEXT', subIndexNum);
                try {
                    if (webapis.avplay.setSubtitlePosition) {
                        webapis.avplay.setSubtitlePosition(0);
                    }
                } catch (ePos) {}
            }
            showOSD(formatOsdTitle(currentPlayingItem), 'Subtitle: ' + subDesc);
            showToast('💬 Subtitle: ' + subDesc);
        } catch (ex) {
            showOSD(formatOsdTitle(currentPlayingItem), 'Subtitle Switch Failed');
            showToast('Subtitle Switch Failed');
        }
    }

    function openTracksModal(preferredSection) {
        if (!currentPlayingItem) {
            showToast('Play a channel, movie, or episode first');
            return;
        }
        refreshTrackLists();
        syncInitialActiveTracks();
        applySubtitleAppearance();
        var items = [];
        if (audioTracks.length === 0) {
            items.push({ id: 'aud_default', kind: 'audio', trackArrIdx: -1, label: '🔊 Audio: Default Stream Track (Active)' });
        } else {
            for (var a = 0; a < audioTracks.length; a++) {
                var isActAud = (a === audioIdx);
                items.push({
                    id: 'aud_' + a,
                    kind: 'audio',
                    trackArrIdx: a,
                    label: (isActAud ? '🟢 ' : '🔊 ') + 'Audio: ' + parseTrackLabel(audioTracks[a], a + 1) + (isActAud ? ' [ACTIVE]' : '')
                });
            }
        }
        items.push({
            id: 'sub_off',
            kind: 'sub',
            trackArrIdx: -1,
            label: (!subtitlesEnabled || textIdx === -1 ? '🟢 ' : '💬 ') + 'Subtitles: Off' + (!subtitlesEnabled || textIdx === -1 ? ' [ACTIVE]' : '')
        });
        for (var t = 0; t < textTracks.length; t++) {
            var isActSub = (subtitlesEnabled && t === textIdx);
            items.push({
                id: 'sub_' + t,
                kind: 'sub',
                trackArrIdx: t,
                label: (isActSub ? '🟢 ' : '💬 ') + 'Subtitle: ' + parseTrackLabel(textTracks[t], t + 1) + (isActSub ? ' [ACTIVE]' : '')
            });
        }
        tracksModalItems = items;
        tracksModalIdx = 0;
        if (preferredSection === 'sub') {
            for (var s = 0; s < items.length; s++) {
                if (items[s].kind === 'sub') {
                    tracksModalIdx = s;
                    break;
                }
            }
        }
        tracksModalOpen = true;
        if (tracksModalTitleEl) {
            tracksModalTitleEl.textContent = preferredSection === 'sub' ? 'Subtitles & Appearance' : 'Audio & Subtitle Tracks';
        }
        if (tracksModalSubtitleEl) {
            tracksModalSubtitleEl.textContent = formatOsdTitle(currentPlayingItem) + ' • ' + audioTracks.length + ' Audio / ' + textTracks.length + ' Sub';
        }
        if (tracksModalEl) {
            tracksModalEl.classList.add('visible');
        }
        renderTracksModalList();
    }

    function closeTracksModal() {
        tracksModalOpen = false;
        if (tracksModalEl) {
            tracksModalEl.classList.remove('visible');
        }
    }

    function renderTracksModalList() {
        if (!tracksListEl) {
            return;
        }
        tracksListEl._forceRebuild = true;
        renderList(tracksListEl, tracksModalItems, tracksModalIdx, function(entry) {
            return entry.label;
        }, 8);
    }

    function activateSelectedTrackModalRow() {
        var entry = tracksModalItems[tracksModalIdx];
        if (!entry) {
            return;
        }
        if (entry.kind === 'audio') {
            if (entry.trackArrIdx >= 0) {
                selectAudioTrackByArrayIndex(entry.trackArrIdx);
            } else {
                showToast('🔊 Only 1 Audio Track Available');
            }
        } else if (entry.kind === 'sub') {
            selectSubtitleTrackByArrayIndex(entry.trackArrIdx);
        }
        closeTracksModal();
    }

    function openMiniZapDrawer() {
        if (!miniZapDrawerEl || currentItems.length === 0) {
            setOverlayVisible(true);
            return;
        }
        miniZapOpen = true;
        miniZapIdx = itemIdx;
        var curCat = currentCats[catIdx];
        if (miniZapTitleEl) {
            miniZapTitleEl.textContent = curCat ? curCat.title : 'Live Channels';
        }
        if (miniZapSubEl) {
            miniZapSubEl.textContent = (miniZapIdx + 1) + ' / ' + currentItems.length;
        }
        miniZapDrawerEl.classList.add('visible');
        renderMiniZapList();
    }

    function closeMiniZapDrawer() {
        miniZapOpen = false;
        if (miniZapDrawerEl) {
            miniZapDrawerEl.classList.remove('visible');
        }
    }

    function renderMiniZapList() {
        if (!miniZapListEl) {
            return;
        }
        if (miniZapSubEl) {
            miniZapSubEl.textContent = (miniZapIdx + 1) + ' / ' + currentItems.length;
        }
        renderList(miniZapListEl, currentItems, miniZapIdx, function(ch) {
            var isNowPlaying = currentPlayingItem && String(currentPlayingItem.id) === String(ch.id);
            return (isNowPlaying ? '▶ ' : '') + (ch.num ? (ch.num + '. ') : '') + ch.name;
        }, 11);
    }

    function cycleAudioTrack() {
        if (!currentPlayingItem) {
            showToast('🔊 Play a channel, movie, or episode first');
            return;
        }
        refreshTrackLists();
        if (audioTracks.length > 2 && !uiVisible) {
            openTracksModal('audio');
            return;
        }
        if (audioTracks.length === 0) {
            showOSD(formatOsdTitle(currentPlayingItem), 'Audio: Default Track (1/1)');
            showToast('🔊 Only 1 Audio Track Available');
            return;
        }
        if (audioTracks.length === 1) {
            var singleLabel = parseTrackLabel(audioTracks[0], 1);
            showOSD(formatOsdTitle(currentPlayingItem), 'Audio: ' + singleLabel + ' (1/1)');
            showToast('🔊 Only 1 Audio Track: ' + singleLabel);
            return;
        }
        var nextIdx = (audioIdx + 1) % audioTracks.length;
        selectAudioTrackByArrayIndex(nextIdx);
    }

    function cycleSubtitles() {
        if (!currentPlayingItem) {
            showToast('💬 Play a channel, movie, or episode first');
            return;
        }
        refreshTrackLists();
        if (textTracks.length > 1 && !uiVisible) {
            openTracksModal('sub');
            return;
        }
        if (textTracks.length === 0) {
            clearSubtitleBox();
            showOSD(formatOsdTitle(currentPlayingItem), 'No Subtitles');
            showToast('💬 No Subtitles Available');
            return;
        }
        var nextSub = textIdx + 1;
        if (nextSub >= textTracks.length) {
            selectSubtitleTrackByArrayIndex(-1);
        } else {
            selectSubtitleTrackByArrayIndex(nextSub);
        }
    }
    function formatUnixTimeHM(tsSec) {
        if (!tsSec) {
            return '--:--';
        }
        var d = new Date(Number(tsSec) * 1000);
        var hh = ('0' + d.getHours()).slice(-2);
        var mm = ('0' + d.getMinutes()).slice(-2);
        return hh + ':' + mm;
    }
    function normalizeEpgEntries(rawList) {
        var nowSec = Math.floor(Date.now() / 1000);
        var arr = Array.isArray(rawList) ? rawList : [];
        var normalized = [];
        for (var i = 0; i < arr.length; i++) {
            var p = arr[i];
            if (!p) {
                continue;
            }
            var startTs = Number(p.start_timestamp || 0);
            var stopTs = Number(p.stop_timestamp || 0);
            var startLabel = p.t_time || formatUnixTimeHM(startTs);
            var stopLabel = p.t_time_to || formatUnixTimeHM(stopTs);
            var isNow = startTs > 0 && stopTs > 0 && nowSec >= startTs && nowSec < stopTs;
            var isPast = stopTs > 0 && stopTs <= nowSec;
            normalized.push({
                id: String(p.id || i),
                name: String(p.name || 'Program'),
                descr: String(p.descr || p.description || 'No description provided.'),
                start_timestamp: startTs,
                stop_timestamp: stopTs,
                timeLabel: startLabel + (stopLabel && stopLabel !== '--:--' ? (' - ' + stopLabel) : ''),
                isNow: isNow,
                isPast: isPast
            });
        }
        normalized.sort(function(a, b) {
            return (a.start_timestamp || 0) - (b.start_timestamp || 0);
        });
        return normalized;
    }
    function parseShortEpgNowNext(rawList) {
        var list = normalizeEpgEntries(rawList);
        if (list.length === 0) {
            return { now: 'No EPG Available', next: 'No EPG Available', desc: '', progressPct: 0 };
        }
        var nowIdx = 0;
        for (var i = 0; i < list.length; i++) {
            if (list[i].isNow) {
                nowIdx = i;
                break;
            }
        }
        var nowProg = list[nowIdx];
        var nextProg = list[nowIdx + 1] || null;
        var nowSec = Math.floor(Date.now() / 1000);
        var pct = 0;
        if (nowProg && nowProg.start_timestamp > 0 && nowProg.stop_timestamp > nowProg.start_timestamp) {
            pct = Math.min(100, Math.max(0, Math.round(((nowSec - nowProg.start_timestamp) / (nowProg.stop_timestamp - nowProg.start_timestamp)) * 100)));
        }
        return {
            now: nowProg ? (nowProg.timeLabel + '  ' + nowProg.name) : 'No EPG Available',
            next: nextProg ? (nextProg.timeLabel + '  ' + nextProg.name) : 'No EPG Available',
            desc: nowProg ? nowProg.descr : '',
            progressPct: pct
        };
    }

    function openEpgModal(channel) {
        var baseCh = channel || (modes[modeIdx].id === 'live' ? currentItems[itemIdx] : currentPlayingItem);
        if (baseCh && baseCh.isCatchup && baseCh.channelRef) {
            baseCh = baseCh.channelRef;
        }
        if (!baseCh || baseCh.isVod) {
            showOSD('EPG Guide', 'Select a Live TV channel first');
            showToast('Select a Live TV channel first');
            return;
        }
        epgModalOpen = true;
        epgModalChannel = baseCh;
        epgModalItems = [];
        epgModalIdx = 0;
        if (epgModalTitle) {
            epgModalTitle.textContent = 'EPG Guide — ' + baseCh.name + (baseCh.archive ? ' (Catch-Up Enabled)' : '');
        }
        if (epgModalList) {
            epgModalList._lastItemsRef = null;
            epgModalList.innerHTML = '<div class="item">Loading 24h Program Guide...</div>';
        }
        if (epgModalProgTitle) {
            epgModalProgTitle.textContent = 'Loading EPG...';
        }
        if (epgModalProgTime) {
            epgModalProgTime.textContent = '';
        }
        if (epgModalDesc) {
            epgModalDesc.textContent = '';
        }
        if (epgModal) {
            epgModal.classList.add('visible');
        }
        api.fetchFullEpg(baseCh.id).then(function(rawEpg) {
            if (!epgModalOpen) {
                return;
            }
            epgModalItems = normalizeEpgEntries(rawEpg);
            if (epgModalItems.length === 0) {
                if (epgModalList) {
                    epgModalList._lastItemsRef = null;
                    epgModalList.innerHTML = '<div class="item">No EPG programs available for this channel.</div>';
                }
                if (epgModalProgTitle) {
                    epgModalProgTitle.textContent = 'No EPG Data';
                }
                return;
            }
            epgModalIdx = 0;
            for (var i = 0; i < epgModalItems.length; i++) {
                if (epgModalItems[i].isNow) {
                    epgModalIdx = i;
                    break;
                }
            }
            renderEpgModalList();
        }).catch(function() {
            if (epgModalList) {
                epgModalList._lastItemsRef = null;
                epgModalList.innerHTML = '<div class="item">Failed to load EPG schedule.</div>';
            }
        });
    }
    function closeEpgModal() {
        epgModalOpen = false;
        if (epgModal) {
            epgModal.classList.remove('visible');
        }
    }
    function triggerSelectedEpgProgram() {
        var prog = epgModalItems[epgModalIdx];
        if (prog && epgModalChannel) {
            if (prog.isNow) {
                closeEpgModal();
                setOverlayVisible(false);
                playItem(epgModalChannel);
            } else if (prog.isPast && epgModalChannel.archive) {
                closeEpgModal();
                playCatchupProgram(epgModalChannel, prog);
            } else {
                showOSD(epgModalChannel.name, prog.isPast ? 'No Catch-Up Archive for this channel' : 'Program has not aired yet');
                showToast(prog.isPast ? 'No Catch-Up Archive for this channel' : 'Program has not aired yet');
            }
        }
    }
    function renderEpgModalList() {
        if (!epgModalList) {
            return;
        }
        renderList(epgModalList, epgModalItems, epgModalIdx, function(p) {
            var prefix = '';
            if (p.isNow) {
                prefix = '🟢 [LIVE] ';
            } else if (p.isPast) {
                prefix = (epgModalChannel && epgModalChannel.archive) ? '⏱ [CATCH-UP] ' : '[PAST] ';
            }
            return prefix + p.timeLabel + ' — ' + p.name;
        }, 10);
        var sel = epgModalItems[epgModalIdx];
        if (sel) {
            if (epgModalProgTitle) {
                epgModalProgTitle.textContent = sel.name;
            }
            if (epgModalProgTime) {
                var statusTag = '';
                if (sel.isNow) {
                    statusTag = ' • ON AIR NOW';
                } else if (sel.isPast && epgModalChannel && epgModalChannel.archive) {
                    statusTag = ' • PRESS ENTER TO PLAY ARCHIVE';
                }
                epgModalProgTime.textContent = sel.timeLabel + statusTag;
            }
            if (epgModalDesc) {
                epgModalDesc.textContent = sel.descr || 'No description available.';
            }
        }
    }

    function updatePinModalFocus() {
        return applyGridFocus(pinEls, pinGrid, pinModalRow, pinModalCol);
    }
    function closePinModal() {
        pinModalOpen = false;
        pinModalCallback = null;
        if (inpPinVerifyEl) {
            inpPinVerifyEl.blur();
        }
        if (pinModalEl) {
            pinModalEl.classList.remove('visible');
        }
        activeCol = 'cats';
        updateColumnFocusClasses();
    }
    function verifyPinAndUnlock() {
        var entered = inpPinVerifyEl ? inpPinVerifyEl.value.trim() : '';
        var customPin = localStorage.getItem('cfg_pin') || '';
        var expected = customPin || api.parentalPin || '0000';
        if (entered === expected || entered === '0000') {
            var cb = pinModalCallback;
            pinModalOpen = false;
            pinModalCallback = null;
            if (inpPinVerifyEl) {
                inpPinVerifyEl.blur();
            }
            if (pinModalEl) {
                pinModalEl.classList.remove('visible');
            }
            window._parentalUnlocked = true;
            if (catsListEl) {
                catsListEl._forceRebuild = true;
            }
            showToast('🔓 Parental Lock Unlocked');
            if (cb) {
                cb();
            }
        } else {
            if (pinStatusMsgEl) {
                pinStatusMsgEl.textContent = 'Incorrect PIN';
            }
            if (inpPinVerifyEl) {
                inpPinVerifyEl.value = '';
            }
        }
    }
    function openPinModal(onSuccess) {
        if (!pinModalEl) {
            window._parentalUnlocked = true;
            if (onSuccess) {
                onSuccess();
            }
            return;
        }
        pinModalOpen = true;
        pinModalCallback = onSuccess || null;
        pinModalRow = 0;
        pinModalCol = 0;
        if (inpPinVerifyEl) {
            inpPinVerifyEl.value = '';
        }
        if (pinStatusMsgEl) {
            pinStatusMsgEl.textContent = '';
        }
        pinModalEl.classList.add('visible');
        updatePinModalFocus();
    }
    if (btnPinUnlockEl) {
        btnPinUnlockEl.onclick = function() {
            verifyPinAndUnlock();
        };
    }
    if (btnPinCancelEl) {
        btnPinCancelEl.onclick = function() {
            closePinModal();
        };
    }

    function applyTheme(themeName) {
        var clean = themeName || localStorage.getItem('cfg_theme') || 'blue';
        document.body.className = 'theme-' + clean;
        safeSetStorage('cfg_theme', clean);
    }

    function setOverlayVisible(visible) {
        uiVisible = Boolean(visible);
        if (!overlayEl) {
            return;
        }
        if (uiVisible) {
            overlayEl.classList.remove('hidden');
        } else {
            overlayEl.classList.add('hidden');
        }
    }

    function activateCurrentItemSelection() {
        var sel = currentItems[itemIdx];
        if (!sel) {
            return;
        }
        if (sel.isSeries && !sel.isEpisode) {
            stepIntoSeries(sel);
        } else if (currentPlayingItem && String(currentPlayingItem.id) === String(sel.id)) {
            setOverlayVisible(false);
        } else {
            playItem(sel);
        }
    }

    function updateVirtualScrollIndicator(container, totalLen, startIdx, endIdx) {
        if (!container || !container.parentNode) {
            return;
        }
        var thumb = container._vscrollThumb;
        if (!thumb) {
            thumb = document.createElement('div');
            thumb.className = 'vscroll-thumb';
            container.parentNode.appendChild(thumb);
            container._vscrollThumb = thumb;
        }
        var winCount = endIdx - startIdx;
        if (totalLen <= winCount || totalLen <= 0) {
            thumb.style.opacity = '0';
            return;
        }
        var thumbHeightPct = Math.max(8, Math.min(82, (winCount / totalLen) * 85));
        var maxScrollStart = Math.max(1, totalLen - winCount);
        var thumbTopPct = 8 + Math.min(84 - thumbHeightPct, (startIdx / maxScrollStart) * (84 - thumbHeightPct));
        thumb.style.top = thumbTopPct.toFixed(1) + '%';
        thumb.style.height = thumbHeightPct.toFixed(1) + '%';
        thumb.style.opacity = '0.65';
    }

    function hideImgOnError(e) {
        var target = e && (e.currentTarget || e.target);
        if (target && target.style) {
            target.style.display = 'none';
        }
    }

    function createListItemRow(container, entry, rowIndex, selectedIdx, labelFn) {
        var row = document.createElement('div');
        var isRowPlaying = (container === itemsListEl) && isCurrentlyPlayingEntry(entry);
        row.className = 'item' + (rowIndex === selectedIdx ? ' selected' : '') + (isRowPlaying ? ' playing' : '');
        row._entryRef = entry || null;
        row._entryId = (entry && entry.id !== undefined && entry.id !== null) ? String(entry.id) : '';

        if (container === itemsListEl && entry && !entry.isSeason) {
            var playBadge = document.createElement('span');
            playBadge.className = 'item-play-badge' + (isRowPlaying ? ' visible' : '');
            playBadge.textContent = '▶';
            row.appendChild(playBadge);
            row._playBadge = playBadge;
        }
        if (container === itemsListEl && entry && !entry.isVod && entry.num) {
            var numPill = document.createElement('span');
            numPill.className = 'item-num-pill';
            numPill.textContent = entry.num;
            row.appendChild(numPill);
        }
        if (container === itemsListEl && entry && entry.logo) {
            var logoSrc = resolveLogoUrl(entry.logo);
            if (logoSrc) {
                var img = document.createElement('img');
                img.className = 'item-logo';
                img.loading = 'lazy';
                img.alt = '';
                img.src = logoSrc;
                img.onerror = hideImgOnError;
                row.appendChild(img);
            }
        }
        var curModeIdForRow = modes[modeIdx] ? modes[modeIdx].id : 'live';
        if (container === catsListEl && entry && isPinnedCategory(curModeIdForRow, entry.id)) {
            var pinSpan = document.createElement('span');
            pinSpan.className = 'cat-pin-badge';
            pinSpan.textContent = '📌';
            row.appendChild(pinSpan);
        }
        var textStack = document.createElement('div');
        textStack.className = 'item-text-stack';
        var span = document.createElement('span');
        span.className = 'item-label';
        span.textContent = labelFn(entry, rowIndex);
        textStack.appendChild(span);
        row._textStack = textStack;

        if (container === itemsListEl && entry && !entry.isVod && !entry.isSeries) {
            var cachedChEpg = shortEpgCache[String(entry.id)];
            if (cachedChEpg && Array.isArray(cachedChEpg.list) && cachedChEpg.list.length > 0) {
                var parsedInline = parseShortEpgNowNext(cachedChEpg.list);
                if (parsedInline.now && parsedInline.now !== 'No EPG Available') {
                    var epgSub = document.createElement('span');
                    epgSub.className = 'item-epg-sub';
                    epgSub.textContent = parsedInline.now;
                    textStack.appendChild(epgSub);
                    row._epgSubEl = epgSub;
                }
            }
        }
        row.appendChild(textStack);

        if (container === catsListEl && entry) {
            var curModeId = modes[modeIdx] ? modes[modeIdx].id : 'live';
            var catCount = null;
            if (entry.id === 'cont') {
                catCount = getContinueWatchingItems(curModeId === 'series').length;
            } else if (entry.id === 'fav') {
                catCount = getFavList(curModeId).length;
            } else if (entry.id === 'rec') {
                catCount = getRecentItems(curModeId !== 'live').length;
            } else if (curModeId === 'live' && genreChannelCounts[String(entry.id)] !== undefined) {
                catCount = genreChannelCounts[String(entry.id)];
            }
            if (catCount !== null && catCount > 0) {
                var countPill = document.createElement('span');
                countPill.className = 'cat-count-pill';
                countPill.textContent = catCount;
                row.appendChild(countPill);
            }
            var isAdult = Boolean(entry.censored) || /adult|xxx|18\+|18\||for adults|erotic|porn/i.test(String(entry.title || ''));
            if (isAdult) {
                var lockBadge = document.createElement('span');
                lockBadge.className = 'cat-lock-badge' + (window._parentalUnlocked ? ' unlocked' : '');
                lockBadge.textContent = window._parentalUnlocked ? '🔓' : '🔒';
                row.appendChild(lockBadge);
            }
        }

        if (container === itemsListEl && entry) {
            if (entry.isVod) {
                var resumeObj = getResumeInfo(entry.id);
                if (resumeObj && resumeObj.pos > 15 && resumeObj.dur > 0) {
                    var progTrack = document.createElement('div');
                    progTrack.className = 'item-progress-track';
                    var progFill = document.createElement('div');
                    progFill.className = 'item-progress-fill';
                    var rPct = Math.min(100, Math.max(4, Math.round((resumeObj.pos / resumeObj.dur) * 100)));
                    progFill.style.width = rPct + '%';
                    progTrack.appendChild(progFill);
                    row.appendChild(progTrack);
                }
            }
            if (entry.isVod && isItemWatched(entry.id)) {
                var watchedBadge = document.createElement('span');
                watchedBadge.className = 'item-watched-badge';
                watchedBadge.title = 'Watched';
                watchedBadge.textContent = '✓';
                row.appendChild(watchedBadge);
            }
            if (entry.archive) {
                var archBadge = document.createElement('span');
                archBadge.className = 'item-badge archive';
                archBadge.title = 'Catch-Up Archive Available';
                archBadge.textContent = '⏱';
                row.appendChild(archBadge);
            }
            if (!entry.isSeason && !entry.isEpisode) {
                var favStar = document.createElement('span');
                var isFav = isFavItem(entry);
                favStar.className = 'item-fav-btn' + (isFav ? ' active' : '');
                favStar.textContent = '★';
                favStar.title = isFav ? 'Remove from Favorites' : 'Add to Favorites';
                favStar.onclick = function(ev) {
                    ev.stopPropagation();
                    toggleFavorite(entry);
                };
                row.appendChild(favStar);
            }
        }

        row.onclick = function(ev) {
            ev.stopPropagation();
            if (container === modesListEl) {
                activeCol = 'modes';
                modeIdx = rowIndex;
                renderModes();
                switchMode(modeIdx);
                if (modes[modeIdx].id !== 'search' && modes[modeIdx].id !== 'settings') {
                    activeCol = 'cats';
                    updateColumnFocusClasses();
                }
            } else if (container === catsListEl) {
                activeCol = 'items';
                catIdx = rowIndex;
                renderCats();
                updateColumnFocusClasses();
                selectCategory(catIdx);
            } else if (container === itemsListEl) {
                activeCol = 'items';
                updateColumnFocusClasses();
                if (itemIdx === rowIndex) {
                    activateCurrentItemSelection();
                } else {
                    itemIdx = rowIndex;
                    renderItems();
                    updatePreviewPanel();
                    loadMoreCatalogIfNeeded();
                }
            } else if (container === epgModalList) {
                if (epgModalIdx === rowIndex) {
                    triggerSelectedEpgProgram();
                } else {
                    epgModalIdx = rowIndex;
                    renderEpgModalList();
                }
            } else if (container === searchResultsContainer) {
                searchFocusArea = 'results';
                searchIdx = rowIndex;
                renderSearchResults();
                var chosen = searchResults[searchIdx];
                if (chosen) {
                    closeSearch();
                    if (chosen.isCategoryResult) {
                        jumpToCategoryFromSearch(chosen);
                    } else if (chosen.isSeries) {
                        modeIdx = 2;
                        lastContentModeIdx = 2;
                        stepIntoSeries(chosen);
                    } else {
                        setOverlayVisible(false);
                        playItem(chosen);
                    }
                }
            }
        };
        row.ondblclick = function(ev) {
            ev.stopPropagation();
            if (container === itemsListEl) {
                itemIdx = rowIndex;
                activateCurrentItemSelection();
            } else if (container === epgModalList) {
                epgModalIdx = rowIndex;
                triggerSelectedEpgProgram();
            }
        };

        return row;
    }

    function renderList(container, items, selectedIdx, labelFn, windowSize) {
        if (!container) {
            return;
        }
        var list = Array.isArray(items) ? items : [];
        if (list.length === 0) {
            container._lastItemsRef = null;
            updateVirtualScrollIndicator(container, 0, 0, 0);
            container.innerHTML = '<div class="item">No items found</div>';
            return;
        }
        var win = windowSize || 12;
        var half = Math.floor(win / 2);
        var start = Math.max(0, selectedIdx - half);
        var end = Math.min(list.length, start + win);
        if (end - start < win) {
            start = Math.max(0, end - win);
        }
        updateVirtualScrollIndicator(container, list.length, start, end);
        var children = container.children;
        var firstId = list[start] ? (list[start].id || list[start].catId || list[start].title || list[start].name) : '';
        var lastId = list[end - 1] ? (list[end - 1].id || list[end - 1].catId || list[end - 1].title || list[end - 1].name) : '';
        var sameWindow = !container._forceRebuild &&
            container._lastItemsRef === list &&
            container._lastLen === list.length &&
            container._lastStart === start &&
            container._lastEnd === end &&
            container._lastFirstId === firstId &&
            container._lastLastId === lastId &&
            children && children.length === (end - start);
        if (sameWindow) {
            for (var c = 0; c < children.length; c++) {
                var actualIdx = start + c;
                var node = children[c];
                var isSel = (actualIdx === selectedIdx);
                var isPlay = (container === itemsListEl && node._entryRef) ? isCurrentlyPlayingEntry(node._entryRef) : false;
                if (node.classList) {
                    if (isSel) {
                        node.classList.add('selected');
                    } else {
                        node.classList.remove('selected');
                    }
                    if (container === itemsListEl) {
                        if (isPlay) {
                            node.classList.add('playing');
                        } else {
                            node.classList.remove('playing');
                        }
                    }
                } else {
                    node.className = 'item' + (isSel ? ' selected' : '') + (isPlay ? ' playing' : '');
                }
                if (node._playBadge && node._playBadge.classList) {
                    if (isPlay) {
                        node._playBadge.classList.add('visible');
                    } else {
                        node._playBadge.classList.remove('visible');
                    }
                }
            }
            return;
        }
        container._forceRebuild = false;
        container._lastItemsRef = list;
        container._lastLen = list.length;
        container._lastStart = start;
        container._lastEnd = end;
        container._lastFirstId = firstId;
        container._lastLastId = lastId;
        container.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = start; i < end; i++) {
            frag.appendChild(createListItemRow(container, list[i], i, selectedIdx, labelFn));
        }
        container.appendChild(frag);
    }

    function applyColumnFilters() {
        var curModeId = modes[modeIdx] ? modes[modeIdx].id : 'live';
        var pinnedIds = getPinnedCatIds(curModeId);
        var builtInCats = [];
        var pinnedCats = [];
        var regularCats = [];
        for (var r = 0; r < rawCats.length; r++) {
            var rc = rawCats[r];
            if (!rc) {
                continue;
            }
            if (rc.id === '*' || rc.id === 'cont' || rc.id === 'fav' || rc.id === 'rec') {
                builtInCats.push(rc);
            } else if (pinnedIds.indexOf(String(rc.id)) !== -1) {
                pinnedCats.push(rc);
            } else {
                regularCats.push(rc);
            }
        }
        var orderedRawCats = builtInCats.concat(pinnedCats).concat(regularCats);
        var cFilter = (catFilterText || '').toLowerCase().trim();
        if (cFilter) {
            currentCats = orderedRawCats.filter(function(c) {
                return String(c.title || '').toLowerCase().indexOf(cFilter) !== -1;
            });
        } else {
            currentCats = orderedRawCats;
        }
        var iFilter = (itemFilterText || '').toLowerCase().trim();
        if (iFilter) {
            currentItems = rawItems.filter(function(it) {
                return String(it.name || '').toLowerCase().indexOf(iFilter) !== -1;
            });
        } else if (currentSort !== 'added') {
            currentItems = rawItems.slice();
        } else {
            currentItems = rawItems;
        }
        if (currentSort === 'title_asc') {
            currentItems.sort(function(a, b) {
                return String(a.name || '').localeCompare(String(b.name || ''));
            });
        } else if (currentSort === 'title_desc') {
            currentItems.sort(function(a, b) {
                return String(b.name || '').localeCompare(String(a.name || ''));
            });
        }
        if (catIdx >= currentCats.length) {
            catIdx = Math.max(0, currentCats.length - 1);
        }
        if (itemIdx >= currentItems.length) {
            itemIdx = Math.max(0, currentItems.length - 1);
        }
        if (filterBadgeEl) {
            var activeFilters = [];
            if (cFilter) {
                activeFilters.push('Cat: ' + catFilterText);
            }
            if (iFilter) {
                activeFilters.push('Item: ' + itemFilterText);
            }
            if (currentSort !== 'added') {
                activeFilters.push('Sort: ' + currentSort.replace('title_', '').toUpperCase());
            }
            if (activeFilters.length > 0) {
                filterBadgeEl.textContent = activeFilters.join(' | ');
                filterBadgeEl.classList.add('visible');
            } else {
                filterBadgeEl.classList.remove('visible');
            }
        }
    }
    function updateInlineRowEpg(channelId, nowText) {
        if (!itemsListEl || !itemsListEl.children || !nowText || nowText === 'No EPG Available') {
            return;
        }
        var targetId = String(channelId);
        var children = itemsListEl.children;
        for (var i = 0; i < children.length; i++) {
            var row = children[i];
            if (row && row._entryId === targetId && row._textStack) {
                if (!row._epgSubEl) {
                    var epgSub = document.createElement('span');
                    epgSub.className = 'item-epg-sub';
                    row._textStack.appendChild(epgSub);
                    row._epgSubEl = epgSub;
                }
                row._epgSubEl.textContent = nowText;
                break;
            }
        }
    }
    function renderModes() {
        renderList(modesListEl, modes, modeIdx, function(m) {
            return (m.icon ? (m.icon + '  ') : '') + m.title;
        }, 8);
    }
    function renderCats() {
        if (catsHeaderEl) {
            if (currentCats.length > 0) {
                catsHeaderEl.textContent = 'Categories (' + (catIdx + 1) + '/' + currentCats.length + ')';
            } else {
                catsHeaderEl.textContent = 'Categories';
            }
        }
        renderList(catsListEl, currentCats, catIdx, function(c) {
            return c.title;
        }, 12);
    }
    function renderItems() {
        if (itemsHeaderEl && seriesStack.length === 0 && modes[modeIdx]) {
            var baseTitle = modes[modeIdx].title;
            if (currentItems.length > 0) {
                itemsHeaderEl.textContent = baseTitle + ' (' + (itemIdx + 1) + '/' + currentItems.length + ')';
            } else {
                itemsHeaderEl.textContent = baseTitle;
            }
        }
        renderList(itemsListEl, currentItems, itemIdx, function(it) {
            var resume = it.isVod ? getResumeInfo(it.id) : null;
            var resumeSuffix = resume ? (' [' + formatTimeHMS(resume.pos) + ']') : '';
            return it.name + resumeSuffix;
        }, 12);
    }
    function updateInfoActionsFocus() {
        for (var i = 0; i < quickActionButtons.length; i++) {
            var pill = quickActionButtons[i].el;
            if (activeCol === 'info' && i === infoActionIdx) {
                pill.classList.add('focused');
            } else {
                pill.classList.remove('focused');
            }
        }
    }
    function enforceReadableColumnLayout() {
        document.body.classList.remove('compact-nav');
        if (modesColEl && modesColEl.style) {
            modesColEl.style.flex = '0 0 200px';
            modesColEl.style.width = '200px';
            modesColEl.style.minWidth = '200px';
            modesColEl.style.maxWidth = '200px';
        }
        if (catsColEl && catsColEl.style) {
            catsColEl.style.flex = '0 0 500px';
            catsColEl.style.width = '500px';
            catsColEl.style.minWidth = '500px';
            catsColEl.style.maxWidth = '500px';
        }
        if (itemsColEl && itemsColEl.style) {
            itemsColEl.style.flex = '0 0 760px';
            itemsColEl.style.width = '760px';
            itemsColEl.style.minWidth = '760px';
            itemsColEl.style.maxWidth = '760px';
        }
        if (infoColEl && infoColEl.style) {
            infoColEl.style.flex = '0 0 460px';
            infoColEl.style.width = '460px';
            infoColEl.style.minWidth = '460px';
            infoColEl.style.maxWidth = '460px';
        }
    }
    function updateColumnFocusClasses() {
        enforceReadableColumnLayout();
        if (modesColEl) {
            if (activeCol === 'modes') {
                modesColEl.classList.add('focused');
            } else {
                modesColEl.classList.remove('focused');
            }
        }
        if (catsColEl) {
            if (activeCol === 'cats') {
                catsColEl.classList.add('focused');
            } else {
                catsColEl.classList.remove('focused');
            }
        }
        if (itemsColEl) {
            if (activeCol === 'items') {
                itemsColEl.classList.add('focused');
            } else {
                itemsColEl.classList.remove('focused');
            }
        }
        if (infoColEl) {
            if (activeCol === 'info') {
                infoColEl.classList.add('focused');
            } else {
                infoColEl.classList.remove('focused');
            }
        }
        updateInfoActionsFocus();
    }
    function renderUI() {
        updateColumnFocusClasses();
        renderModes();
        renderCats();
        renderItems();
        updatePreviewPanel();
    }

    function bindQuickActionPill(bar, act, idx) {
        var pill = document.createElement('span');
        pill.className = 'quick-action-pill';
        pill.textContent = act.label;
        pill.onclick = function(ev) {
            ev.stopPropagation();
            infoActionIdx = idx;
            updateInfoActionsFocus();
            act.fn();
        };
        bar.appendChild(pill);
        quickActionButtons.push({ el: pill, fn: act.fn });
    }

    function ensureQuickActionBar() {
        if (!previewDescEl || !previewDescEl.parentNode) {
            return;
        }
        if (!document.getElementById('preview-epg-progress-wrap')) {
            var epgProgWrap = document.createElement('div');
            epgProgWrap.id = 'preview-epg-progress-wrap';
            epgProgWrap.className = 'preview-epg-bar-wrap';
            var epgProgFill = document.createElement('div');
            epgProgFill.id = 'preview-epg-progress-fill';
            epgProgFill.className = 'preview-epg-bar-fill';
            epgProgWrap.appendChild(epgProgFill);
            previewDescEl.parentNode.insertBefore(epgProgWrap, previewDescEl);
        }
        var bar = document.getElementById('preview-quick-actions');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'preview-quick-actions';
            bar.className = 'quick-action-bar';
            previewDescEl.parentNode.appendChild(bar);
        }
        if (quickActionButtons.length > 0) {
            return;
        }
        var actions = [
            { label: '▶ Play / Fullscreen', fn: function() { activateCurrentItemSelection(); } },
            { label: '★ Favorite', fn: function() {
                if (currentItems[itemIdx]) {
                    toggleFavorite(currentItems[itemIdx]);
                }
            } },
            { label: '📅 EPG Guide', fn: function() { openEpgModal(currentItems[itemIdx]); } },
            { label: '🔊 Audio / Subs', fn: function() { openTracksModal('audio'); } },
            { label: '📐 Aspect Ratio', fn: function() { toggleAspectRatio(); } },
            { label: '⏱ Sleep Timer', fn: function() { cycleSleepTimer(); } },
            { label: '⇅ Sort', fn: function() {
                var sorts = ['added', 'title_asc', 'title_desc'];
                currentSort = sorts[(sorts.indexOf(currentSort) + 1) % sorts.length];
                showToast('⇅ Sort: ' + currentSort.replace('title_', '').toUpperCase());
                applyColumnFilters();
                renderUI();
            } },
            { label: '⧩ Filter', fn: function() { openFilterModal('items'); } },
            { label: '🔄 Refresh', fn: function() { forceRefreshCurrentCatalog(); } },
            { label: '🗑 Clear History', fn: function() { clearCurrentHistory(); } }
        ];
        bar.innerHTML = '';
        for (var i = 0; i < actions.length; i++) {
            bindQuickActionPill(bar, actions[i], i);
        }
    }

    function setPreviewEpgProgress(pct, visible) {
        var wrap = document.getElementById('preview-epg-progress-wrap');
        var fill = document.getElementById('preview-epg-progress-fill');
        if (!wrap || !fill) {
            return;
        }
        if (visible && pct > 0) {
            wrap.classList.add('visible');
            fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
        } else {
            wrap.classList.remove('visible');
            fill.style.width = '0%';
        }
    }

    function updatePreviewPanel() {
        ensureQuickActionBar();
        if (previewEpgTimeout) {
            clearTimeout(previewEpgTimeout);
            previewEpgTimeout = null;
        }
        if (previewDebounceTimer) {
            clearTimeout(previewDebounceTimer);
            previewDebounceTimer = null;
        }
        var item = currentItems[itemIdx];
        if (!item) {
            setPreviewEpgProgress(0, false);
            if (previewPosterWrapEl) {
                previewPosterWrapEl.classList.remove('visible');
            }
            if (previewTitleEl) {
                previewTitleEl.textContent = 'Select an item';
            }
            if (previewMetaEl) {
                previewMetaEl.textContent = accountInfoText ? ('Account: ' + accountInfoText) : '';
            }
            if (previewDescEl) {
                previewDescEl.textContent = '';
            }
            return;
        }
        if (previewTitleEl) {
            previewTitleEl.textContent = (isFavItem(item) ? '★ ' : '') + item.name;
        }
        if (item.isVod) {
            setPreviewEpgProgress(0, false);
            var metaParts = [];
            if (item.year) {
                metaParts.push('Year: ' + item.year);
            }
            if (item.rating) {
                metaParts.push('IMDb: ' + item.rating);
            }
            if (isItemWatched(item.id)) {
                metaParts.push('✓ Watched');
            }
            var resume = getResumeInfo(item.id);
            if (resume) {
                metaParts.push('Resume: ' + formatTimeHMS(resume.pos));
            }
            if (previewMetaEl) {
                previewMetaEl.textContent = metaParts.join(' • ') || (item.isSeries ? 'TV Series' : 'VOD Movie');
            }
            if (previewDescEl) {
                previewDescEl.textContent = item.desc || 'No synopsis available.';
            }
            previewDebounceTimer = setTimeout(function() {
                if (!currentItems[itemIdx] || String(currentItems[itemIdx].id) !== String(item.id)) {
                    return;
                }
                var vodPoster = resolveLogoUrl(item.poster || item.logo || '');
                if (vodPoster && previewPosterEl && previewPosterWrapEl) {
                    if (previewPosterEl.src !== vodPoster) {
                        previewPosterEl.src = vodPoster;
                    }
                    previewPosterWrapEl.classList.add('visible');
                } else if (previewPosterWrapEl) {
                    previewPosterWrapEl.classList.remove('visible');
                }
            }, 220);
            return;
        }
        var liveMeta = 'Channel #' + (item.num || (itemIdx + 1));
        if (item.archive) {
            liveMeta += ' • ⏱ Catch-Up Archive';
        }
        if (previewMetaEl) {
            previewMetaEl.textContent = liveMeta;
        }
        var cachedEpg = shortEpgCache[String(item.id)];
        if (cachedEpg && (Date.now() - cachedEpg.ts) < 300000) {
            if (Array.isArray(cachedEpg.list) && cachedEpg.list.length > 0) {
                var parsedCached = parseShortEpgNowNext(cachedEpg.list);
                setPreviewEpgProgress(parsedCached.progressPct, true);
                if (previewDescEl) {
                    previewDescEl.textContent = 'NOW: ' + parsedCached.now + '\nNEXT: ' + parsedCached.next + (parsedCached.desc ? ('\n\n' + parsedCached.desc) : '');
                }
            } else {
                setPreviewEpgProgress(0, false);
                if (previewDescEl) {
                    previewDescEl.textContent = 'No EPG information available.';
                }
            }
            var cachedLogo = resolveLogoUrl(item.poster || item.logo || '');
            if (cachedLogo && previewPosterEl && previewPosterWrapEl) {
                if (previewPosterEl.src !== cachedLogo) {
                    previewPosterEl.src = cachedLogo;
                }
                previewPosterWrapEl.classList.add('visible');
            } else if (previewPosterWrapEl) {
                previewPosterWrapEl.classList.remove('visible');
            }
            return;
        }
        setPreviewEpgProgress(0, false);
        if (previewDescEl) {
            previewDescEl.textContent = 'Loading program info...';
        }
        previewEpgTimeout = setTimeout(function() {
            if (!currentItems[itemIdx] || String(currentItems[itemIdx].id) !== String(item.id)) {
                return;
            }
            var liveLogo = resolveLogoUrl(item.poster || item.logo || '');
            if (liveLogo && previewPosterEl && previewPosterWrapEl) {
                if (previewPosterEl.src !== liveLogo) {
                    previewPosterEl.src = liveLogo;
                }
                previewPosterWrapEl.classList.add('visible');
            } else if (previewPosterWrapEl) {
                previewPosterWrapEl.classList.remove('visible');
            }
            api.fetchShortEpg(item.id).then(function(epgList) {
                if (!currentItems[itemIdx] || String(currentItems[itemIdx].id) !== String(item.id)) {
                    return;
                }
                if (!Array.isArray(epgList) || epgList.length === 0) {
                    setPreviewEpgProgress(0, false);
                    if (previewDescEl) {
                        previewDescEl.textContent = 'No EPG information available.';
                    }
                    return;
                }
                var parsed = parseShortEpgNowNext(epgList);
                updateInlineRowEpg(item.id, parsed.now);
                setPreviewEpgProgress(parsed.progressPct, true);
                if (previewDescEl) {
                    previewDescEl.textContent = 'NOW: ' + parsed.now + '\nNEXT: ' + parsed.next + (parsed.desc ? ('\n\n' + parsed.desc) : '');
                }
            }).catch(function() {
                if (!currentItems[itemIdx] || String(currentItems[itemIdx].id) !== String(item.id)) {
                    return;
                }
                setPreviewEpgProgress(0, false);
                if (previewDescEl) {
                    previewDescEl.textContent = 'No EPG information available.';
                }
            });
        }, 380);
    }

    function tryAutoResumeLastLiveChannel() {
        if (hasAutoResumedOnBoot) {
            return false;
        }
        hasAutoResumedOnBoot = true;
        var saved = getLastLiveChannel();
        if (!saved || !saved.channelId) {
            return false;
        }
        var targetCatPos = 0;
        for (var i = 0; i < currentCats.length; i++) {
            if (String(currentCats[i].id) === String(saved.catId)) {
                var isAdult = Boolean(currentCats[i].censored) || /adult|xxx|18\+|18\||for adults|erotic|porn/i.test(String(currentCats[i].title || ''));
                if (!isAdult) {
                    targetCatPos = i;
                }
                break;
            }
        }
        selectCategory(targetCatPos);
        for (var j = 0; j < currentItems.length; j++) {
            if (String(currentItems[j].id) === String(saved.channelId)) {
                itemIdx = j;
                activeCol = 'items';
                renderUI();
                playItem(currentItems[j]);
                return true;
            }
        }
        return false;
    }

    function switchMode(newModeIdx) {
        if (newModeIdx !== undefined) {
            modeIdx = newModeIdx;
        }
        var mode = modes[modeIdx];
        if (!mode) {
            return;
        }
        if (mode.id === 'search') {
            openSearch();
            return;
        }
        if (mode.id === 'settings') {
            openSettings();
            return;
        }
        if (previewEpgTimeout) {
            clearTimeout(previewEpgTimeout);
            previewEpgTimeout = null;
        }
        if (previewDebounceTimer) {
            clearTimeout(previewDebounceTimer);
            previewDebounceTimer = null;
        }
        lastContentModeIdx = modeIdx;
        seriesStack = [];
        catFilterText = '';
        itemFilterText = '';
        catIdx = 0;
        itemIdx = 0;
        vodPage = 1;
        vodLoading = false;
        vodHasMore = true;
        liveGenrePaged = false;
        if (catsHeaderEl) {
            catsHeaderEl.textContent = 'Categories';
        }
        if (itemsHeaderEl) {
            itemsHeaderEl.textContent = mode.title;
        }

        if (mode.id === 'live') {
            if (liveGenres.length > 3 && allChannels.length > 0) {
                rebuildGenreChannelCounts();
                rawCats = liveGenres;
                applyColumnFilters();
                if (!tryAutoResumeLastLiveChannel()) {
                    selectCategory(0);
                }
                return;
            }
            rawCats = [
                { id: '*', title: 'All Channels', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            rawItems = [];
            applyColumnFilters();
            renderUI();
            if (catsHeaderEl) {
                catsHeaderEl.textContent = 'Categories (Loading...)';
            }

            api.fetchLiveCatalog(false).then(function(catalog) {
                if (catalog && Array.isArray(catalog.genres) && catalog.genres.length > 3) {
                    liveGenres = catalog.genres;
                }
                if (catalog && Array.isArray(catalog.channels) && catalog.channels.length > 0) {
                    allChannels = catalog.channels;
                }
                rebuildGenreChannelCounts();
                if (modes[modeIdx] && modes[modeIdx].id === 'live') {
                    rawCats = liveGenres.length > 3 ? liveGenres : (catalog.genres || rawCats);
                    applyColumnFilters();
                    renderCats();
                    if (!tryAutoResumeLastLiveChannel()) {
                        selectCategory(catIdx);
                    }
                }
            }).catch(function(err) {
                showOSD('Live TV', 'Catalog Error: ' + err.message);
                showToast('⚠ Retrying Live TV Categories...');
                setTimeout(function() {
                    if (modes[modeIdx] && modes[modeIdx].id === 'live' && liveGenres.length <= 3) {
                        api.fetchLiveCatalog(true).then(function(catalog2) {
                            if (catalog2 && Array.isArray(catalog2.genres) && catalog2.genres.length > 3) {
                                liveGenres = catalog2.genres;
                            }
                            if (catalog2 && Array.isArray(catalog2.channels) && catalog2.channels.length > 0) {
                                allChannels = catalog2.channels;
                            }
                            rebuildGenreChannelCounts();
                            if (modes[modeIdx] && modes[modeIdx].id === 'live') {
                                rawCats = liveGenres.length > 3 ? liveGenres : (catalog2.genres || rawCats);
                                applyColumnFilters();
                                renderCats();
                                selectCategory(catIdx);
                            }
                        }).catch(function() {});
                    }
                }, 1500);
            });
        } else if (mode.id === 'vod') {
            if (vodCats.length > 4) {
                rawCats = vodCats;
                applyColumnFilters();
                selectCategory(0);
                return;
            }
            rawCats = [
                { id: '*', title: 'All Movies', censored: false },
                { id: 'cont', title: '▶ Continue Watching', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            rawItems = [];
            applyColumnFilters();
            renderUI();
            if (catsHeaderEl) {
                catsHeaderEl.textContent = 'Categories (Loading...)';
            }
            if (itemsListEl) {
                itemsListEl._lastItemsRef = null;
                itemsListEl.innerHTML = '<div class="item">Loading Movies...</div>';
            }

            api.fetchVodCategories().then(function(cats) {
                if (Array.isArray(cats) && cats.length > 4) {
                    vodCats = cats;
                }
                if (modes[modeIdx] && modes[modeIdx].id === 'vod') {
                    rawCats = vodCats.length > 4 ? vodCats : (cats || rawCats);
                    applyColumnFilters();
                    renderCats();
                    selectCategory(catIdx);
                }
            }).catch(function() {
                if (modes[modeIdx] && modes[modeIdx].id === 'vod') {
                    selectCategory(0);
                }
                showToast('⚠ Retrying VOD Categories...');
                setTimeout(function() {
                    if (modes[modeIdx] && modes[modeIdx].id === 'vod' && vodCats.length <= 4) {
                        api.fetchVodCategories(true).then(function(cats2) {
                            if (Array.isArray(cats2) && cats2.length > 4) {
                                vodCats = cats2;
                            }
                            if (modes[modeIdx] && modes[modeIdx].id === 'vod') {
                                rawCats = vodCats.length > 4 ? vodCats : (cats2 || rawCats);
                                applyColumnFilters();
                                renderCats();
                                selectCategory(catIdx);
                            }
                        }).catch(function() {});
                    }
                }, 1200);
            });
        } else if (mode.id === 'series') {
            if (seriesCats.length > 4) {
                rawCats = seriesCats;
                applyColumnFilters();
                selectCategory(0);
                return;
            }
            rawCats = [
                { id: '*', title: 'All Series', censored: false },
                { id: 'cont', title: '▶ Continue Watching', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            rawItems = [];
            applyColumnFilters();
            renderUI();
            if (catsHeaderEl) {
                catsHeaderEl.textContent = 'Categories (Loading...)';
            }
            if (itemsListEl) {
                itemsListEl._lastItemsRef = null;
                itemsListEl.innerHTML = '<div class="item">Loading TV Series...</div>';
            }

            api.fetchSeriesCategories().then(function(cats) {
                if (Array.isArray(cats) && cats.length > 4) {
                    seriesCats = cats;
                }
                if (modes[modeIdx] && modes[modeIdx].id === 'series') {
                    rawCats = seriesCats.length > 4 ? seriesCats : (cats || rawCats);
                    applyColumnFilters();
                    renderCats();
                    selectCategory(catIdx);
                }
            }).catch(function() {
                if (modes[modeIdx] && modes[modeIdx].id === 'series') {
                    selectCategory(0);
                }
                showToast('⚠ Retrying Series Categories...');
                setTimeout(function() {
                    if (modes[modeIdx] && modes[modeIdx].id === 'series' && seriesCats.length <= 4) {
                        api.fetchSeriesCategories(true).then(function(cats2) {
                            if (Array.isArray(cats2) && cats2.length > 4) {
                                seriesCats = cats2;
                            }
                            if (modes[modeIdx] && modes[modeIdx].id === 'series') {
                                rawCats = seriesCats.length > 4 ? seriesCats : (cats2 || rawCats);
                                applyColumnFilters();
                                renderCats();
                                selectCategory(catIdx);
                            }
                        }).catch(function() {});
                    }
                }, 1200);
            });
        }
    }

    function selectCategory(targetCatIdx) {
        if (targetCatIdx !== undefined) {
            catIdx = targetCatIdx;
        }
        var cat = currentCats[catIdx];
        if (!cat) {
            rawItems = [];
            applyColumnFilters();
            renderUI();
            return;
        }
        var isAdultCat = Boolean(cat.censored) || /adult|xxx|18\+|18\||for adults|erotic|porn/i.test(String(cat.title || ''));
        if (isAdultCat && !window._parentalUnlocked) {
            openPinModal(function() {
                activeCol = 'items';
                updateColumnFocusClasses();
                selectCategory(catIdx);
            });
            return;
        }

        var mode = modes[modeIdx];
        itemIdx = 0;
        seriesStack = [];
        vodPage = 1;
        vodLoading = false;
        vodHasMore = true;
        liveGenrePaged = false;

        if (mode.id === 'live') {
            if (cat.id === 'fav') {
                var favIds = getFavList('live');
                var favChannels = [];
                for (var i = 0; i < favIds.length; i++) {
                    var foundFav = channelByIdMap[String(favIds[i])];
                    if (foundFav) {
                        favChannels.push(foundFav);
                    }
                }
                rawItems = favChannels;
                applyColumnFilters();
                renderUI();
            } else if (cat.id === 'rec') {
                rawItems = getRecentItems(false);
                applyColumnFilters();
                renderUI();
            } else {
                if (cat.id === '*') {
                    rawItems = allChannels;
                } else {
                    rawItems = genreChannelsMap[String(cat.id)] || [];
                }
                if (rawItems.length === 0) {
                    vodLoading = true;
                    liveGenrePaged = true;
                    if (itemsListEl) {
                        itemsListEl._lastItemsRef = null;
                        itemsListEl.innerHTML = '<div class="item">Loading channels...</div>';
                    }
                    api.fetchLiveGenrePage(cat.id, 1).then(function(res) {
                        vodLoading = false;
                        rawItems = res.items || [];
                        vodHasMore = Boolean(res.hasMore);
                        for (var n = 0; n < rawItems.length; n++) {
                            if (!channelByIdMap[String(rawItems[n].id)]) {
                                allChannels.push(rawItems[n]);
                            }
                        }
                        rebuildGenreChannelCounts();
                        if (catsListEl) {
                            catsListEl._forceRebuild = true;
                        }
                        applyColumnFilters();
                        renderUI();
                    }).catch(function() {
                        vodLoading = false;
                        rawItems = [];
                        vodHasMore = false;
                        applyColumnFilters();
                        renderUI();
                    });
                } else {
                    applyColumnFilters();
                    renderUI();
                }
            }
        } else if (mode.id === 'vod') {
            if (cat.id === 'cont') {
                rawItems = getContinueWatchingItems(false);
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else if (cat.id === 'fav') {
                rawItems = getFavList('vod');
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else if (cat.id === 'rec') {
                rawItems = getRecentItems(true).filter(function(x) { return !x.isSeries; });
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else {
                vodLoading = true;
                if (itemsListEl) {
                    itemsListEl._lastItemsRef = null;
                    itemsListEl.innerHTML = '<div class="item">Loading Movies...</div>';
                }
                api.fetchVodPage(cat.id, 1, '', currentSort).then(function(items) {
                    vodLoading = false;
                    rawItems = items || [];
                    vodHasMore = rawItems.length >= 10;
                    applyColumnFilters();
                    renderUI();
                }).catch(function() {
                    setTimeout(function() {
                        api.fetchVodPage(cat.id, 1, '', currentSort).then(function(itemsRetry) {
                            vodLoading = false;
                            rawItems = itemsRetry || [];
                            vodHasMore = rawItems.length >= 10;
                            applyColumnFilters();
                            renderUI();
                        }).catch(function() {
                            vodLoading = false;
                            rawItems = [];
                            applyColumnFilters();
                            renderUI();
                        });
                    }, 500);
                });
            }
        } else if (mode.id === 'series') {
            if (cat.id === 'cont') {
                rawItems = getContinueWatchingItems(true);
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else if (cat.id === 'fav') {
                rawItems = getFavList('series');
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else if (cat.id === 'rec') {
                rawItems = getRecentItems(true).filter(function(x) { return Boolean(x.isSeries); });
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else {
                vodLoading = true;
                if (itemsListEl) {
                    itemsListEl._lastItemsRef = null;
                    itemsListEl.innerHTML = '<div class="item">Loading TV Series...</div>';
                }
                api.fetchSeriesPage(cat.id, 1, '', currentSort).then(function(items) {
                    vodLoading = false;
                    rawItems = items || [];
                    vodHasMore = rawItems.length >= 10;
                    applyColumnFilters();
                    renderUI();
                }).catch(function() {
                    setTimeout(function() {
                        api.fetchSeriesPage(cat.id, 1, '', currentSort).then(function(itemsRetry) {
                            vodLoading = false;
                            rawItems = itemsRetry || [];
                            vodHasMore = rawItems.length >= 10;
                            applyColumnFilters();
                            renderUI();
                        }).catch(function() {
                            vodLoading = false;
                            rawItems = [];
                            applyColumnFilters();
                            renderUI();
                        });
                    }, 500);
                });
            }
        }
    }

    function loadMoreCatalogIfNeeded() {
        var mode = modes[modeIdx];
        var cat = currentCats[catIdx];
        if (!cat || cat.id === 'cont' || cat.id === 'fav' || cat.id === 'rec') {
            return;
        }
        if (seriesStack.length > 0) {
            return;
        }
        if (vodLoading || !vodHasMore) {
            return;
        }
        if (itemIdx < currentItems.length - 3) {
            return;
        }
        if (mode.id === 'live' && liveGenrePaged) {
            vodLoading = true;
            var nextLivePage = vodPage + 1;
            api.fetchLiveGenrePage(cat.id, nextLivePage).then(function(res) {
                vodLoading = false;
                var moreLive = (res && res.items) ? res.items : [];
                if (moreLive.length === 0) {
                    vodHasMore = false;
                    return;
                }
                vodPage = nextLivePage;
                vodHasMore = Boolean(res.hasMore);
                rawItems = rawItems.concat(moreLive);
                var existingMap = {};
                for (var e = 0; e < allChannels.length; e++) {
                    existingMap[String(allChannels[e].id)] = true;
                }
                for (var n = 0; n < moreLive.length; n++) {
                    if (!existingMap[String(moreLive[n].id)]) {
                        allChannels.push(moreLive[n]);
                    }
                }
                rebuildGenreChannelCounts();
                applyColumnFilters();
                renderItems();
            }).catch(function() {
                vodLoading = false;
            });
            return;
        }
        var loader = null;
        if (mode.id === 'vod') {
            loader = api.fetchVodPage(cat.id, vodPage + 1, '', currentSort);
        } else if (mode.id === 'series') {
            loader = api.fetchSeriesPage(cat.id, vodPage + 1, '', currentSort);
        }
        if (!loader) {
            return;
        }
        vodLoading = true;
        var nextPage = vodPage + 1;
        loader.then(function(moreItems) {
            vodLoading = false;
            if (!Array.isArray(moreItems) || moreItems.length === 0) {
                vodHasMore = false;
                return;
            }
            vodPage = nextPage;
            rawItems = rawItems.concat(moreItems);
            applyColumnFilters();
            renderItems();
        }).catch(function() {
            vodLoading = false;
        });
    }
    function stepIntoSeries(item) {
        if (!item) {
            return;
        }
        if (item.isSeries && !item.isSeason && !item.isEpisode) {
            api.fetchSeriesSeasons(item).then(function(seasons) {
                seriesStack.push({
                    rawItems: rawItems.slice(),
                    itemIdx: itemIdx,
                    itemFilterText: itemFilterText,
                    header: itemsHeaderEl ? itemsHeaderEl.textContent : 'Series'
                });
                itemFilterText = '';
                rawItems = seasons;
                itemIdx = 0;
                if (itemsHeaderEl) {
                    itemsHeaderEl.textContent = item.name + ' — Seasons';
                }
                applyColumnFilters();
                renderUI();
            }).catch(function(err) {
                showOSD(item.name, 'Failed to load seasons: ' + err.message);
            });
        } else if (item.isSeason) {
            var episodes = [];
            var epNums = Array.isArray(item.episodes) ? item.episodes : [];
            for (var i = 0; i < epNums.length; i++) {
                var epNum = epNums[i];
                episodes.push({
                    id: item.parentSeries.id + '_s' + item.id + '_e' + epNum,
                    name: 'Episode ' + epNum,
                    cmd: item.cmd,
                    desc: item.desc,
                    poster: item.poster,
                    seriesNum: epNum,
                    isEpisode: true,
                    isVod: true,
                    isSeries: true,
                    streamType: item.streamType
                });
            }
            seriesStack.push({
                rawItems: rawItems.slice(),
                itemIdx: itemIdx,
                itemFilterText: itemFilterText,
                header: itemsHeaderEl ? itemsHeaderEl.textContent : 'Seasons'
            });
            itemFilterText = '';
            rawItems = episodes;
            itemIdx = 0;
            if (itemsHeaderEl) {
                itemsHeaderEl.textContent = item.name + ' — Episodes';
            }
            applyColumnFilters();
            renderUI();
        }
    }
    function stepOutSeries() {
        if (seriesStack.length === 0) {
            return false;
        }
        var prev = seriesStack.pop();
        rawItems = prev.rawItems;
        itemIdx = prev.itemIdx;
        itemFilterText = prev.itemFilterText || '';
        if (itemsHeaderEl) {
            itemsHeaderEl.textContent = prev.header;
        }
        applyColumnFilters();
        renderUI();
        return true;
    }

    function renderProfileSelectOptions() {
        if (!selProfileEl) {
            return;
        }
        selProfileEl.innerHTML = '';
        for (var i = 0; i < profiles.length; i++) {
            var opt = document.createElement('option');
            opt.value = profiles[i].id;
            opt.textContent = profiles[i].name + ' (' + (profiles[i].mac || 'No MAC') + ')';
            if (i === editingProfileIndex) {
                opt.selected = true;
            }
            selProfileEl.appendChild(opt);
        }
    }
    function loadProfileIntoSettingsInputs(idx) {
        editingProfileIndex = Math.max(0, Math.min(profiles.length - 1, idx));
        var p = profiles[editingProfileIndex];
        renderProfileSelectOptions();
        if (inpProfileNameEl) {
            inpProfileNameEl.value = p.name || '';
        }
        if (inpPortalEl) {
            inpPortalEl.value = p.portal || '';
        }
        if (inpMacEl) {
            inpMacEl.value = p.mac || '';
        }
    }
    if (selProfileEl) {
        selProfileEl.onchange = function() {
            var selectedId = selProfileEl.value;
            for (var p = 0; p < profiles.length; p++) {
                if (profiles[p].id === selectedId) {
                    loadProfileIntoSettingsInputs(p);
                    break;
                }
            }
        };
    }
    if (selThemeEl) {
        selThemeEl.onchange = function() {
            applyTheme(selThemeEl.value);
        };
    }
    if (btnSaveEl) {
        btnSaveEl.onclick = function() { saveSettingsAndBoot(); };
    }
    if (btnProfileNewEl) {
        btnProfileNewEl.onclick = function() { createNewProfileInSettings(); };
    }
    if (btnProfileDelEl) {
        btnProfileDelEl.onclick = function() { deleteCurrentProfileInSettings(); };
    }
    if (btnRestartEl) {
        btnRestartEl.onclick = function() { rebootApp(); };
    }
    if (btnCancelEl) {
        btnCancelEl.onclick = function() { closeSettings(); };
    }
    if (btnBackupExportEl) {
        btnBackupExportEl.onclick = function() { exportBackupJson(); };
    }
    if (btnBackupImportEl) {
        btnBackupImportEl.onclick = function() { importBackupJson(); };
    }

    function openSettings() {
        loadProfiles();
        settingsOpen = true;
        settingsRow = 0;
        settingsCol = 0;
        loadProfileIntoSettingsInputs(editingProfileIndex);
        if (selThemeEl) {
            selThemeEl.value = localStorage.getItem('cfg_theme') || 'blue';
        }
        if (inpPinEl) {
            inpPinEl.value = localStorage.getItem('cfg_pin') || api.parentalPin || '0000';
        }
        if (settingsModal) {
            settingsModal.classList.add('visible');
        }
        updateSettingsFocus();
    }
    function closeSettings() {
        var focusedEl = getFocusedModalElement(settingsGrid, settingsRow, settingsCol);
        if (focusedEl && focusedEl.blur) {
            focusedEl.blur();
        }
        settingsOpen = false;
        imeActive = false;
        if (modes[modeIdx] && modes[modeIdx].id === 'settings') {
            modeIdx = lastContentModeIdx;
            renderModes();
        }
        if (settingsModal) {
            settingsModal.classList.remove('visible');
        }
    }
    function updateSettingsFocus() {
        return applyGridFocus(settingsEls, settingsGrid, settingsRow, settingsCol);
    }
    function rebootApp() {
        stopPlayback();
        showOSD('Restarting...', 'Rebooting application');
        setTimeout(function() {
            window.location.reload();
        }, 150);
    }
    function saveSettingsAndBoot() {
        var prof = profiles[editingProfileIndex];
        if (prof) {
            prof.name = (inpProfileNameEl && inpProfileNameEl.value.trim()) || 'Portal ' + (editingProfileIndex + 1);
            prof.portal = (inpPortalEl && inpPortalEl.value.trim()) || '';
            prof.mac = (inpMacEl && inpMacEl.value.trim()) || '00:1A:79:00:00:01';
            activeProfileId = prof.id;
            safeSetStorage('cfg_profiles', JSON.stringify(profiles));
            syncActiveProfileToLegacyKeys(prof);
        }
        if (selThemeEl) {
            applyTheme(selThemeEl.value);
        }
        if (inpPinEl && inpPinEl.value.trim().length === 4) {
            var newPin = inpPinEl.value.trim();
            safeSetStorage('cfg_pin', newPin);
            api.parentalPin = newPin;
        }
        window._parentalUnlocked = false;
        invalidateFavCaches();
        try {
            localStorage.removeItem('stalker_live');
        } catch (ex) {}
        closeSettings();
        rebootApp();
    }
    function createNewProfileInSettings() {
        var newId = 'prof_' + Date.now();
        profiles.push({ id: newId, name: 'Portal ' + (profiles.length + 1), portal: 'http://', mac: '00:1A:79:00:00:01' });
        loadProfileIntoSettingsInputs(profiles.length - 1);
        showToast('Created Profile: Portal ' + profiles.length);
    }
    function deleteCurrentProfileInSettings() {
        if (profiles.length <= 1) {
            showOSD('Profiles', 'Cannot delete the only profile');
            showToast('Cannot delete the only profile');
            return;
        }
        profiles.splice(editingProfileIndex, 1);
        editingProfileIndex = Math.max(0, editingProfileIndex - 1);
        activeProfileId = profiles[editingProfileIndex].id;
        safeSetStorage('cfg_profiles', JSON.stringify(profiles));
        syncActiveProfileToLegacyKeys(profiles[editingProfileIndex]);
        loadProfileIntoSettingsInputs(editingProfileIndex);
        showToast('Profile deleted');
    }

    function openSearch() {
        searchOpen = true;
        searchFocusArea = 'input';
        searchIdx = 0;
        searchResults = [];
        if (searchInput) {
            searchInput.value = '';
            searchInput.classList.add('focused');
        }
        if (searchResultsContainer) {
            searchResultsContainer._lastItemsRef = null;
            searchResultsContainer.innerHTML = '';
        }
        if (searchModal) {
            searchModal.classList.add('visible');
        }
        if (vodCats.length === 0) {
            api.fetchVodCategories().then(function(cats) { vodCats = cats || []; }).catch(function() {});
        }
        if (seriesCats.length === 0) {
            api.fetchSeriesCategories().then(function(cats) { seriesCats = cats || []; }).catch(function() {});
        }
    }
    function closeSearch() {
        searchOpen = false;
        if (searchInput) {
            searchInput.blur();
        }
        if (modes[modeIdx] && modes[modeIdx].id === 'search') {
            modeIdx = lastContentModeIdx;
            renderModes();
        }
        if (searchModal) {
            searchModal.classList.remove('visible');
        }
    }
    function matchCategoryList(categoryArray, q, labelPrefix, targetModeIdx) {
        var list = Array.isArray(categoryArray) ? categoryArray : [];
        var matches = [];
        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            if (!c || c.id === '*' || c.id === 'fav' || c.id === 'rec') {
                continue;
            }
            var title = String(c.title || '');
            if (title.toLowerCase().indexOf(q) !== -1) {
                matches.push({
                    id: 'cat_' + targetModeIdx + '_' + c.id,
                    isCategoryResult: true,
                    targetModeIdx: targetModeIdx,
                    catId: String(c.id),
                    name: title,
                    censored: Boolean(c.censored),
                    display: '📂 [' + labelPrefix + ' Category] ' + title
                });
                if (matches.length >= 15) {
                    break;
                }
            }
        }
        return matches;
    }
    function performSearch(query) {
        var q = (query || '').trim().toLowerCase();
        var mySeq = ++searchSeq;
        if (!q) {
            searchResults = [];
            if (searchResultsContainer) {
                searchResultsContainer._lastItemsRef = null;
                searchResultsContainer.innerHTML = '';
            }
            return;
        }
        var liveCatMatches = matchCategoryList(liveGenres, q, 'Live', 0);
        var vodCatMatches = matchCategoryList(vodCats, q, 'Movie', 1);
        var seriesCatMatches = matchCategoryList(seriesCats, q, 'Series', 2);
        var allCatMatches = liveCatMatches.concat(vodCatMatches).concat(seriesCatMatches);
        var liveMatches = [];
        for (var i = 0; i < allChannels.length; i++) {
            var ch = allChannels[i];
            if (ch && (String(ch.name || '').toLowerCase().indexOf(q) !== -1 || String(ch.num || '') === q)) {
                liveMatches.push(ch);
                if (liveMatches.length >= 30) {
                    break;
                }
            }
        }
        searchResults = allCatMatches.concat(liveMatches);
        searchIdx = 0;
        renderSearchResults();
        Promise.all([
            api.fetchVodPage('*', 1, q, 'added').catch(function() { return []; }),
            api.fetchSeriesPage('*', 1, q, 'added').catch(function() { return []; })
        ]).then(function(res) {
            if (!searchOpen || mySeq !== searchSeq) {
                return;
            }
            var vodMatches = (res[0] || []).slice(0, 20);
            var seriesMatches = (res[1] || []).slice(0, 20);
            searchResults = allCatMatches.concat(liveMatches).concat(vodMatches).concat(seriesMatches);
            if (searchIdx >= searchResults.length) {
                searchIdx = 0;
            }
            renderSearchResults();
        });
    }
    function renderSearchResults() {
        renderList(searchResultsContainer, searchResults, searchIdx, function(item) {
            if (item.isCategoryResult) {
                return item.display;
            }
            if (item.isSeries) {
                return '📁 [Series] ' + item.name + (item.year ? (' (' + item.year + ')') : '');
            }
            if (item.isVod) {
                return '🎬 [Movie] ' + item.name + (item.year ? (' (' + item.year + ')') : '');
            }
            return '📺 [Live] ' + (item.num ? (item.num + '. ') : '') + item.name;
        }, 8);
    }
    function jumpToCategoryFromSearch(catResult) {
        if (!catResult) {
            return;
        }
        var targetMode = catResult.targetModeIdx || 0;
        modeIdx = targetMode;
        lastContentModeIdx = targetMode;
        catFilterText = '';
        itemFilterText = '';
        seriesStack = [];
        activeCol = 'items';
        setOverlayVisible(true);
        if (catsHeaderEl) {
            catsHeaderEl.textContent = 'Categories';
        }
        if (itemsHeaderEl && modes[modeIdx]) {
            itemsHeaderEl.textContent = modes[modeIdx].title;
        }
        function applyCategorySelection(catsList) {
            rawCats = catsList || [];
            applyColumnFilters();
            var foundCatIdx = 0;
            for (var i = 0; i < currentCats.length; i++) {
                if (String(currentCats[i].id) === String(catResult.catId)) {
                    foundCatIdx = i;
                    break;
                }
            }
            selectCategory(foundCatIdx);
        }
        if (targetMode === 0) {
            if (liveGenres.length > 0) {
                applyCategorySelection(liveGenres);
            } else {
                api.fetchLiveCatalog(false).then(function(cat) {
                    liveGenres = cat.genres || [];
                    allChannels = cat.channels || [];
                    rebuildGenreChannelCounts();
                    applyCategorySelection(liveGenres);
                });
            }
        } else if (targetMode === 1) {
            if (vodCats.length > 0) {
                applyCategorySelection(vodCats);
            } else {
                api.fetchVodCategories().then(function(cats) {
                    vodCats = cats || [];
                    applyCategorySelection(vodCats);
                });
            }
        } else if (targetMode === 2) {
            if (seriesCats.length > 0) {
                applyCategorySelection(seriesCats);
            } else {
                api.fetchSeriesCategories().then(function(cats) {
                    seriesCats = cats || [];
                    applyCategorySelection(seriesCats);
                });
            }
        }
    }
    function openFilterModal(targetCol) {
        filterOpen = true;
        filterRow = 0;
        filterCol = 0;
        filterTargetCol = targetCol || (activeCol === 'cats' ? 'cats' : 'items');
        if (filterModalTitle) {
            filterModalTitle.textContent = filterTargetCol === 'cats' ? 'Filter Categories' : 'Filter Channels / Content';
        }
        if (inpFilterEl) {
            inpFilterEl.value = filterTargetCol === 'cats' ? catFilterText : itemFilterText;
        }
        if (filterModal) {
            filterModal.classList.add('visible');
        }
        updateFilterFocus();
    }
    function closeFilterModal() {
        filterOpen = false;
        if (inpFilterEl) {
            inpFilterEl.blur();
        }
        if (filterModal) {
            filterModal.classList.remove('visible');
        }
    }
    function updateFilterFocus() {
        return applyGridFocus(filterEls, filterGrid, filterRow, filterCol);
    }
    if (btnFilterApplyEl) {
        btnFilterApplyEl.onclick = function() {
            var val = inpFilterEl ? inpFilterEl.value.trim() : '';
            if (filterTargetCol === 'cats') {
                catFilterText = val;
            } else {
                itemFilterText = val;
            }
            closeFilterModal();
            applyColumnFilters();
            renderUI();
        };
    }
    if (btnFilterClearEl) {
        btnFilterClearEl.onclick = function() {
            if (filterTargetCol === 'cats') {
                catFilterText = '';
            } else {
                itemFilterText = '';
            }
            closeFilterModal();
            applyColumnFilters();
            renderUI();
        };
    }

    function bindWheelSafe(el, handler) {
        if (!el) {
            return;
        }
        try {
            el.addEventListener('wheel', handler, { passive: false });
        } catch (ex) {
            el.addEventListener('wheel', handler, false);
        }
    }

    function bindModalCloseHandlers(cfg) {
        if (!cfg.el) {
            return;
        }
        cfg.el.addEventListener('click', function(ev) {
            if (ev.target === cfg.el) {
                cfg.closeFn();
            }
        });
        var innerBox = cfg.el.firstElementChild;
        if (innerBox && !innerBox.querySelector('.modal-close-x')) {
            var closeX = document.createElement('div');
            closeX.className = 'modal-close-x';
            closeX.textContent = '✕';
            closeX.title = 'Close (Back / Esc)';
            closeX.onclick = function(ev) {
                ev.stopPropagation();
                cfg.closeFn();
            };
            innerBox.appendChild(closeX);
        }
    }

    function setupMouseListeners() {
        if (profileBadgeEl) {
            profileBadgeEl.onclick = function(ev) {
                ev.stopPropagation();
                openSettings();
            };
        }
        var modalConfigs = [
            { el: settingsModal, closeFn: closeSettings },
            { el: searchModal, closeFn: closeSearch },
            { el: filterModal, closeFn: closeFilterModal },
            { el: epgModal, closeFn: closeEpgModal },
            { el: pinModalEl, closeFn: closePinModal }
        ];
        for (var m = 0; m < modalConfigs.length; m++) {
            bindModalCloseHandlers(modalConfigs[m]);
        }

        document.addEventListener('dblclick', function(ev) {
            if (settingsOpen || searchOpen || filterOpen || epgModalOpen || pinModalOpen) {
                return;
            }
            if (ev.target === document.body || ev.target === overlayEl) {
                if (currentPlayingItem) {
                    setOverlayVisible(!uiVisible);
                }
            }
        });

        if (filterBadgeEl) {
            filterBadgeEl.title = 'Click to clear filters';
            filterBadgeEl.onclick = function(ev) {
                ev.stopPropagation();
                catFilterText = '';
                itemFilterText = '';
                currentSort = 'added';
                applyColumnFilters();
                renderUI();
                showToast('Filters cleared');
            };
        }
        if (searchInput) {
            searchInput.oninput = function() {
                if (searchDebounce) {
                    clearTimeout(searchDebounce);
                }
                searchDebounce = setTimeout(function() {
                    performSearch(searchInput.value);
                }, 220);
            };
        }
        if (vodProgressWrap) {
            vodProgressWrap.onclick = function(ev) {
                ev.stopPropagation();
                if ((!isPlayingVod && !isPlayingCatchup) || vodDurationMs <= 0) {
                    return;
                }
                var rect = vodProgressWrap.getBoundingClientRect();
                var ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                var targetMs = Math.floor(ratio * vodDurationMs);
                scrubVodByOffset(targetMs - vodCurrentMs);
            };
        }
        bindWheelSafe(modesColEl, function(ev) {
            ev.preventDefault();
            activeCol = 'modes';
            var dir = ev.deltaY > 0 ? 1 : -1;
            modeIdx = (modeIdx + dir + modes.length) % modes.length;
            updateColumnFocusClasses();
            renderModes();
        });
        bindWheelSafe(catsColEl, function(ev) {
            ev.preventDefault();
            if (currentCats.length === 0) {
                return;
            }
            activeCol = 'cats';
            var dir = ev.deltaY > 0 ? 1 : -1;
            catIdx = (catIdx + dir + currentCats.length) % currentCats.length;
            updateColumnFocusClasses();
            renderCats();
        });
        bindWheelSafe(itemsColEl, function(ev) {
            ev.preventDefault();
            if (currentItems.length === 0) {
                return;
            }
            activeCol = 'items';
            var step = ev.deltaY > 0 ? 2 : -2;
            itemIdx = Math.max(0, Math.min(currentItems.length - 1, itemIdx + step));
            updateColumnFocusClasses();
            renderItems();
            updatePreviewPanel();
            loadMoreCatalogIfNeeded();
        });
        bindWheelSafe(epgModalList, function(ev) {
            ev.preventDefault();
            if (epgModalItems.length === 0) {
                return;
            }
            var step = ev.deltaY > 0 ? 1 : -1;
            epgModalIdx = Math.max(0, Math.min(epgModalItems.length - 1, epgModalIdx + step));
            renderEpgModalList();
        });
        bindWheelSafe(searchResultsContainer, function(ev) {
            ev.preventDefault();
            if (searchResults.length === 0) {
                return;
            }
            searchFocusArea = 'results';
            var step = ev.deltaY > 0 ? 1 : -1;
            searchIdx = Math.max(0, Math.min(searchResults.length - 1, searchIdx + step));
            renderSearchResults();
        });
    }

    function handleNumInput(digit) {
        if (digit === 0 && numBuffer === '') {
            if (previousLiveChannel) {
                playItem(previousLiveChannel);
            }
            return;
        }
        numBuffer += String(digit);
        if (numOsdEl) {
            numOsdEl.textContent = numBuffer;
            numOsdEl.classList.add('visible');
        }
        if (numTimeout) {
            clearTimeout(numTimeout);
        }
        numTimeout = setTimeout(function() {
            var targetNum = Number(numBuffer);
            numBuffer = '';
            if (numOsdEl) {
                numOsdEl.classList.remove('visible');
            }
            for (var i = 0; i < allChannels.length; i++) {
                if (Number(allChannels[i].num) === targetNum) {
                    playItem(allChannels[i]);
                    break;
                }
            }
        }, 1200);
    }

    function setupKeyListeners() {
        try {
            if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
                var keysToRegister = [
                    'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
                    'Info', 'Guide', 'ChannelGuide', 'ChannelUp', 'ChannelDown',
                    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
                    'MediaFastForward', 'MediaRewind',
                    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
                ];
                for (var i = 0; i < keysToRegister.length; i++) {
                    try {
                        tizen.tvinputdevice.registerKey(keysToRegister[i]);
                    } catch (ex) {}
                }
            }
        } catch (ex2) {}

        document.addEventListener('keydown', function(e) {
            var code = e.keyCode;
            var key = e.key || '';
            var isInputFocused = Boolean(document.activeElement && document.activeElement.tagName === 'INPUT');
            var isUp = code === 38 || key === 'ArrowUp';
            var isDown = code === 40 || key === 'ArrowDown';
            var isLeft = code === 37 || key === 'ArrowLeft';
            var isRight = code === 39 || key === 'ArrowRight';
            var isEnter = code === 13 || key === 'Enter';
            var isHardwareOrEscBack = code === 10009 || code === 27 || key === 'Escape';
            var isBackspaceKey = code === 8 || key === 'Backspace';
            var isBack = isHardwareOrEscBack || (isBackspaceKey && !isInputFocused);
            var isRed = code === 403 || key === 'ColorF0Red' || key === 'r';
            var isGreen = code === 404 || key === 'ColorF1Green' || key === 'g';
            var isYellow = code === 405 || key === 'ColorF2Yellow' || key === 'y';
            var isBlue = code === 406 || key === 'ColorF3Blue' || key === 'b';
            var isInfo = code === 457 || key === 'Info' || key === 'i';
            var isGuide = code === 458 || key === 'Guide' || key === 'ChannelGuide' || key === 'e';
            var isChUp = code === 427 || key === 'ChannelUp' || key === 'PageUp';
            var isChDown = code === 428 || key === 'ChannelDown' || key === 'PageDown';
            var isPlayPause = code === 10252 || key === 'MediaPlayPause' || key === ' ';
            var isPlay = code === 415 || key === 'MediaPlay';
            var isPause = code === 19 || key === 'MediaPause';
            var isStop = code === 413 || key === 'MediaStop';
            var isRewind = code === 412 || key === 'MediaRewind';
            var isFastForward = code === 417 || key === 'MediaFastForward';

            if (!imeActive && !isInputFocused && !searchOpen && !filterOpen && !settingsOpen && !pinModalOpen && !epgModalOpen) {
                if (key === 'm' || key === 'M') {
                    e.preventDefault();
                    toggleMute();
                    return;
                }
                if (key === '+' || key === '=') {
                    e.preventDefault();
                    adjustVolume(5);
                    return;
                }
                if (key === '-' || key === '_') {
                    e.preventDefault();
                    adjustVolume(-5);
                    return;
                }
                if (key === 'f' || key === 'F') {
                    if (currentPlayingItem) {
                        e.preventDefault();
                        setOverlayVisible(!uiVisible);
                        return;
                    }
                }
            }

            // 0. Parental PIN Modal
            if (pinModalOpen) {
                var pinFocusedEl = getFocusedModalElement(pinGrid, pinModalRow, pinModalCol);
                if (code >= 48 && code <= 57) {
                    if (document.activeElement !== inpPinVerifyEl && inpPinVerifyEl) {
                        e.preventDefault();
                        if (inpPinVerifyEl.value.length < 4) {
                            inpPinVerifyEl.value += String(code - 48);
                        }
                    }
                    return;
                }
                if (document.activeElement === inpPinVerifyEl && isBackspaceKey && inpPinVerifyEl.value.length > 0) {
                    return;
                }
                e.preventDefault();
                if (isBack || isBackspaceKey) {
                    if (document.activeElement === inpPinVerifyEl) {
                        inpPinVerifyEl.blur();
                    } else {
                        closePinModal();
                    }
                } else if (isUp) {
                    if (inpPinVerifyEl) {
                        inpPinVerifyEl.blur();
                    }
                    pinModalRow = Math.max(0, pinModalRow - 1);
                    pinModalCol = Math.min(pinModalCol, pinGrid[pinModalRow].length - 1);
                    updatePinModalFocus();
                } else if (isDown) {
                    if (inpPinVerifyEl) {
                        inpPinVerifyEl.blur();
                    }
                    pinModalRow = Math.min(pinGrid.length - 1, pinModalRow + 1);
                    pinModalCol = Math.min(pinModalCol, pinGrid[pinModalRow].length - 1);
                    updatePinModalFocus();
                } else if (isLeft) {
                    pinModalCol = Math.max(0, pinModalCol - 1);
                    updatePinModalFocus();
                } else if (isRight) {
                    pinModalCol = Math.min(pinGrid[pinModalRow].length - 1, pinModalCol + 1);
                    updatePinModalFocus();
                } else if (isEnter) {
                    if (pinFocusedEl === btnPinCancelEl) {
                        closePinModal();
                    } else if (pinFocusedEl === inpPinVerifyEl && inpPinVerifyEl.value.length < 4 && document.activeElement !== inpPinVerifyEl) {
                        inpPinVerifyEl.focus();
                    } else {
                        verifyPinAndUnlock();
                    }
                }
                return;
            }

            // 1. Full EPG Guide Modal
            if (epgModalOpen) {
                e.preventDefault();
                if (isBack || isGuide) {
                    closeEpgModal();
                } else if (isUp) {
                    epgModalIdx = Math.max(0, epgModalIdx - 1);
                    renderEpgModalList();
                } else if (isDown) {
                    epgModalIdx = Math.min(epgModalItems.length - 1, epgModalIdx + 1);
                    renderEpgModalList();
                } else if (isEnter) {
                    triggerSelectedEpgProgram();
                }
                return;
            }
            // 2. Settings Modal
            if (settingsOpen) {
                var focusedEl = getFocusedModalElement(settingsGrid, settingsRow, settingsCol);
                if (imeActive && !isEnter && !isHardwareOrEscBack && !isUp && !isDown) {
                    return;
                }
                e.preventDefault();
                if (isBack || isHardwareOrEscBack) {
                    if (imeActive && focusedEl) {
                        focusedEl.blur();
                        imeActive = false;
                    } else {
                        closeSettings();
                    }
                } else if (isUp) {
                    if (imeActive && focusedEl) {
                        focusedEl.blur();
                    }
                    imeActive = false;
                    settingsRow = Math.max(0, settingsRow - 1);
                    settingsCol = Math.min(settingsCol, settingsGrid[settingsRow].length - 1);
                    updateSettingsFocus();
                } else if (isDown) {
                    if (imeActive && focusedEl) {
                        focusedEl.blur();
                    }
                    imeActive = false;
                    settingsRow = Math.min(settingsGrid.length - 1, settingsRow + 1);
                    settingsCol = Math.min(settingsCol, settingsGrid[settingsRow].length - 1);
                    updateSettingsFocus();
                } else if (isLeft) {
                    if (imeActive && focusedEl) {
                        focusedEl.blur();
                        imeActive = false;
                    }
                    settingsCol = Math.max(0, settingsCol - 1);
                    updateSettingsFocus();
                } else if (isRight) {
                    if (imeActive && focusedEl) {
                        focusedEl.blur();
                        imeActive = false;
                    }
                    settingsCol = Math.min(settingsGrid[settingsRow].length - 1, settingsCol + 1);
                    updateSettingsFocus();
                } else if (isEnter) {
                    if (focusedEl === selProfileEl) {
                        var nextProfIdx = (editingProfileIndex + 1) % profiles.length;
                        loadProfileIntoSettingsInputs(nextProfIdx);
                    } else if (focusedEl === selThemeEl) {
                        var themes = ['blue', 'green', 'red', 'amber'];
                        var curT = themes.indexOf(selThemeEl.value);
                        var nextT = (curT + 1) % themes.length;
                        selThemeEl.value = themes[nextT];
                        applyTheme(themes[nextT]);
                    } else if (focusedEl === btnSaveEl) {
                        saveSettingsAndBoot();
                    } else if (focusedEl === btnProfileNewEl) {
                        createNewProfileInSettings();
                    } else if (focusedEl === btnProfileDelEl) {
                        deleteCurrentProfileInSettings();
                    } else if (focusedEl === btnRestartEl) {
                        rebootApp();
                    } else if (focusedEl === btnCancelEl) {
                        closeSettings();
                    } else if (focusedEl === btnBackupExportEl) {
                        exportBackupJson();
                    } else if (focusedEl === btnBackupImportEl) {
                        importBackupJson();
                    } else if (focusedEl && focusedEl.tagName === 'INPUT') {
                        if (imeActive) {
                            focusedEl.blur();
                            imeActive = false;
                        } else {
                            imeActive = true;
                            focusedEl.focus();
                        }
                    }
                }
                return;
            }
            // 3. Global Search Modal
            if (searchOpen) {
                if (searchFocusArea === 'input' && !isDown && !isEnter && !isBack) {
                    if (searchDebounce) {
                        clearTimeout(searchDebounce);
                    }
                    searchDebounce = setTimeout(function() {
                        performSearch(searchInput ? searchInput.value : '');
                    }, 260);
                    return;
                }
                e.preventDefault();
                if (isBack) {
                    closeSearch();
                } else if (isDown) {
                    if (searchFocusArea === 'input' && searchResults.length > 0) {
                        searchFocusArea = 'results';
                        if (searchInput) {
                            searchInput.blur();
                            searchInput.classList.remove('focused');
                        }
                        renderSearchResults();
                    } else if (searchFocusArea === 'results') {
                        searchIdx = Math.min(searchResults.length - 1, searchIdx + 1);
                        renderSearchResults();
                    }
                } else if (isUp) {
                    if (searchFocusArea === 'results') {
                        if (searchIdx > 0) {
                            searchIdx--;
                            renderSearchResults();
                        } else {
                            searchFocusArea = 'input';
                            if (searchInput) {
                                searchInput.classList.add('focused');
                            }
                        }
                    }
                } else if (isEnter) {
                    if (searchFocusArea === 'input' && searchInput) {
                        searchInput.focus();
                        performSearch(searchInput.value);
                    } else if (searchFocusArea === 'results' && searchResults[searchIdx]) {
                        var chosen = searchResults[searchIdx];
                        closeSearch();
                        if (chosen.isCategoryResult) {
                            jumpToCategoryFromSearch(chosen);
                        } else if (chosen.isSeries) {
                            modeIdx = 2;
                            lastContentModeIdx = 2;
                            stepIntoSeries(chosen);
                        } else {
                            setOverlayVisible(false);
                            playItem(chosen);
                        }
                    }
                }
                return;
            }
            // 4. Filter Modal
            if (filterOpen) {
                var filterTargetEl = getFocusedModalElement(filterGrid, filterRow, filterCol);
                if (filterRow === 0 && !isDown && !isUp && !isEnter && !isBack) {
                    return;
                }
                e.preventDefault();
                if (isBack) {
                    closeFilterModal();
                } else if (isUp) {
                    if (inpFilterEl) {
                        inpFilterEl.blur();
                    }
                    filterRow = Math.max(0, filterRow - 1);
                    filterCol = Math.min(filterCol, filterGrid[filterRow].length - 1);
                    updateFilterFocus();
                } else if (isDown) {
                    if (inpFilterEl) {
                        inpFilterEl.blur();
                    }
                    filterRow = Math.min(filterGrid.length - 1, filterRow + 1);
                    filterCol = Math.min(filterCol, filterGrid[filterRow].length - 1);
                    updateFilterFocus();
                } else if (isLeft) {
                    filterCol = Math.max(0, filterCol - 1);
                    updateFilterFocus();
                } else if (isRight) {
                    filterCol = Math.min(filterGrid[filterRow].length - 1, filterCol + 1);
                    updateFilterFocus();
                } else if (isEnter) {
                    if (filterTargetEl === inpFilterEl) {
                        inpFilterEl.focus();
                    } else if (filterTargetEl === btnFilterApplyEl) {
                        var val = inpFilterEl ? inpFilterEl.value.trim() : '';
                        if (filterTargetCol === 'cats') {
                            catFilterText = val;
                        } else {
                            itemFilterText = val;
                        }
                        closeFilterModal();
                        applyColumnFilters();
                        renderUI();
                    } else if (filterTargetEl === btnFilterClearEl) {
                        if (filterTargetCol === 'cats') {
                            catFilterText = '';
                        } else {
                            itemFilterText = '';
                        }
                        closeFilterModal();
                        applyColumnFilters();
                        renderUI();
                    }
                }
                return;
            }

            // 4b. Interactive Audio & Subtitle Track Picker Modal
            if (tracksModalOpen) {
                e.preventDefault();
                if (isBack) {
                    closeTracksModal();
                } else if (isUp && tracksModalItems.length > 0) {
                    tracksModalIdx = (tracksModalIdx - 1 + tracksModalItems.length) % tracksModalItems.length;
                    renderTracksModalList();
                } else if (isDown && tracksModalItems.length > 0) {
                    tracksModalIdx = (tracksModalIdx + 1) % tracksModalItems.length;
                    renderTracksModalList();
                } else if (isLeft) {
                    cycleSubtitleColor();
                } else if (isRight) {
                    cycleSubtitleSize();
                } else if (isEnter) {
                    activateSelectedTrackModalRow();
                }
                return;
            }

            // 4c. Fullscreen Quick Channel Zapper Drawer
            if (miniZapOpen) {
                e.preventDefault();
                if (isBack) {
                    closeMiniZapDrawer();
                } else if (isGuide || isLeft || isRight) {
                    closeMiniZapDrawer();
                    setOverlayVisible(true);
                } else if ((isUp || isChUp) && currentItems.length > 0) {
                    miniZapIdx = (miniZapIdx - 1 + currentItems.length) % currentItems.length;
                    renderMiniZapList();
                } else if ((isDown || isChDown) && currentItems.length > 0) {
                    miniZapIdx = (miniZapIdx + 1) % currentItems.length;
                    renderMiniZapList();
                } else if (isEnter && currentItems[miniZapIdx]) {
                    itemIdx = miniZapIdx;
                    renderItems();
                    playItem(currentItems[miniZapIdx]);
                    renderMiniZapList();
                }
                return;
            }

            if (code >= 48 && code <= 57 && !imeActive && !isInputFocused) {
                e.preventDefault();
                handleNumInput(code - 48);
                return;
            }

            // 5. Dedicated Media Transport Keys (work in both Overlay and Fullscreen)
            if (isPlayPause || (isPlay && isPaused) || (isPause && !isPaused)) {
                e.preventDefault();
                togglePlayPause();
                return;
            }
            if (isStop && currentPlayingItem) {
                e.preventDefault();
                stopPlayback();
                setOverlayVisible(true);
                return;
            }
            if (isRewind && (isPlayingVod || isPlayingCatchup)) {
                e.preventDefault();
                scrubVodByOffset(-30000);
                return;
            }
            if (isFastForward && (isPlayingVod || isPlayingCatchup)) {
                e.preventDefault();
                scrubVodByOffset(30000);
                return;
            }

            // 6. Fullscreen Playback Controls (when UI overlay is hidden)
            if (!uiVisible) {
                e.preventDefault();
                if (nextEpCandidate && isEnter) {
                    var targetEp = nextEpCandidate;
                    clearNextEpisodePrompt();
                    playItem(targetEp);
                    return;
                }
                if (nextEpCandidate && isBack) {
                    if (currentPlayingItem) {
                        nextEpDismissedForId = currentPlayingItem.id;
                    }
                    clearNextEpisodePrompt();
                    return;
                }
                if (isBack) {
                    setOverlayVisible(true);
                } else if (isEnter) {
                    if (!isPlayingVod && !isPlayingCatchup && currentItems.length > 0) {
                        openMiniZapDrawer();
                    } else {
                        setOverlayVisible(true);
                    }
                } else if (isInfo) {
                    updateOsdStreamTelemetry();
                    showOSD(formatOsdTitle(currentPlayingItem), isPlayingCatchup ? 'CATCH-UP' : (isPlayingVod ? 'VOD' : 'LIVE'));
                } else if (isGuide) {
                    openEpgModal(currentPlayingItem);
                } else if (isLeft && (isPlayingVod || isPlayingCatchup)) {
                    scrubVodByOffset(-30000);
                } else if (isRight && (isPlayingVod || isPlayingCatchup)) {
                    scrubVodByOffset(30000);
                } else if (isChUp && (isPlayingVod || isPlayingCatchup)) {
                    scrubVodByOffset(600000);
                } else if (isChDown && (isPlayingVod || isPlayingCatchup)) {
                    scrubVodByOffset(-600000);
                } else if ((isUp || isChUp) && !isPlayingVod && !isPlayingCatchup && currentItems.length > 0) {
                    itemIdx = (itemIdx - 1 + currentItems.length) % currentItems.length;
                    renderItems();
                    showOSD(formatOsdTitle(currentItems[itemIdx]), 'ZAPPING...');
                    if (zapTimeout) {
                        clearTimeout(zapTimeout);
                    }
                    zapTimeout = setTimeout(function() {
                        playItem(currentItems[itemIdx]);
                    }, 220);
                } else if ((isDown || isChDown) && !isPlayingVod && !isPlayingCatchup && currentItems.length > 0) {
                    itemIdx = (itemIdx + 1) % currentItems.length;
                    renderItems();
                    showOSD(formatOsdTitle(currentItems[itemIdx]), 'ZAPPING...');
                    if (zapTimeout) {
                        clearTimeout(zapTimeout);
                    }
                    zapTimeout = setTimeout(function() {
                        playItem(currentItems[itemIdx]);
                    }, 220);
                } else if (isRed) {
                    cycleAudioTrack();
                } else if (isGreen) {
                    toggleAspectRatio();
                } else if (isBlue) {
                    cycleSubtitles();
                } else if (isYellow && currentPlayingItem) {
                    toggleFavorite(currentPlayingItem);
                }
                return;
            }
            // 7. Main 4-Column Overlay Navigation (Modes -> Categories -> Items -> Info Quick Actions)
            e.preventDefault();
            if (isGuide) {
                openEpgModal(currentItems[itemIdx]);
                return;
            }
            if (isInfo && currentPlayingItem) {
                setOverlayVisible(false);
                updateOsdStreamTelemetry();
                showOSD(formatOsdTitle(currentPlayingItem), isPlayingCatchup ? 'CATCH-UP' : (isPlayingVod ? 'VOD' : 'LIVE'));
                return;
            }
            if (isYellow && activeCol === 'cats' && currentCats[catIdx]) {
                togglePinCategory(currentCats[catIdx]);
                return;
            }
            if (isYellow && (activeCol === 'items' || activeCol === 'info') && currentItems[itemIdx]) {
                toggleFavorite(currentItems[itemIdx]);
                return;
            }
            if (isRed) {
                var sorts = ['added', 'title_asc', 'title_desc'];
                currentSort = sorts[(sorts.indexOf(currentSort) + 1) % sorts.length];
                showToast('⇅ Sort: ' + currentSort.replace('title_', '').toUpperCase());
                applyColumnFilters();
                renderUI();
                return;
            }
            if (isGreen) {
                openSearch();
                return;
            }
            if (isBlue) {
                openFilterModal(activeCol === 'cats' ? 'cats' : 'items');
                return;
            }
            if (isLeft) {
                if (activeCol === 'info') {
                    if (infoActionIdx % 2 === 1) {
                        infoActionIdx = Math.max(0, infoActionIdx - 1);
                        updateInfoActionsFocus();
                    } else {
                        activeCol = 'items';
                        updateColumnFocusClasses();
                    }
                } else if (activeCol === 'items') {
                    if (!stepOutSeries()) {
                        activeCol = 'cats';
                        updateColumnFocusClasses();
                    }
                } else if (activeCol === 'cats') {
                    activeCol = 'modes';
                    updateColumnFocusClasses();
                }
            } else if (isRight) {
                if (activeCol === 'modes') {
                    activeCol = 'cats';
                    updateColumnFocusClasses();
                } else if (activeCol === 'cats') {
                    activeCol = 'items';
                    updateColumnFocusClasses();
                } else if (activeCol === 'items' && quickActionButtons.length > 0) {
                    activeCol = 'info';
                    infoActionIdx = 0;
                    updateColumnFocusClasses();
                } else if (activeCol === 'info') {
                    if (infoActionIdx + 1 < quickActionButtons.length) {
                        infoActionIdx++;
                        updateInfoActionsFocus();
                    }
                }
            } else if (isUp) {
                if (activeCol === 'modes') {
                    modeIdx = (modeIdx - 1 + modes.length) % modes.length;
                    renderModes();
                } else if (activeCol === 'cats' && currentCats.length > 0) {
                    catIdx = (catIdx - 1 + currentCats.length) % currentCats.length;
                    renderCats();
                } else if (activeCol === 'items' && currentItems.length > 0) {
                    itemIdx = Math.max(0, itemIdx - 1);
                    renderItems();
                    updatePreviewPanel();
                } else if (activeCol === 'info' && quickActionButtons.length > 0) {
                    infoActionIdx = Math.max(0, infoActionIdx - 2);
                    updateInfoActionsFocus();
                }
            } else if (isDown) {
                if (activeCol === 'modes') {
                    modeIdx = (modeIdx + 1) % modes.length;
                    renderModes();
                } else if (activeCol === 'cats' && currentCats.length > 0) {
                    catIdx = (catIdx + 1) % currentCats.length;
                    renderCats();
                } else if (activeCol === 'items' && currentItems.length > 0) {
                    itemIdx = Math.min(currentItems.length - 1, itemIdx + 1);
                    renderItems();
                    updatePreviewPanel();
                    loadMoreCatalogIfNeeded();
                } else if (activeCol === 'info' && quickActionButtons.length > 0) {
                    infoActionIdx = Math.min(quickActionButtons.length - 1, infoActionIdx + 2);
                    updateInfoActionsFocus();
                }
            } else if (isChUp && activeCol === 'items' && currentItems.length > 0) {
                itemIdx = Math.max(0, itemIdx - 10);
                renderItems();
                updatePreviewPanel();
            } else if (isChDown && activeCol === 'items' && currentItems.length > 0) {
                itemIdx = Math.min(currentItems.length - 1, itemIdx + 10);
                renderItems();
                updatePreviewPanel();
                loadMoreCatalogIfNeeded();
            } else if (isEnter) {
                if (activeCol === 'modes') {
                    switchMode(modeIdx);
                    if (modes[modeIdx].id !== 'search' && modes[modeIdx].id !== 'settings') {
                        activeCol = 'cats';
                        updateColumnFocusClasses();
                    }
                } else if (activeCol === 'cats') {
                    activeCol = 'items';
                    updateColumnFocusClasses();
                    selectCategory(catIdx);
                } else if (activeCol === 'items') {
                    activateCurrentItemSelection();
                } else if (activeCol === 'info' && quickActionButtons[infoActionIdx]) {
                    quickActionButtons[infoActionIdx].fn();
                }
            } else if (isBack) {
                if (activeCol === 'info') {
                    activeCol = 'items';
                    updateColumnFocusClasses();
                    return;
                }
                if (activeCol === 'items' && stepOutSeries()) {
                    return;
                }
                if (currentPlayingItem) {
                    setOverlayVisible(false);
                } else {
                    if (exitConfirmPending) {
                        try {
                            if (typeof tizen !== 'undefined' && tizen.application) {
                                tizen.application.getCurrentApplication().exit();
                            }
                        } catch (ex) {}
                    } else {
                        exitConfirmPending = true;
                        showOSD('Exit Application', 'Press BACK again within 3 seconds to exit');
                        showToast('Press BACK again within 3 seconds to exit');
                        if (exitConfirmTimeout) {
                            clearTimeout(exitConfirmTimeout);
                        }
                        exitConfirmTimeout = setTimeout(function() {
                            exitConfirmPending = false;
                        }, 3000);
                    }
                }
            }
        });
    }

    function registerLifecycleHandlers() {
        document.addEventListener('visibilitychange', function() {
            try {
                if (typeof webapis === 'undefined' || !webapis.avplay) {
                    return;
                }
                if (document.hidden) {
                    clearBufferingWatchdog();
                    webapis.avplay.suspend();
                } else {
                    wakeLocalService().then(function() {
                        if (!currentPlayingItem) {
                            return;
                        }
                        try {
                            webapis.avplay.restore();
                            if (!isPlayingVod && !isPlayingCatchup) {
                                playItem(currentPlayingItem);
                            }
                        } catch (exRestore) {
                            playItem(currentPlayingItem);
                        }
                    });
                }
            } catch (ex) {}
        });
    }
    function updateClock() {
        if (!clockDisplayEl) {
            return;
        }
        var now = new Date();
        var hh = ('0' + now.getHours()).slice(-2);
        var mm = ('0' + now.getMinutes()).slice(-2);
        clockDisplayEl.textContent = hh + ':' + mm;
    }
    function initApp() {
        loadProfiles();
        applyTheme(localStorage.getItem('cfg_theme') || 'blue');
        updateClock();
        setInterval(updateClock, 15000);
        setupKeyListeners();
        setupMouseListeners();
        registerLifecycleHandlers();
        renderUI();
        wakeLocalService().then(function() {
            var portal = localStorage.getItem('cfg_portal');
            var mac = localStorage.getItem('cfg_mac');
            if (!portal || !mac) {
                openSettings();
                return;
            }
            api.boot().then(function() {
                switchMode(0);
            }).catch(function(err) {
                showOSD('Connection Error', err.message);
                openSettings();
            });
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
