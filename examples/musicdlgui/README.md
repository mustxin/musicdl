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