# SmartSTB Clone v2 for Samsung Tizen Smart TVs

[![Tizen OS](https://img.shields.io/badge/Tizen%20OS-4.0%20to%209.0%2B-0083D6?logo=tizen&logoColor=white)](https://developer.samsung.com/smarttv)
[![Platform](https://img.shields.io/badge/Platform-Samsung%20Smart%20TV-1428A0?logo=samsung&logoColor=white)](https://www.samsung.com/)
[![Resolution](https://img.shields.io/badge/Viewport-1080p%20FHD%20%2F%204K%20UHD-success)](#hardware-accelerated-video-playback)
[![Engine](https://img.shields.io/badge/Player-Hardware%20AVPlay-blueviolet)](#key-features)
[![Protocol](https://img.shields.io/badge/Middleware-Stalker%20%2F%20Ministra-blue)](#stalker--ministra-portal-integration)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A high-performance, hardware-accelerated IPTV client engineered specifically for **Samsung Smart TVs running Tizen OS** (Tizen 4.0+ through 9.0+, model years 2018 to present). 

Designed as a modern, lightweight, and customizable replacement for legacy set-top box middleware, it provides a native **10-foot remote-controlled television interface** with complete Stalker / Ministra portal integration, seamless EPG timelines, catch-up TV archives, multi-season VOD series management, multi-audio/subtitle track picker, and a built-in local background streaming proxy service.

---

## Table of Contents

1. [Key Features](#key-features)
2. [Project Architecture & File Layout](#project-architecture--file-layout)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Installation on Samsung Tizen TV](#step-by-step-installation-on-samsung-tizen-tv)
   - [Phase 1: Enable Developer Mode on your Samsung TV](#phase-1-enable-developer-mode-on-your-samsung-tv)
   - [Phase 2: Install Tizen Studio & TV Extension](#phase-2-install-tizen-studio--tv-extension)
   - [Phase 3: Generate Samsung Certificates (Author & Distributor)](#phase-3-generate-samsung-certificates-author--distributor)
   - [Phase 4: Connect Tizen Studio to your Samsung TV](#phase-4-connect-tizen-studio-to-your-samsung-tv)
   - [Phase 5: Build and Deploy the `.wgt` Package](#phase-5-build-and-deploy-the-wgt-package)
5. [Remote Control Button Mapping](#remote-control-button-mapping)
6. [Initial Setup & Portal Configuration](#initial-setup--portal-configuration)
7. [Troubleshooting & FAQs](#troubleshooting--faqs)
8. [License](#license)

---

## Key Features

### 📺 4-Column 1080p Broadcast Interface
- **Optimized 10-Foot UI**: 60 FPS remote navigation across **Main Menu** (Modes), **Categories**, **Channels / Items**, and **Details & EPG**.
- **Virtual 12-Row Sliding Window**: Effortlessly scrolls playlists with **10,000+ channels** without DOM bloat, sluggishness, or memory leaks on low-memory TV chipsets.
- **Quick Action Bar**: Press `Right` from any item to access instant shortcuts (Play, Favorite, Full EPG, Audio/Subs, Aspect Ratio, Sleep Timer, Sort, Filter, Refresh, and Clear History).
- **Multiple Color Themes**: Select between **Classic Blue**, **Emerald Green**, **Crimson Red**, and **Gold Amber** accents.

### 🚀 Hardware-Accelerated Video Playback (`AVPlay`)
- **Native Samsung Media Pipeline**: Directly taps into Samsung's hardware decoder engine (`webapis.avplay`) for zero-buffer MPEG-TS, HLS, MP4, and MKV streaming.
- **Full Hardware Audio Support**: Built-in firmware decoding of **Dolby Digital (`AC-3`)**, **Dolby Digital Plus (`E-AC-3`)**, **DTS**, **AAC**, and **MP2**.
- **Real-Time Stream Telemetry**: Live OSD displays resolution badges (`4K UHD`, `1080p FHD`, `720p HD`), frame rate (`FPS`), and active audio/video codecs.
- **Aspect Ratio Control**: Instant switching between **Original Aspect (Letterbox)** and **16:9 Fullscreen Stretch** via the Green button or Quick Actions.

### 📅 24-Hour EPG & Catch-Up TV Archive
- **Full Electronic Program Guide**: Press `GUIDE` on any channel to inspect a full 24-hour visual schedule.
- **One-Touch Catch-Up Archive**: Past broadcasts flagged with the `⏱` badge can be replayed instantly through Stalker `tv_archive` linking.
- **Live Progress & What's Next**: Live EPG progress indicator bar and real-time "Now / Next" indicators on both the OSD banner and channel rows.

### ⚡ Fullscreen Quick Channel Zapper (Mini-Zap Drawer)
- **Overlay Drawer**: While watching live TV in fullscreen, press `ENTER` to bring up a transparent side drawer displaying the active category's channel list.
- **Fast Channel Surfing**: Switch channels immediately without interrupting fullscreen playback or navigating back through the full 4-column menu.

### 🎬 VOD Movies & Multi-Season Series
- **Rich Metadata**: High-resolution posters, IMDb ratings, release years, synopsis, and cast details.
- **Season & Episode Breakdown**: Easily step into series folders with season selectors and episode listings.
- **Resume Playback & Progress Tracks**: Automatically saves resume positions for partially watched movies and shows.
- **Auto-Advance "Up Next"**: Displays an interactive 10-second countdown banner before transitioning to the next episode.

### 🔊 Audio & Subtitle Track Control
- **Multi-Audio Switching**: Choose between multiple audio language tracks (e.g., English 5.1, Spanish Stereo, Director's Commentary) in real time.
- **Clean Outline Subtitles**: Rendered with high-contrast broadcast outline shadows and **zero dark background box**, keeping the video clear and unobstructed.
- **Customization on the Fly**: Toggle between **White**, **Yellow**, and **Cyan** colors and **Normal**, **Large**, or **Extra-Large** font sizes directly from the remote.

### ⚙ Multi-Portal Profile System
- **Multiple Stalker Portals**: Store multiple IPTV provider profiles with unique portal URLs and custom MAC addresses.
- **Instant Profile Switching**: Switch between profiles seamlessly in Settings with zero memory leaks or freezing.
- **Complete Profile Isolation**: Favorites, recents, resume timestamps, and pinned categories are strictly isolated per profile.
- **Clean Profile Deletion**: Deleting a profile completely purges its cached metadata and configurations from storage.
- **Backup & Restore**: Export and import your complete profile collection and app settings to/from JSON.

### 🔒 Parental Control & Sleep Timer
- **4-Digit PIN Protection**: Lock adult and sensitive categories behind a PIN prompt (`0000` by default, customizable in Settings).
- **Sleep Timer**: Schedule automatic playback termination after 30, 60, 90, or 120 minutes.

---

## Project Architecture & File Layout

```text
├── config.xml             # Tizen TV Widget configuration, TV privileges & Background Node Service definition
├── index.html             # 1920x1080 TV viewport, AVPlay object container, modals, and OSD structures
├── app.js                 # Complete application controller (ES5 strict mode, Stalker client, AVPlay & UI)
├── icon.png               # High-resolution 512x512 application launcher icon
├── css/
│   └── style.css          # Hardware-accelerated 1080p stylesheet, color themes & subtitle outline rules
└── service/
    └── proxy.js           # Local Node.js background HTTP proxy service (cookie jar, redirect & header injection)
```

### Background Proxy Service (`service/proxy.js`)
Samsung Tizen TVs enforce strict browser security on web applications. IPTV Stalker portals require custom `User-Agent` headers (emulating MAG set-top boxes), persistent cookie jars (`mac=...; timezone=...`), and HTTP redirect resolution. 

The embedded background service runs locally on the TV at `http://127.0.0.1:3001` (falling back to `3000`), handling:
- MAG250 identity signatures (`sn`, `device_id`, `device_id2`, `signature`).
- Transparent cookie jar management and Stalker token refresh.
- Seamless MPEG-TS and HLS manifest rewriting for direct AVPlay hardware consumption.

---

## Prerequisites

Before installing the app on your Samsung Smart TV, ensure you have:
1. **Samsung Smart TV** running Tizen OS 4.0 or newer (Manufactured from 2018 onwards).
2. **PC / Mac / Linux** on the **same local Wi-Fi or Ethernet network** as your TV.
3. **Samsung Remote Control** (Standard IR remote with numeric keypad or Smart Remote).
4. **Active Stalker Portal URL** and an activated **MAC Address** (format: `00:1A:79:XX:XX:XX`).

---

## Step-by-Step Installation on Samsung Tizen TV

### Phase 1: Enable Developer Mode on your Samsung TV

1. Turn on your Samsung TV and press the **Home** button on your remote.
2. Navigate to **Apps** on the Smart Hub menu.
3. Inside the **Apps** screen, enter the numeric sequence **`1` `2` `3` `4` `5`** using your physical remote keypad (or on-screen numeric keypad).
4. A **Developer Mode Configuration** popup will appear:
   - Toggle **Developer Mode** to **ON**.
   - In the **Host PC IP** field, enter your computer's local IP address (e.g., `192.168.1.100`).
   - Click **OK**.
5. **Restart your TV**: Hold down the **Power** button on your remote control for **3–5 seconds** until the Samsung logo appears on screen (or unplug the TV power cord for 10 seconds).

---

### Phase 2: Install Tizen Studio & TV Extension

1. Download and install **Tizen Studio** (with IDE or CLI) from the official Samsung Developer portal:
   👉 [Samsung Developers: Tizen Studio Download](https://developer.samsung.com/smarttv/develop/tools/tizen-studio/download.html)
2. Launch **Tizen Package Manager**:
   - Under the **Main SDK** tab, install **Tizen SDK Tools**.
   - Under the **Extension SDK** tab, install:
     - **TV Extensions** (matching or higher than your TV's Tizen version, e.g., 7.0 or 6.5).
     - **Samsung Certificate Extension**.

---

### Phase 3: Generate Samsung Certificates (Author & Distributor)

Samsung Smart TVs reject unsigned `.wgt` packages. You must generate a free Samsung certificate tied to your TV's Unique Device ID (DUID):

1. Open **Tizen Studio**.
2. Go to **Tools** > **Certificate Manager**.
3. Click the **+** (New) button:
   - Select **Samsung** (do not select Tizen).
   - Choose **TV**.
   - Create a new **Author Certificate** (enter your name and a password).
   - Sign in with your free **Samsung Account**.
4. In the next step, create a **Distributor Certificate**:
   - Ensure the privilege level is set to **Public** or **Partner**.
   - Under **Individual DUIDs**, connect your TV or manually add your TV's DUID (found in TV Menu > Support > About This TV).
5. Click **Finish**. Ensure the new certificate profile is checked as **Active**.

---

### Phase 4: Connect Tizen Studio to your Samsung TV

1. In Tizen Studio, go to **Tools** > **Device Manager**.
2. Click the **Remote Device Manager** icon (top right).
3. Click **Scan** (or click **+** to add your TV manually):
   - **Name**: `SamsungTV`
   - **IP Address**: Enter your TV's local IP (e.g., `192.168.1.150`).
   - **Port**: `26101` (default).
4. Toggle the connection switch to **ON**.
5. Once connected, right-click your TV in Device Manager and select **"Permit to install applications"** (this uploads your distributor certificate to the TV).

---

### Phase 5: Build and Deploy the `.wgt` Package

#### Method A: Using Tizen Studio GUI (Recommended)
1. Open Tizen Studio.
2. Select **File** > **Import** > **Tizen** > **Tizen Project**.
3. Choose **Archive file** or **Directory** pointing to the repository folder containing `config.xml`.
4. Right-click the imported project in Project Explorer.
5. Select **Run As** > **Tizen Web Application**.
6. Tizen Studio will automatically package the app, sign it with your certificate, transfer it to your TV, and launch it!

#### Method B: Using Tizen CLI
Open your terminal inside the project directory:

```bash
# 1. Package into a .wgt file with your active certificate profile
tizen package -t wgt -s <YourCertificateProfileName> -- .

# 2. Check connected devices
sdb devices

# 3. Install on the TV
tizen install -s <TV_DEVICE_ID> -n SmartSTBclone.wgt

# 4. (Optional) Launch the app directly from terminal
tizen run -s <TV_DEVICE_ID> -p smartstbv2.SmartSTBclone
```

---

## Remote Control Button Mapping

| Remote Button | PC Key | Action in Overlay (Menu) | Action in Fullscreen Playback |
| :--- | :---: | :--- | :--- |
| **UP / DOWN** | `↑` / `↓` | Navigate list items vertically | Channel Zapping / Page Up/Down |
| **LEFT / RIGHT** | `←` / `→` | Switch column / Step out of series | Seek -30s / +30s (VOD & Catch-Up) |
| **ENTER / OK** | `Enter` | Select category / Play item / Quick action | Open **Mini-Zap Drawer** (Live TV) |
| **RETURN / BACK**| `Esc` / `Backspace` | Step back / Close modal / Hide overlay | Bring up Main 4-Column Guide |
| **RED BUTTON** | `R` | Cycle Sort Order (`Added`, `A-Z`, `Z-A`) | **Cycle Audio Tracks** |
| **GREEN BUTTON**| `G` | Open **Global Search Modal** | **Toggle Aspect Ratio** (Fit / Stretch) |
| **YELLOW BUTTON**| `Y` | Toggle Favorite / Pin Category to top | **Toggle Favorite** on active stream |
| **BLUE BUTTON** | `B` | Open **Column Filter Modal** | **Cycle Subtitles** (On / Off / Tracks) |
| **GUIDE / INFO**| `E` / `I` | Open 24h EPG Schedule Modal | Show Stream Telemetry & OSD Bar |
| **NUMBERS (0-9)**| `0` - `9` | Direct Channel Number Input | Direct Channel Jump (`0` = Previous Ch) |
| **PLAY / PAUSE** | `Space` | Toggle Play / Pause | Toggle Play / Pause |
| **CH UP / DOWN** | `PgUp` / `PgDn`| Jump 10 items | Channel Zap / Scrub +/-10 minutes |

---

## Initial Setup & Portal Configuration

1. When launched for the first time, the app opens the **Portal & Profile Settings** modal.
2. Enter your credentials:
   - **Profile Name**: E.g., `Living Room IPTV`
   - **Stalker Portal URL**: E.g., `http://portal.example.com/c/` or `http://provider.tv:8080/stalker_portal/c/`
   - **MAC Address**: Enter your registered MAG MAC address (e.g., `00:1A:79:A4:B2:C9`).
   - **UI Color Theme**: Choose your preferred accent color.
   - **Parental PIN**: Enter a 4-digit PIN (default: `0000`).
3. Click **Save & Connect**.
4. The local background service initiates the MAG handshake, syncs your channel genres, and immediately boots into Live TV.

---

## Troubleshooting & FAQs

### Q: The screen says "Local Proxy Service Unreachable"?
**A**: Ensure your TV's `config.xml` includes the `<tizen:service>` tag for `smartstbv2.StalkerProxy` and that network privileges are enabled. If testing via PC browser, ensure the local proxy server (`node service/proxy.js`) is running on port 3001.

### Q: "Categories couldn't load" or connection error on cold boot?
**A**: Some Stalker portals enforce a token handshake delay. SmartSTB v2 automatically retries authentication up to 16 times in the background. If your portal changed domains, click **⚡ Default** (top bar) to open Settings and verify your Portal URL and MAC.

### Q: Audio plays fine on TV, but is silent on PC?
**A**: Samsung Smart TVs have built-in hardware DSP licenses for Dolby Digital (`AC-3` / `E-AC-3`). Standard PC browsers (Chrome/Edge) do not decode AC-3 natively without transcoding. If using the companion PC version, run `pc-server.js` with `ffmpeg` installed to enable automatic on-the-fly AAC transcoding.

### Q: How do I backup my settings and channel favorites?
**A**: Open **Settings** > Click **Export Backup**. The app stores a complete encrypted snapshot to TV storage and local proxy memory, which can be restored anytime via **Import Backup**.

---

## License

This project is licensed under the [MIT License](LICENSE) — free for personal and community use.
Samsung, Tizen, SmartSTB, and MAG are trademarks of their respective owners. This application is an independent client implementation.
