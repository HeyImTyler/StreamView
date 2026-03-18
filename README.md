# STREAMVIEW

A browser-based stream viewer and diagnostic tool for triaging HLS and DASH video streams. Enter a manifest URL, and StreamView plays the stream while displaying real-time metrics across a fully customizable dashboard.

![StreamView Screenshot](https://img.shields.io/badge/status-stable-brightgreen) ![No Build](https://img.shields.io/badge/build-none-blue) ![License](https://img.shields.io/badge/license-MIT-yellow)

## Features

### Playback
- **HLS** (`.m3u8`) via [hls.js](https://github.com/video-dev/hls.js)
- **DASH** (`.mpd`) via [dash.js](https://github.com/Dash-Industry-Forum/dash.js)
- Native HLS fallback for Safari
- Manual quality override and auto ABR
- Preset demo streams included (Apple, Mux, Akamai, DASH-IF, etc.)

### Diagnostic Panels

| Panel | Description |
|-------|-------------|
| **Video Player** | Plays the stream with native controls |
| **Stream Info** | Format, URL, resolution, bitrate, codecs, quality levels, playback state, FPS, dropped frames, live latency, audio tracks |
| **Buffer** | Color-coded buffer bar, rebuffer count/duration, 60-second buffer history chart |
| **Network** | Bandwidth estimate, total downloaded, segment download table with timing, failed requests |
| **Timeline** | Step-chart of bitrate/quality level over playback time with level reference lines |
| **Events** | Timestamped player event log with severity badges (info/warn/error) |
| **Errors** | Error cards with fatal/non-fatal badges, type codes, collapsible details |
| **Manifest** | Raw manifest text viewer with copy-to-clipboard |
| **Metadata** | Timed metadata events (ID3, SCTE-35) with PTS and payload info |

### Customizable Dashboard
- **Drag and drop** panels to rearrange the layout
- **Resize** any panel by dragging edges/corners
- **Lock/Unlock** the layout to prevent accidental changes
- **Reset** to the default layout at any time
- Layout **persists to localStorage** across sessions
- Responsive — collapses to single-column on mobile

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Ctrl+L` | Focus URL input |

### URL Sharing
Append `#url=<encoded-manifest-url>` to the page URL to auto-load a stream. Useful for sharing links with teammates.

## Getting Started

StreamView is a **zero-build static site** — no npm, no bundler, no dependencies to install. Just serve the files over HTTP.

### Option 1: Python
```bash
cd StreamView
python -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080)

### Option 2: Node.js
```bash
cd StreamView
npx serve .
```

### Option 3: VS Code
Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension, then right-click `index.html` → **Open with Live Server**.

> **Note:** Opening `index.html` directly via `file://` will not work due to browser restrictions on ES module imports.

## Hosting

StreamView can be deployed to any static hosting platform with no configuration:

- **GitHub Pages** — push to a repo, enable Pages from root
- **Netlify / Vercel / Cloudflare Pages** — connect repo, deploy as-is
- **S3 / GCS** — upload files to a bucket with static website hosting enabled

No server-side code, no environment variables, no build step required.

## Project Structure

```
StreamView/
├── index.html              # App shell, CDN imports
├── css/
│   └── styles.css          # Dark theme, dashboard layout
├── js/
│   ├── app.js              # Main entry — init, wiring, controls
│   ├── player.js           # HLS/DASH player lifecycle & event wiring
│   ├── metrics.js          # Central metrics store (pub-sub)
│   ├── dashboard.js        # Gridstack dashboard, layout persistence
│   ├── presets.js           # Demo stream URLs
│   └── panels/
│       ├── stream-info.js  # Quality, codec, playback stats
│       ├── buffer.js       # Buffer bar & history chart
│       ├── network.js      # Bandwidth & segment downloads
│       ├── timeline.js     # Bitrate timeline chart
│       ├── events-log.js   # Player event log
│       ├── errors.js       # Error cards
│       ├── manifest.js     # Raw manifest viewer
│       └── metadata.js     # Timed metadata (ID3/SCTE-35)
└── favicon.svg
```

## CDN Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| [hls.js](https://github.com/video-dev/hls.js) | 1.5.17 | HLS playback |
| [dash.js](https://github.com/Dash-Industry-Forum/dash.js) | 4.7.4 | DASH playback |
| [gridstack.js](https://github.com/gridstack/gridstack.js) | 10.x | Drag-and-drop dashboard |
| [Google Fonts](https://fonts.google.com) | — | Big Shoulders Display, Barlow Condensed |

All loaded from CDN at runtime — nothing to install.

## License

MIT
