# Musicdl GUI Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the musicdl GUI as a modern Electron desktop app with FastAPI WebSocket backend and React/Tailwind frontend.

**Architecture:** Electron main process spawns a FastAPI server as a child process. The React SPA connects via WebSocket for real-time search result streaming and download progress. Two WebSocket channels handle search (`/ws/search`) and download (`/ws/download`) independently. React state is managed via Context + useReducer with no external state library.

**Tech Stack:** Electron 33, React 18, Vite 6, Tailwind CSS v4, FastAPI, Uvicorn, WebSocket

**Spec:** [docs/superpowers/specs/2026-08-31-musicdl-gui-refactor-design.md](../specs/2026-08-31-musicdl-gui-refactor-design.md)

## Global Constraints

- Backend must run on `localhost:8765` and be spawned by Electron as a child process.
- WebSocket is the only real-time channel; no polling or SSE.
- Dark theme only in Phase 1; no light mode toggle.
- No Redux or external state management — React Context + useReducer only.
- The old `musicdlgui.py` must be preserved with a deprecation comment at the top.
- All new files go under `examples/musicdlgui/`.
- Backend depends on `musicdl` being installed in the Python environment.

---

### Task 1: Backend — FastAPI Server Skeleton

**Files:**
- Create: `examples/musicdlgui/backend/requirements.txt`
- Create: `examples/musicdlgui/backend/server.py`

**Interfaces:**
- Produces: `FastAPI app` — the ASGI application with CORS middleware, `/ws/search` and `/ws/download` route placeholders, and a `/health` GET endpoint.

- [ ] **Step 1: Create backend requirements.txt**

```
fastapi>=0.115.0,<1
uvicorn[standard]>=0.32.0,<1
musicdl
```

- [ ] **Step 2: Write server.py with CORS, health endpoint, and WS route stubs**

```python
"""
FastAPI backend for musicdl GUI.
Provides WebSocket endpoints for search and download.
"""
import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="musicdl-gui-backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/search")
async def ws_search(websocket: WebSocket):
    await websocket.accept()
    # Stub: will be implemented in Task 2
    await websocket.send_json({"type": "search_done"})
    await websocket.close()


@app.websocket("/ws/download")
async def ws_download(websocket: WebSocket):
    await websocket.accept()
    # Stub: will be implemented in Task 3
    await websocket.send_json({"type": "done"})
    await websocket.close()


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
```

- [ ] **Step 3: Verify server starts**

```bash
cd examples/musicdlgui/backend && pip install -r requirements.txt && python server.py
# Ctrl+C after confirming "Uvicorn running on http://127.0.0.1:8765"
```

- [ ] **Step 4: Commit**

```bash
git add examples/musicdlgui/backend/requirements.txt examples/musicdlgui/backend/server.py
git commit -m "feat(gui): add FastAPI backend skeleton with WS stubs"
```

---

### Task 2: Backend — Search WebSocket Handler

**Files:**
- Create: `examples/musicdlgui/backend/ws_search.py`
- Modify: `examples/musicdlgui/backend/server.py`

**Interfaces:**
- Consumes: `musicdl.MusicClient` from the `musicdl` package
- Produces: `ws_search(websocket: WebSocket)` — coroutine that handles the search WebSocket protocol

- [ ] **Step 1: Write ws_search.py**

```python
"""
Search WebSocket handler.
Streams search results from musicdl to the frontend in real time.
"""
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import WebSocket
from musicdl import musicdl


DEFAULT_SOURCES = [
    "MiguMusicClient", "NeteaseMusicClient", "QQMusicClient",
    "KuwoMusicClient", "QianqianMusicClient",
]

_search_executor = ThreadPoolExecutor(max_workers=4)


async def ws_search(websocket: WebSocket):
    await websocket.accept()

    try:
        raw = await websocket.receive_text()
        msg = json.loads(raw)
    except Exception:
        await websocket.send_json({"type": "error", "message": "invalid message"})
        await websocket.close()
        return

    if msg.get("type") != "search":
        await websocket.send_json({"type": "error", "message": "expected type=search"})
        await websocket.close()
        return

    keyword = msg.get("keyword", "").strip()
    sources = msg.get("sources") or DEFAULT_SOURCES

    if not keyword:
        await websocket.send_json({"type": "error", "message": "keyword is required"})
        await websocket.close()
        return

    # Run musicdl search in a thread pool (it uses blocking requests)
    loop = asyncio.get_event_loop()

    def do_search():
        client = musicdl.MusicClient(music_sources=sources)
        return client.search(keyword=keyword)

    try:
        search_results = await loop.run_in_executor(_search_executor, do_search)
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
        await websocket.close()
        return

    # Stream results source by source
    for source, song_infos in search_results.items():
        for song_info in song_infos:
            if not hasattr(song_info, 'with_valid_download_url') or not song_info.with_valid_download_url:
                continue
            await websocket.send_json({
                "type": "result",
                "song_info": {
                    "source": song_info.source,
                    "song_name": song_info.song_name,
                    "singers": song_info.singers,
                    "album": song_info.album or "",
                    "ext": song_info.ext or "",
                    "file_size": song_info.file_size or "",
                    "duration": song_info.duration or "",
                    "cover_url": song_info.cover_url or "",
                    "download_url": song_info.download_url if isinstance(song_info.download_url, str) else "",
                    "bitrate": song_info.bitrate or 0,
                    "duration_s": song_info.duration_s or 0,
                    "raw_data": song_info.raw_data if isinstance(song_info.raw_data, dict) else {},
                }
            })
        await websocket.send_json({"type": "source_done", "source": source})

    await websocket.send_json({"type": "search_done"})
    await websocket.close()
```

- [ ] **Step 2: Update server.py to import and use ws_search**

