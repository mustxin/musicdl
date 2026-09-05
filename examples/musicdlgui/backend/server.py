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
from history import read_history, write_history
from settings import (
    get_download_dir, get_default_download_dir, set_download_dir, reset_download_dir,
    clean_cache, format_bytes,
)

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


@app.get("/history")
async def get_history():
    """Return recent search history."""
    return read_history()


@app.delete("/history")
async def clear_history():
    """Clear all search history."""
    write_history([])
    return {"ok": True}


@app.get("/downloads/path")
async def downloads_path():
    """Return the absolute path to the (possibly custom) download directory."""
    return {"path": get_download_dir()}


@app.get("/downloads/open")
async def downloads_open():
    """Open the (possibly custom) download directory in the system file explorer."""
    target = get_download_dir()
    try:
        if sys.platform == "win32":
            os.startfile(target)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", target])
        else:
            subprocess.Popen(["xdg-open", target])
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ---- Settings ----

@app.get("/settings/download-dir")
async def get_setting_download_dir():
    return {"path": get_download_dir(), "is_default": get_download_dir() == get_default_download_dir()}


@app.put("/settings/download-dir")
async def put_setting_download_dir(body: dict):
    """Set a custom download directory."""
    path = (body or {}).get("path", "").strip()
    if not path:
        return {"ok": False, "error": "path is required"}
    ok, result = set_download_dir(path)
    if not ok:
        return {"ok": False, "error": result}
    return {"ok": True, "path": result}


@app.delete("/settings/download-dir")
async def reset_setting_download_dir():
    """Reset the download directory to the default."""
    return {"ok": True, "path": reset_download_dir()}


@app.post("/settings/clean-cache")
async def clean_download_cache():
    """Remove .pkl cache files, 0-byte shells, and empty dirs under the download directory."""
    stats = clean_cache()
    return {
        "ok": True,
        "removed": stats["removed"],
        "freed_bytes": stats["freed_bytes"],
        "freed_text": format_bytes(stats["freed_bytes"]),
        "removed_dirs": stats.get("removed_dirs", 0),
    }


@app.get("/settings/pick-folder")
async def pick_folder():
    """Open a native folder picker. Returns the chosen path.

    Uses tkinter's folder dialog when available (stdlib on most desktop
    Python installs); the frontend falls back to a manual path input.
    """
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        root.update()
        chosen = filedialog.askdirectory(title="选择下载目录")
        root.destroy()
        if chosen:
            return {"ok": True, "path": os.path.normpath(chosen)}
        return {"ok": False, "error": "cancelled"}
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