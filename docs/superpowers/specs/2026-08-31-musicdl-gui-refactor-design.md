# Musicdl GUI Refactor — Modern Desktop Music App

**Date:** 2026-08-31
**Branch:** `feature/modern-gui-refactor`
**Status:** Design Approved

## 1. Goal

Rebuild the `musicdlgui` example application with a modern UI/UX that matches the quality of commercial music desktop software (Spotify, Apple Music, NetEase Cloud Music). Phase 1 focuses on the core experience: search → download → download management, with polished visual design.

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Desktop Shell | Electron | True desktop app feel, system window chrome, cross-platform |
| Frontend | React 18 + Vite | Component-based UI, HMR for fast dev, ecosystem |
| Styling | Tailwind CSS v4 | Utility-first, dark theme by default, rapid iteration |
| Backend | FastAPI + Uvicorn | Native async, WebSocket support, modern Python |
| Real-time | WebSocket | Bidirectional streaming for search results and download progress |
| Packaging | electron-builder | Cross-platform packaging (.exe/.dmg/.AppImage) |

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Electron Shell                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              React SPA (Renderer)              │  │
│  │  ┌──────────┐  ┌──────────────────────────┐  │  │
│  │  │ Sidebar   │  │    Main Content Area      │  │  │
│  │  │ - Logo    │  │  ┌──────────────────────┐ │  │  │
│  │  │ - Sources │  │  │   Search Bar          │ │  │  │
│  │  │ - Nav     │  │  │   + Source Tags       │ │  │  │
│  │  │           │  │  └──────────────────────┘ │  │  │
│  │  │           │  │  ┌──────────────────────┐ │  │  │
│  │  │           │  │  │   Result Cards Grid   │ │  │  │
│  │  │           │  │  └──────────────────────┘ │  │  │
│  │  │           │  │  ┌──────────────────────┐ │  │  │
│  │  │           │  │  │   Download Panel      │ │  │  │
│  │  │           │  │  │   (collapsible)       │ │  │  │
│  │  │           │  │  └──────────────────────┘ │  │  │
│  │  └──────────┘  └──────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│                         │ WebSocket + REST           │
│  ┌───────────────────────────────────────────────┐  │
│  │        FastAPI Backend (child process)          │  │
│  │  ┌──────────────┐  ┌────────────────────────┐ │  │
│  │  │ WS /ws/search │  │  WS /ws/download       │ │  │
│  │  │ → musicdl     │  │  → musicdl download     │ │  │
│  │  │   .search()   │  │    with progress events │ │  │
│  │  └──────────────┘  └────────────────────────┘ │  │
│  │                    musicdl library              │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Backend runs as an Electron child process.** The Electron main process spawns the FastAPI server via `child_process.spawn`. The React frontend connects to `localhost:{PORT}`. The user never sees a terminal or manually starts a server.
- **WebSocket is the only real-time channel.** Search results stream to the frontend one track at a time as they resolve — the user sees results appear progressively, not after waiting for all sources. Download progress updates stream in real time.
- **No global state library.** React `useReducer` + Context is sufficient for this app's complexity. Two contexts (`SearchContext` + `DownloadContext`) handle separate concerns with no coupling.
- **Tailwind dark theme is the default.** No light mode toggle in Phase 1 — the app is dark from the start, matching modern music app conventions.

## 4. Component Tree

```
App
├── Sidebar
│   ├── AppLogo
│   ├── SourceList          ← multi-select music sources (tag-style toggles)
│   └── DownloadQueueBadge   ← badge showing active download count
├── MainContent
│   ├── SearchBar            ← input + search button + active source tags
│   └── ResultGrid
│       └── ResultCard[]     ← cover art + song name + artist + duration + quality badge + download button
└── DownloadPanel (bottom collapsible panel)
    ├── DownloadPanelHeader  ← title + collapse toggle + overall progress
    └── DownloadItem[]       ← file name + progress bar + speed + pause/cancel/retry
```

## 5. State Shape

```typescript
AppState {
  sources: {
    [name: string]: {
      enabled: boolean
      label: string
      short: string
    }
  }
  search: {
    keyword: string
    status: 'idle' | 'searching' | 'done'
    results: SongInfo[]      // appended incrementally as WS messages arrive
  }
  downloads: {
    items: DownloadTask[]    // { id, songInfo, progress%, speed, status }
    panelExpanded: boolean
  }
}
```

## 6. WebSocket Protocol

### Search Channel `/ws/search`

```
Client → Server:
  { "type": "search", "keyword": "Jay Chou", "sources": ["NeteaseMusicClient", "QQMusicClient"] }

Server → Client:
  { "type": "result", "song_info": { ... } }
  { "type": "source_done", "source": "NeteaseMusicClient" }
  { "type": "search_done" }
  { "type": "error", "source": "QQMusicClient", "message": "..." }
```

### Download Channel `/ws/download`

```
Client → Server:
  { "type": "download", "song_infos": [...] }
  { "type": "pause", "task_id": "uuid" }
  { "type": "cancel", "task_id": "uuid" }

Server → Client:
  { "type": "progress", "task_id": "uuid", "song_name": "...", "percent": 45.2, "speed": "1.2MB/s" }
  { "type": "complete", "task_id": "uuid" }
  { "type": "error", "task_id": "uuid", "message": "..." }
```

## 7. Directory Structure

```
examples/musicdlgui/
├── electron/                    # Electron main process
│   ├── main.js                  # spawns Python backend + creates BrowserWindow
│   ├── preload.js               # preload script (IPC bridge)
│   └── package.json             # Electron dependencies
├── backend/                     # FastAPI backend
│   ├── server.py                # FastAPI app entry point + lifecycle
│   ├── ws_search.py             # search WebSocket handler
│   ├── ws_download.py           # download WebSocket handler
│   └── requirements.txt         # Python backend dependencies
├── frontend/                    # React frontend
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── contexts/
│       │   ├── SearchContext.jsx
│       │   └── DownloadContext.jsx
│       ├── hooks/
│       │   ├── useWebSocket.js  # generic WS hook with auto-reconnect
│       │   ├── useSearch.js
│       │   └── useDownload.js
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── SourceList.jsx
│       │   ├── SearchBar.jsx
│       │   ├── ResultGrid.jsx
│       │   ├── ResultCard.jsx
│       │   ├── DownloadPanel.jsx
│       │   └── DownloadItem.jsx
│       └── styles/
│           └── index.css        # Tailwind directives + minimal custom styles
├── musicdlgui.py                # preserved old version with deprecation notice
├── icon.ico
└── README.md                    # updated
```

## 8. Build & Dev Workflow

```bash
# Start backend (development)
cd examples/musicdlgui/backend && uvicorn server:app --port 8765

# Start frontend dev server (development)
cd examples/musicdlgui/frontend && npm run dev
# Open http://localhost:5173

# Package as desktop app (production)
cd examples/musicdlgui && npm run build:electron
```

## 9. Scope — Phase 1 (This Iteration)

**In scope:**
- Search: progressive result streaming via WebSocket, multi-source with visual tags
- Download: single-click download from result cards, real-time progress
- Download management: collapsible bottom panel with progress bars, pause, cancel, retry
- UI: dark theme, modern card-based layout, responsive
- Desktop packaging: Electron build for Windows

**Out of scope (future phases):**
- Built-in music player / playback
- Local music library management
- Playlist parsing and import
- Lyrics display
- Light/dark theme toggle
- System tray integration
- macOS / Linux packaging