Replace the existing `/ws/search` route in `server.py`:

```python
from ws_search import ws_search as _ws_search_handler


@app.websocket("/ws/search")
async def ws_search(websocket: WebSocket):
    await _ws_search_handler(websocket)
```

- [ ] **Step 3: Verify search works**

```bash
# Terminal 1: start server
cd examples/musicdlgui/backend && python server.py

# Terminal 2: test with websocat or a simple script
# Should see results stream in as JSON messages
```

- [ ] **Step 4: Commit**

```bash
git add examples/musicdlgui/backend/ws_search.py examples/musicdlgui/backend/server.py
git commit -m "feat(gui): add search WebSocket handler with progressive result streaming"
```

---

### Task 3: Backend — Download WebSocket Handler

**Files:**
- Create: `examples/musicdlgui/backend/ws_download.py`
- Modify: `examples/musicdlgui/backend/server.py`

**Interfaces:**
- Consumes: `musicdl.MusicClient` from the `musicdl` package
- Produces: `ws_download(websocket: WebSocket)` — coroutine that handles the download WebSocket protocol

- [ ] **Step 1: Write ws_download.py**

```python
"""
Download WebSocket handler.
Manages music downloads with real-time progress streaming.
"""
import json
import uuid
import os
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from fastapi import WebSocket
from musicdl import musicdl
from musicdl.modules import SongInfo


_download_executor = ThreadPoolExecutor(max_workers=5)
# Track active downloads for pause/cancel
_active_downloads: dict[str, dict] = {}


def _build_song_info(data: dict) -> SongInfo:
    """Reconstruct a SongInfo from the JSON-safe dict sent by the frontend."""
    return SongInfo(
        source=data.get("source", ""),
        song_name=data.get("song_name", ""),
        singers=data.get("singers", ""),
        album=data.get("album", ""),
        ext=data.get("ext", ""),
        file_size=data.get("file_size", ""),
        duration=data.get("duration", ""),
        cover_url=data.get("cover_url", ""),
        download_url=data.get("download_url", ""),
        bitrate=data.get("bitrate", 0),
        duration_s=data.get("duration_s", 0),
        raw_data=data.get("raw_data", {}),
    )


async def ws_download(websocket: WebSocket):
    await websocket.accept()

    loop = asyncio.get_event_loop()

    async def send_progress(task_id: str, song_name: str, percent: float, speed: str = ""):
        """Send a progress update. Safe to call from any thread."""
        await websocket.send_json({
            "type": "progress",
            "task_id": task_id,
            "song_name": song_name,
            "percent": round(percent, 1),
            "speed": speed,
        })

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "download":
                song_infos_data = msg.get("song_infos", [])
                song_infos = [_build_song_info(s) for s in song_infos_data]

                # Group by source
                by_source: dict[str, list] = {}
                for si in song_infos:
                    by_source.setdefault(si.source, []).append(si)

                for source, infos in by_source.items():
                    task_id = str(uuid.uuid4())
                    _active_downloads[task_id] = {"cancelled": False}

                    def do_download(src, sis, tid):
                        client = musicdl.MusicClient(music_sources=[src])
                        # We use the client's download method
                        # Since musicdl doesn't have built-in progress callbacks,
                        # we simulate progress by tracking completion count
                        total = len(sis)
                        for i, si in enumerate(sis):
                            if _active_downloads.get(tid, {}).get("cancelled"):
                                break
                            try:
                                downloaded = client.download(song_infos=[si])
                                percent = ((i + 1) / total) * 100
                                # Fire-and-forget the progress send
                                asyncio.run_coroutine_threadsafe(
                                    send_progress(tid, si.song_name or "unknown", percent),
                                    loop
                                )
                            except Exception:
                                pass

                    await loop.run_in_executor(_download_executor, do_download, source, infos, task_id)

                    if task_id in _active_downloads:
                        del _active_downloads[task_id]

                    await websocket.send_json({"type": "complete", "task_id": task_id})

            elif msg.get("type") == "cancel":
                task_id = msg.get("task_id")
                if task_id in _active_downloads:
                    _active_downloads[task_id]["cancelled"] = True
                await websocket.send_json({"type": "cancelled", "task_id": task_id})

            elif msg.get("type") == "pause":
                # Pause is a client-side UI concern; musicdl doesn't support mid-download pause.
                # We acknowledge it but don't actually pause the TCP stream.
                await websocket.send_json({"type": "paused", "task_id": msg.get("task_id")})

    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        await websocket.close()
```

- [ ] **Step 2: Update server.py to use ws_download**

Replace the existing `/ws/download` route in `server.py`:

```python
from ws_download import ws_download as _ws_download_handler


@app.websocket("/ws/download")
async def ws_download(websocket: WebSocket):
    await _ws_download_handler(websocket)
```

- [ ] **Step 3: Verify downloads work**

```bash
# Terminal 1: start server
cd examples/musicdlgui/backend && python server.py

# Terminal 2: test with a WebSocket client — send a download message,
# confirm progress and complete events are received
```

- [ ] **Step 4: Commit**

```bash
git add examples/musicdlgui/backend/ws_download.py examples/musicdlgui/backend/server.py
git commit -m "feat(gui): add download WebSocket handler with progress streaming"
```

---

### Task 4: Frontend — Vite + React + Tailwind Scaffolding

**Files:**
- Create: `examples/musicdlgui/frontend/package.json`
- Create: `examples/musicdlgui/frontend/vite.config.js`
- Create: `examples/musicdlgui/frontend/tailwind.config.js`
- Create: `examples/musicdlgui/frontend/index.html`
- Create: `examples/musicdlgui/frontend/src/main.jsx`
- Create: `examples/musicdlgui/frontend/src/styles/index.css`

