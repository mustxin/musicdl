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

## Data Directories

| Path | Purpose |
|---|---|
| `~/Music/musicdlgui` | Default download directory (changeable in the app's Settings) |
| `backend/.cache/` | Internal search cache (search_results.pkl) — safe to delete anytime |
| `backend/.gui_settings.json` | Download-dir setting (gitignored, local to this machine) |
| `backend/.search_history.json` | Search history (gitignored, local to this machine) |

Packaged Electron apps store the search cache under the OS user-data dir
(`%APPDATA%/.../cache` on Windows) instead of `backend/.cache/`.

## Upgrading from the in-repo version

Previously downloads and search cache went to the musicdl repo's
`musicdl_outputs/`. After this change, downloads default to
`~/Music/musicdlgui` and the search cache is internal. Existing files are
**not** moved automatically — find your old downloads in the old
`musicdl_outputs/` folder, or point Settings at it to keep using it.

The `musicdl` PyPI package (`>=2.13.7`) is the only dependency on the
downloader library — this project runs standalone once installed via pip.