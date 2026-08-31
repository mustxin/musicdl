"""
FastAPI backend for musicdl GUI.
Provides WebSocket endpoints for search and download.
"""
import os
import sys
import subprocess
import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from ws_search import ws_search as _ws_search_handler
from ws_download import ws_download as _ws_download_handler

app = FastAPI(title="musicdl-gui-backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_DIR = os.path.abspath("musicdl_outputs")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/downloads/path")
async def downloads_path():
    """Return the absolute path to the download directory."""
    return {"path": DOWNLOAD_DIR}


@app.get("/downloads/open")
async def downloads_open():
    """Open the download directory in the system file explorer."""
    try:
        if sys.platform == "win32":
            os.startfile(DOWNLOAD_DIR)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", DOWNLOAD_DIR])
        else:
            subprocess.Popen(["xdg-open", DOWNLOAD_DIR])
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.websocket("/ws/search")
async def ws_search(websocket: WebSocket):
    await _ws_search_handler(websocket)


@app.websocket("/ws/download")
async def ws_download(websocket: WebSocket):
    await _ws_download_handler(websocket)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)