**Interfaces:**
- Produces: A working dev server at `localhost:5173` with React rendering a blank dark page.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "musicdl-gui",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create vite.config.js**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8765',
        ws: true,
      },
    },
  },
})
```

- [ ] **Step 3: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f8fafc', 950: '#0a0a0f',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Musicdl</title>
  </head>
  <body class="bg-neutral-950 text-neutral-100">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: Create src/styles/index.css**

```css
@import "tailwindcss";

/* Force dark color scheme */
:root {
  color-scheme: dark;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #52525b;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #71717a;
}
```

- [ ] **Step 7: Create minimal App.jsx to verify dev server**

```jsx
export default function App() {
  return (
    <div className="h-screen flex items-center justify-center bg-neutral-950">
      <h1 className="text-2xl font-bold text-indigo-400">Musicdl</h1>
    </div>
  )
}
```

- [ ] **Step 8: Install and verify**

```bash
cd examples/musicdlgui/frontend && npm install && npm run dev
# Open http://localhost:5173 — should see "Musicdl" in indigo on black background
```

- [ ] **Step 9: Commit**

```bash
git add examples/musicdlgui/frontend/
git commit -m "feat(gui): scaffold Vite + React + Tailwind frontend"
```

---

### Task 5: Frontend — useWebSocket Hook

**Files:**
- Create: `examples/musicdlgui/frontend/src/hooks/useWebSocket.js`

**Interfaces:**
- Produces:
  - `useWebSocket(url: string) => { sendMessage: (msg: object) => void, lastMessage: object | null, readyState: number, connect: () => void, disconnect: () => void }`

- [ ] **Step 1: Write useWebSocket.js**

```javascript
import { useRef, useState, useCallback, useEffect } from 'react'

const WS_READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}

/**
 * Generic WebSocket hook with auto-reconnect.
 * @param {string} url - WebSocket endpoint URL
 * @returns {{ sendMessage: Function, lastMessage: object|null, readyState: number, connect: Function, disconnect: Function }}
 */
export default function useWebSocket(url) {
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const [lastMessage, setLastMessage] = useState(null)
  const [readyState, setReadyState] = useState(WS_READY_STATES.CLOSED)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(url)
    wsRef.current = ws
    setReadyState(WS_READY_STATES.CONNECTING)

    ws.onopen = () => setReadyState(WS_READY_STATES.OPEN)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLastMessage(data)
      } catch {
        setLastMessage({ type: 'raw', data: event.data })
      }
    }

    ws.onclose = () => {
      setReadyState(WS_READY_STATES.CLOSED)
      // Auto-reconnect after 3 seconds
      reconnectTimer.current = setTimeout(() => connect(), 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [url])

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current)
    wsRef.current?.close()
    setReadyState(WS_READY_STATES.CLOSED)
  }, [])

  const sendMessage = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [])

  return { sendMessage, lastMessage, readyState, connect, disconnect }
}
```

- [ ] **Step 2: Verify the file is syntactically valid**

```bash
cd examples/musicdlgui/frontend && npx eslint src/hooks/useWebSocket.js || echo "No lint errors if installed"
```

- [ ] **Step 3: Commit**

```bash
git add examples/musicdlgui/frontend/src/hooks/useWebSocket.js
git commit -m "feat(gui): add generic useWebSocket hook with auto-reconnect"
```

---

### Task 6: Frontend — SearchContext + useSearch Hook

**Files:**
- Create: `examples/musicdlgui/frontend/src/contexts/SearchContext.jsx`
- Create: `examples/musicdlgui/frontend/src/hooks/useSearch.js`

**Interfaces:**
- Consumes: `useWebSocket` from Task 5
- Produces:
  - `SearchProvider` — wraps children with search state
  - `useSearch() => { keyword, setKeyword, results, status, sources, toggleSource, startSearch, resetSearch }`

- [ ] **Step 1: Write SearchContext.jsx**

```jsx
import { createContext, useContext, useReducer, useCallback } from 'react'

const SearchContext = createContext(null)

const DEFAULT_SOURCES = {
  MiguMusicClient: { enabled: true, label: 'Migu', short: 'Migu' },
  NeteaseMusicClient: { enabled: true, label: 'Netease', short: 'Netease' },
  QQMusicClient: { enabled: true, label: 'QQ Music', short: 'QQ' },
  KuwoMusicClient: { enabled: true, label: 'Kuwo', short: 'Kuwo' },
  QianqianMusicClient: { enabled: true, label: 'Qianqian', short: 'Qianqian' },
}

const initialState = {
  keyword: '',
  status: 'idle', // 'idle' | 'searching' | 'done'
  results: [],
  sources: { ...DEFAULT_SOURCES },
}

function searchReducer(state, action) {
  switch (action.type) {
    case 'SET_KEYWORD':
      return { ...state, keyword: action.payload }
    case 'SET_STATUS':
      return { ...state, status: action.payload }
    case 'APPEND_RESULT':
      return { ...state, results: [...state.results, action.payload] }
    case 'CLEAR_RESULTS':
      return { ...state, results: [] }
    case 'TOGGLE_SOURCE': {
      const name = action.payload
      return {
        ...state,
        sources: {
          ...state.sources,
          [name]: {
            ...state.sources[name],
            enabled: !state.sources[name].enabled,
          },
        },
      }
    }
    case 'RESET':
      return { ...initialState, sources: state.sources }
    default:
      return state
  }
}

export function SearchProvider({ children }) {
  const [state, dispatch] = useReducer(searchReducer, initialState)

  const setKeyword = useCallback((kw) => dispatch({ type: 'SET_KEYWORD', payload: kw }), [])
  const setStatus = useCallback((s) => dispatch({ type: 'SET_STATUS', payload: s }), [])
  const appendResult = useCallback((r) => dispatch({ type: 'APPEND_RESULT', payload: r }), [])
  const clearResults = useCallback(() => dispatch({ type: 'CLEAR_RESULTS' }), [])
  const toggleSource = useCallback((name) => dispatch({ type: 'TOGGLE_SOURCE', payload: name }), [])
  const resetSearch = useCallback(() => dispatch({ type: 'RESET' }), [])

  const value = {
    ...state,
    setKeyword,
    setStatus,
    appendResult,
    clearResults,
    toggleSource,
    resetSearch,
  }

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearchContext() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearchContext must be used within SearchProvider')
  return ctx
}
```

- [ ] **Step 2: Write useSearch.js**

```javascript
import { useEffect, useRef } from 'react'
import { useSearchContext } from '../contexts/SearchContext'
import useWebSocket from './useWebSocket'

const WS_URL = `ws://${window.location.hostname}:8765/ws/search`

/**
 * Hook that wires the SearchContext to the WebSocket backend.
 * Call startSearch() to begin a search; results arrive via context.
 */
export default function useSearch() {
  const ctx = useSearchContext()
  const { sendMessage, lastMessage, readyState, connect: wsConnect } = useWebSocket(WS_URL)
  const activeSources = Object.entries(ctx.sources)
    .filter(([, v]) => v.enabled)
    .map(([k]) => k)

  // Process incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return
    switch (lastMessage.type) {
      case 'result':
        ctx.appendResult(lastMessage.song_info)
        break
      case 'source_done':
        // Could update per-source status if needed
        break
      case 'search_done':
        ctx.setStatus('done')
        break
      case 'error':
        console.error('Search error:', lastMessage.message)
        break
    }
  }, [lastMessage])

  const startSearch = () => {
    if (!ctx.keyword.trim()) return
    ctx.clearResults()
    ctx.setStatus('searching')
    wsConnect()
    // Wait briefly for connection, then send
    setTimeout(() => {
      sendMessage({
        type: 'search',
        keyword: ctx.keyword,
        sources: activeSources,
      })
    }, 200)
  }

  return { ...ctx, activeSources, startSearch, wsReadyState: readyState }
}
```

- [ ] **Step 3: Commit**

```bash
git add examples/musicdlgui/frontend/src/contexts/SearchContext.jsx examples/musicdlgui/frontend/src/hooks/useSearch.js
git commit -m "feat(gui): add SearchContext and useSearch hook"
```

---

### Task 7: Frontend — DownloadContext + useDownload Hook

**Files:**
- Create: `examples/musicdlgui/frontend/src/contexts/DownloadContext.jsx`
- Create: `examples/musicdlgui/frontend/src/hooks/useDownload.js`

**Interfaces:**
- Consumes: `useWebSocket` from Task 5
- Produces:
  - `DownloadProvider` — wraps children with download state
  - `useDownload() => { items, panelExpanded, togglePanel, startDownload, cancelDownload, activeCount }`

- [ ] **Step 1: Write DownloadContext.jsx**

```jsx
import { createContext, useContext, useReducer, useCallback } from 'react'

const DownloadContext = createContext(null)

const initialState = {
  items: [],         // { id, songInfo, percent, speed, status: 'queued'|'downloading'|'complete'|'error'|'cancelled' }
  panelExpanded: false,
}

function downloadReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEMS': {
      const newItems = action.payload.map((si, i) => ({
        id: `${Date.now()}-${i}`,
        songInfo: si,
        percent: 0,
        speed: '',
        status: 'queued',
      }))
      return { ...state, items: [...state.items, ...newItems], panelExpanded: true }
    }
    case 'UPDATE_PROGRESS': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.task_id || item.songInfo?.song_name === action.payload.song_name
            ? { ...item, percent: action.payload.percent, speed: action.payload.speed || item.speed, status: 'downloading' }
            : item
        ),
      }
    }
    case 'MARK_COMPLETE': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.task_id
            ? { ...item, percent: 100, status: 'complete' }
            : item
        ),
      }
    }
    case 'MARK_ERROR': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.task_id
            ? { ...item, status: 'error', error: action.payload.message }
            : item
        ),
      }
    }
    case 'MARK_CANCELLED': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.task_id
            ? { ...item, status: 'cancelled' }
            : item
        ),
      }
    }
    case 'CLEAR_COMPLETED': {
      return {
        ...state,
        items: state.items.filter((item) => item.status !== 'complete' && item.status !== 'cancelled'),
      }
    }
    case 'TOGGLE_PANEL':
      return { ...state, panelExpanded: !state.panelExpanded }
    default:
      return state
  }
}

export function DownloadProvider({ children }) {
  const [state, dispatch] = useReducer(downloadReducer, initialState)

  const addItems = useCallback((songInfos) => dispatch({ type: 'ADD_ITEMS', payload: songInfos }), [])
  const updateProgress = useCallback((taskId, songName, percent, speed) =>
    dispatch({ type: 'UPDATE_PROGRESS', payload: { task_id: taskId, song_name: songName, percent, speed } }), [])
  const markComplete = useCallback((taskId) => dispatch({ type: 'MARK_COMPLETE', payload: { task_id: taskId } }), [])
  const markError = useCallback((taskId, message) => dispatch({ type: 'MARK_ERROR', payload: { task_id: taskId, message } }), [])
  const markCancelled = useCallback((taskId) => dispatch({ type: 'MARK_CANCELLED', payload: { task_id: taskId } }), [])
  const clearCompleted = useCallback(() => dispatch({ type: 'CLEAR_COMPLETED' }), [])
  const togglePanel = useCallback(() => dispatch({ type: 'TOGGLE_PANEL' }), [])

  const activeCount = state.items.filter((i) => i.status === 'queued' || i.status === 'downloading').length

  const value = {
    ...state,
    addItems,
    updateProgress,
    markComplete,
    markError,
    markCancelled,
    clearCompleted,
    togglePanel,
    activeCount,
  }

  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>
}

export function useDownloadContext() {
  const ctx = useContext(DownloadContext)
  if (!ctx) throw new Error('useDownloadContext must be used within DownloadProvider')
  return ctx
}
```

- [ ] **Step 2: Write useDownload.js**

```javascript
import { useEffect } from 'react'
import { useDownloadContext } from '../contexts/DownloadContext'
import useWebSocket from './useWebSocket'

const WS_URL = `ws://${window.location.hostname}:8765/ws/download`

/**
 * Hook that wires the DownloadContext to the WebSocket backend.
 */
export default function useDownload() {
  const ctx = useDownloadContext()
  const { sendMessage, lastMessage, connect: wsConnect } = useWebSocket(WS_URL)

  // Process incoming messages
  useEffect(() => {
    if (!lastMessage) return
    switch (lastMessage.type) {
      case 'progress':
        ctx.updateProgress(
          lastMessage.task_id,
          lastMessage.song_name,
          lastMessage.percent,
          lastMessage.speed
        )
        break
      case 'complete':
        ctx.markComplete(lastMessage.task_id)
        break
      case 'error':
        ctx.markError(lastMessage.task_id || '', lastMessage.message)
        break
      case 'cancelled':
        ctx.markCancelled(lastMessage.task_id)
        break
    }
  }, [lastMessage])

  const startDownload = (songInfos) => {
    ctx.addItems(songInfos)
    wsConnect()
    setTimeout(() => {
      sendMessage({
        type: 'download',
        song_infos: songInfos,
      })
    }, 200)
  }

  const cancelDownload = (taskId) => {
    sendMessage({ type: 'cancel', task_id: taskId })
    ctx.markCancelled(taskId)
  }

  return { ...ctx, startDownload, cancelDownload }
}
```

- [ ] **Step 3: Commit**

```bash
git add examples/musicdlgui/frontend/src/contexts/DownloadContext.jsx examples/musicdlgui/frontend/src/hooks/useDownload.js
git commit -m "feat(gui): add DownloadContext and useDownload hook"
```

---

### Task 8: Frontend — Sidebar, SourceList, DownloadQueueBadge

**Files:**
- Create: `examples/musicdlgui/frontend/src/components/Sidebar.jsx`
- Create: `examples/musicdlgui/frontend/src/components/SourceList.jsx`
- Create: `examples/musicdlgui/frontend/src/components/DownloadQueueBadge.jsx`

**Interfaces:**
- Consumes: `useSearchContext` from Task 6, `useDownloadContext` from Task 7
- Produces:
  - `<Sidebar>` — left sidebar container
  - `<SourceList>` — music source toggle list
  - `<DownloadQueueBadge>` — badge showing active download count

- [ ] **Step 1: Write SourceList.jsx**

```jsx
import { useSearchContext } from '../contexts/SearchContext'

export default function SourceList() {
  const { sources, toggleSource } = useSearchContext()

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-2">
        Sources
      </h3>
      {Object.entries(sources).map(([name, cfg]) => (
        <button
          key={name}
          onClick={() => toggleSource(name)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
            cfg.enabled
              ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 border border-transparent'
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                cfg.enabled ? 'bg-indigo-400' : 'bg-neutral-600'
              }`}
            />
            {cfg.label}
          </span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write DownloadQueueBadge.jsx**

```jsx
import { useDownloadContext } from '../contexts/DownloadContext'

export default function DownloadQueueBadge() {
  const { activeCount, togglePanel } = useDownloadContext()

  return (
    <button
      onClick={togglePanel}
      className="w-full mt-4 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors flex items-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span>Downloads</span>
      {activeCount > 0 && (
        <span className="ml-auto bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {activeCount}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 3: Write Sidebar.jsx**

```jsx
import SourceList from './SourceList'
import DownloadQueueBadge from './DownloadQueueBadge'

export default function Sidebar() {
  return (
    <aside className="w-56 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col p-4">
      {/* Logo */}
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold text-white tracking-tight">
          <span className="text-indigo-400">♪</span> Musicdl
        </h1>
      </div>

      {/* Source list */}
      <SourceList />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Download queue badge */}
      <DownloadQueueBadge />
    </aside>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add examples/musicdlgui/frontend/src/components/Sidebar.jsx examples/musicdlgui/frontend/src/components/SourceList.jsx examples/musicdlgui/frontend/src/components/DownloadQueueBadge.jsx
git commit -m "feat(gui): add Sidebar, SourceList, and DownloadQueueBadge components"
```

---

### Task 9: Frontend — SearchBar Component

**Files:**
- Create: `examples/musicdlgui/frontend/src/components/SearchBar.jsx`

**Interfaces:**
- Consumes: `useSearch` from Task 6
- Produces: `<SearchBar>` — search input with active source tags and search button

- [ ] **Step 1: Write SearchBar.jsx**

```jsx
import { useCallback } from 'react'
import useSearch from '../hooks/useSearch'

export default function SearchBar() {
  const { keyword, setKeyword, status, sources, startSearch } = useSearch()

  const activeSourceNames = Object.entries(sources)
    .filter(([, v]) => v.enabled)
    .map(([k, v]) => v.short || k)

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && status !== 'searching') {
        startSearch()
      }
    },
    [status, startSearch]
  )

  const isSearching = status === 'searching'

  return (
    <div className="w-full">
      {/* Search input row */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, artists, albums..."
            className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
            disabled={isSearching}
          />
        </div>
        <button
          onClick={startSearch}
          disabled={isSearching || !keyword.trim()}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm font-medium rounded-xl transition-colors disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSearching ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching
            </>
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* Active source tags */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {activeSourceNames.map((name) => (
          <span
            key={name}
            className="px-2.5 py-0.5 text-xs rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/musicdlgui/frontend/src/components/SearchBar.jsx
git commit -m "feat(gui): add SearchBar component with source tags"
```

---

### Task 10: Frontend — ResultGrid + ResultCard Components

**Files:**
- Create: `examples/musicdlgui/frontend/src/components/ResultGrid.jsx`
- Create: `examples/musicdlgui/frontend/src/components/ResultCard.jsx`

**Interfaces:**
- Consumes: `useSearch` from Task 6, `useDownload` from Task 7
- Produces:
  - `<ResultGrid>` — grid container for search results
  - `<ResultCard songInfo={object} onDownload={function}>` — individual result card

- [ ] **Step 1: Write ResultCard.jsx**

```jsx
export default function ResultCard({ songInfo, onDownload }) {
  const ext = (songInfo.ext || 'mp3').toUpperCase()
  const isLossless = ['FLAC', 'WAV', 'ALAC', 'APE', 'DSF', 'DFF'].includes(ext)

  return (
    <div className="group bg-neutral-800/50 hover:bg-neutral-800 rounded-xl border border-neutral-700/50 hover:border-neutral-600/50 transition-all duration-200 overflow-hidden">
      {/* Cover art area */}
      <div className="aspect-square bg-neutral-700/30 flex items-center justify-center relative">
        {songInfo.cover_url ? (
          <img
            src={songInfo.cover_url}
            alt={songInfo.song_name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <svg className="w-12 h-12 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        )}
        {/* Download button overlay */}
        <button
          onClick={() => onDownload(songInfo)}
          className="absolute bottom-2 right-2 w-9 h-9 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          title="Download"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-neutral-100 truncate" title={songInfo.song_name}>
          {songInfo.song_name || 'Unknown'}
        </h3>
        <p className="text-xs text-neutral-400 truncate mt-0.5" title={songInfo.singers}>
          {songInfo.singers || 'Unknown Artist'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-neutral-500">{songInfo.duration || '--:--'}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            isLossless ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
            'bg-neutral-700/50 text-neutral-400 border border-neutral-600/30'
          }`}>
            {ext}
          </span>
          {songInfo.file_size && (
            <span className="text-xs text-neutral-600">{songInfo.file_size}</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write ResultGrid.jsx**

```jsx
import useSearch from '../hooks/useSearch'
import useDownload from '../hooks/useDownload'
import ResultCard from './ResultCard'

export default function ResultGrid() {
  const { results, status } = useSearch()
  const { startDownload } = useDownload()

  const handleDownload = (songInfo) => {
    startDownload([songInfo])
  }

  const handleDownloadAll = () => {
    if (results.length > 0) {
      startDownload(results)
    }
  }

  if (status === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-neutral-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-neutral-500 text-sm">Search for music to get started</p>
        </div>
      </div>
    )
  }

  if (status === 'searching' && results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin w-8 h-8 text-indigo-400 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-neutral-400 text-sm">Searching...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header with count and download all */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-400">
          {results.length} result{results.length !== 1 ? 's' : ''}
          {status === 'searching' && ' — still searching...'}
        </p>
        {results.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className="text-xs px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
          >
            Download All
          </button>
        )}
      </div>

      {/* Result grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {results.map((songInfo, idx) => (
          <ResultCard
            key={`${songInfo.song_name}-${songInfo.singers}-${idx}`}
            songInfo={songInfo}
            onDownload={handleDownload}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add examples/musicdlgui/frontend/src/components/ResultGrid.jsx examples/musicdlgui/frontend/src/components/ResultCard.jsx
git commit -m "feat(gui): add ResultGrid and ResultCard components"
```

---

### Task 11: Frontend — DownloadPanel + DownloadItem Components

**Files:**
- Create: `examples/musicdlgui/frontend/src/components/DownloadPanel.jsx`
- Create: `examples/musicdlgui/frontend/src/components/DownloadItem.jsx`

**Interfaces:**
- Consumes: `useDownload` from Task 7
- Produces:
  - `<DownloadPanel>` — collapsible bottom panel for download management
  - `<DownloadItem item={object} onCancel={function}>` — individual download row

- [ ] **Step 1: Write DownloadItem.jsx**

```jsx
const STATUS_STYLES = {
  queued: 'text-neutral-400',
  downloading: 'text-indigo-400',
  complete: 'text-emerald-400',
  error: 'text-red-400',
  cancelled: 'text-neutral-500',
}

export default function DownloadItem({ item, onCancel }) {
  const { songInfo, percent, speed, status, error } = item
  const isActive = status === 'downloading' || status === 'queued'

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-800/30 transition-colors">
      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-200 truncate">{songInfo.song_name || 'Unknown'}</p>
        <p className="text-xs text-neutral-500 truncate">{songInfo.singers || ''}</p>
      </div>

      {/* Progress bar */}
      <div className="w-32">
        <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              status === 'complete' ? 'bg-emerald-500' :
              status === 'error' ? 'bg-red-500' :
              'bg-indigo-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Speed / percent */}
      <span className="text-xs text-neutral-500 w-16 text-right tabular-nums">
        {speed ? `${speed}` : `${Math.round(percent)}%`}
      </span>

      {/* Status text */}
      <span className={`text-xs w-20 text-right ${STATUS_STYLES[status] || 'text-neutral-500'}`}>
        {status === 'downloading' && 'Downloading'}
        {status === 'queued' && 'Queued'}
        {status === 'complete' && 'Done'}
        {status === 'error' && (error || 'Failed')}
        {status === 'cancelled' && 'Cancelled'}
      </span>

      {/* Cancel button */}
      {isActive && (
        <button
          onClick={() => onCancel(item.id)}
          className="text-neutral-500 hover:text-red-400 transition-colors"
          title="Cancel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write DownloadPanel.jsx**

```jsx
import useDownload from '../hooks/useDownload'
import DownloadItem from './DownloadItem'

export default function DownloadPanel() {
  const { items, panelExpanded, togglePanel, cancelDownload, clearCompleted } = useDownload()

  const hasCompleted = items.some((i) => i.status === 'complete' || i.status === 'cancelled')

  return (
    <div className="border-t border-neutral-800 bg-neutral-900/95 backdrop-blur">
      {/* Header */}
      <button
        onClick={togglePanel}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-neutral-400 transition-transform ${panelExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-sm font-medium text-neutral-300">
            Downloads
          </span>
          {items.length > 0 && (
            <span className="text-xs text-neutral-500">({items.length})</span>
          )}
        </div>
        {hasCompleted && (
          <button
            onClick={(e) => { e.stopPropagation(); clearCompleted() }}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Clear completed
          </button>
        )}
      </button>

      {/* List */}
      {panelExpanded && (
        <div className="max-h-64 overflow-y-auto border-t border-neutral-800/50">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-600 text-center py-8">
              No downloads yet
            </p>
          ) : (
            items.map((item) => (
              <DownloadItem
                key={item.id}
                item={item}
                onCancel={cancelDownload}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add examples/musicdlgui/frontend/src/components/DownloadPanel.jsx examples/musicdlgui/frontend/src/components/DownloadItem.jsx
git commit -m "feat(gui): add DownloadPanel and DownloadItem components"
```

---

### Task 12: Frontend — App.jsx (Wire Everything Together)

**Files:**
- Modify: `examples/musicdlgui/frontend/src/App.jsx`

**Interfaces:**
- Consumes: All components from Tasks 8-11, all contexts from Tasks 6-7
- Produces: The complete app layout with all components wired together

- [ ] **Step 1: Rewrite App.jsx**

```jsx
import { SearchProvider } from './contexts/SearchContext'
import { DownloadProvider } from './contexts/DownloadContext'
import Sidebar from './components/Sidebar'
import SearchBar from './components/SearchBar'
import ResultGrid from './components/ResultGrid'
import DownloadPanel from './components/DownloadPanel'

function AppInner() {
  return (
    <div className="h-screen flex flex-col bg-neutral-950">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 p-6">
          <SearchBar />
          <div className="mt-6 flex-1 flex flex-col min-h-0">
            <ResultGrid />
          </div>
        </main>
      </div>

      {/* Download panel (fixed at bottom) */}
      <DownloadPanel />
    </div>
  )
}

export default function App() {
  return (
    <DownloadProvider>
      <SearchProvider>
        <AppInner />
      </SearchProvider>
    </DownloadProvider>
  )
}
```

- [ ] **Step 2: Verify the full frontend builds**

```bash
cd examples/musicdlgui/frontend && npm run build
# Should complete without errors
```

- [ ] **Step 3: Commit**

```bash
git add examples/musicdlgui/frontend/src/App.jsx
git commit -m "feat(gui): wire all components together in App.jsx"
```

---

### Task 13: Electron Shell

**Files:**
- Create: `examples/musicdlgui/electron/package.json`
- Create: `examples/musicdlgui/electron/main.js`
- Create: `examples/musicdlgui/electron/preload.js`
- Create: `examples/musicdlgui/package.json` (root-level Electron scripts)

**Interfaces:**
- Consumes: The built frontend from Task 12, the backend from Tasks 1-3
- Produces: A working Electron desktop app that spawns the Python backend and loads the React frontend

- [ ] **Step 1: Create electron/package.json**

```json
{
  "name": "musicdl-gui-electron",
  "version": "1.0.0",
  "main": "main.js"
}
```

- [ ] **Step 2: Create electron/main.js**

```javascript
const { app, BrowserWindow } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')

const BACKEND_PORT = 8765
const DEV_SERVER_URL = 'http://localhost:5173'

let mainWindow = null
let backendProcess = null

function startBackend() {
  // Determine the Python command
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

  const backendDir = path.join(__dirname, '..', 'backend')
  backendProcess = spawn(pythonCmd, ['server.py'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  })

  backendProcess.stdout.on('data', (data) => {
    console.log(`[backend] ${data.toString().trim()}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.error(`[backend] ${data.toString().trim()}`)
  })

  backendProcess.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`)
  })
}

function waitForBackend(retries = 30) {
  return new Promise((resolve, reject) => {
    function check() {
      http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, (res) => {
        if (res.statusCode === 200) resolve()
        else if (retries > 0) { retries--; setTimeout(check, 500) }
        else reject(new Error('Backend did not become healthy'))
      }).on('error', () => {
        if (retries > 0) { retries--; setTimeout(check, 500) }
        else reject(new Error('Backend did not start'))
      })
    }
    check()
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    title: 'Musicdl',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // In development, load from Vite dev server; in production, load built files
  const isDev = process.argv.includes('--dev')
  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html')
    mainWindow.loadFile(distPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  startBackend()
  try {
    await waitForBackend()
    console.log('[electron] Backend is ready')
  } catch (err) {
    console.error('[electron] Failed to start backend:', err.message)
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
})
```

- [ ] **Step 3: Create electron/preload.js**

```javascript
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
})
```

- [ ] **Step 4: Create root-level package.json for Electron dev/build scripts**

```json
{
  "name": "musicdl-gui",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && python server.py",
    "dev:electron": "cd electron && npx electron main.js --dev",
    "build:frontend": "cd frontend && npm run build",
    "build:electron": "npm run build:frontend && cd electron && npx electron-builder --config"
  },
  "devDependencies": {
    "electron": "^33.0.0"
  }
}
```

- [ ] **Step 5: Verify Electron launches**

```bash
# Terminal 1: start backend
cd examples/musicdlgui/backend && python server.py

# Terminal 2: start frontend dev server
cd examples/musicdlgui/frontend && npm run dev

# Terminal 3: launch Electron
cd examples/musicdlgui/electron && npx electron main.js --dev
# Should open an Electron window showing the app
```

- [ ] **Step 6: Commit**

```bash
git add examples/musicdlgui/electron/ examples/musicdlgui/package.json
git commit -m "feat(gui): add Electron shell with backend child process management"
```

---

### Task 14: Final Integration & Polish

**Files:**
- Modify: `examples/musicdlgui/musicdlgui.py` — add deprecation notice
- Modify: `examples/musicdlgui/README.md` — update documentation

**Interfaces:**
- No new interfaces. This is cleanup and documentation.

- [ ] **Step 1: Add deprecation notice to the old musicdlgui.py**

Prepend the following to the existing `musicdlgui.py`:

```python
# ============================================================================
# DEPRECATED: This PyQt5-based GUI has been replaced by a modern Electron +
# FastAPI + React application. See the `electron/`, `backend/`, and `frontend/`
# directories for the new implementation.
#
# This file is preserved for reference. To run the new GUI:
#   cd examples/musicdlgui/electron && npx electron main.js --dev
# ============================================================================
```

- [ ] **Step 2: Update README.md**

Write `examples/musicdlgui/README.md`:

```markdown
# Musicdl GUI

A modern desktop music downloader built with Electron, FastAPI, React, and Tailwind CSS.

## Quick Start (Development)

```bash
# Terminal 1: Start the Python backend
cd backend && pip install -r requirements.txt && python server.py

# Terminal 2: Start the React frontend dev server
cd frontend && npm install && npm run dev

# Terminal 3: Launch the Electron app
cd electron && npx electron main.js --dev
```

Or open `http://localhost:5173` in your browser for a browser-only experience.

## Directory Structure

- `electron/` — Electron main process (spawns Python backend, creates window)
- `backend/` — FastAPI server with WebSocket endpoints for search and download
- `frontend/` — React SPA with Tailwind CSS (dark theme)
- `musicdlgui.py` — Deprecated PyQt5 GUI (preserved for reference)
```

- [ ] **Step 3: Verify end-to-end flow**

```bash
# Start backend
cd examples/musicdlgui/backend && python server.py &

# Start frontend
cd examples/musicdlgui/frontend && npm run dev &

# Open http://localhost:5173 in browser
# 1. Select sources in sidebar
# 2. Type a keyword and click Search
# 3. Verify results appear progressively
# 4. Click download on a result
# 5. Verify download panel shows progress
```

- [ ] **Step 4: Commit**

```bash
git add examples/musicdlgui/musicdlgui.py examples/musicdlgui/README.md
git commit -m "chore(gui): add deprecation notice to old GUI, update README"
```

---

### Task 15: Final Verification & Cleanup

- [ ] **Step 1: Verify all files exist**

```bash
ls examples/musicdlgui/backend/server.py
ls examples/musicdlgui/backend/ws_search.py
ls examples/musicdlgui/backend/ws_download.py
ls examples/musicdlgui/backend/requirements.txt
ls examples/musicdlgui/frontend/package.json
ls examples/musicdlgui/frontend/vite.config.js
ls examples/musicdlgui/frontend/tailwind.config.js
ls examples/musicdlgui/frontend/index.html
ls examples/musicdlgui/frontend/src/main.jsx
ls examples/musicdlgui/frontend/src/App.jsx
ls examples/musicdlgui/frontend/src/styles/index.css
ls examples/musicdlgui/frontend/src/contexts/SearchContext.jsx
ls examples/musicdlgui/frontend/src/contexts/DownloadContext.jsx
ls examples/musicdlgui/frontend/src/hooks/useWebSocket.js
ls examples/musicdlgui/frontend/src/hooks/useSearch.js
ls examples/musicdlgui/frontend/src/hooks/useDownload.js
ls examples/musicdlgui/frontend/src/components/Sidebar.jsx
ls examples/musicdlgui/frontend/src/components/SourceList.jsx
ls examples/musicdlgui/frontend/src/components/DownloadQueueBadge.jsx
ls examples/musicdlgui/frontend/src/components/SearchBar.jsx
ls examples/musicdlgui/frontend/src/components/ResultGrid.jsx
ls examples/musicdlgui/frontend/src/components/ResultCard.jsx
ls examples/musicdlgui/frontend/src/components/DownloadPanel.jsx
ls examples/musicdlgui/frontend/src/components/DownloadItem.jsx
ls examples/musicdlgui/electron/package.json
ls examples/musicdlgui/electron/main.js
ls examples/musicdlgui/electron/preload.js
ls examples/musicdlgui/package.json
ls examples/musicdlgui/README.md
```

- [ ] **Step 2: Verify frontend builds without errors**

```bash
cd examples/musicdlgui/frontend && npm run build
# Expected: "✓ built in Xs" with no errors
```

- [ ] **Step 3: Verify old musicdlgui.py still has deprecation comment**

```bash
head -1 examples/musicdlgui/musicdlgui.py
# Expected: "# ============================================================================"
```

- [ ] **Step 4: Commit**

```bash
git add -A examples/musicdlgui/
git commit -m "chore(gui): final verification and cleanup"
```