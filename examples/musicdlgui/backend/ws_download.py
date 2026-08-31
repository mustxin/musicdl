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

                by_source: dict[str, list] = {}
                for si in song_infos:
                    by_source.setdefault(si.source, []).append(si)

                for source, infos in by_source.items():
                    task_id = str(uuid.uuid4())
                    _active_downloads[task_id] = {"cancelled": False}

                    def do_download(src, sis, tid):
                        client = musicdl.MusicClient(music_sources=[src])
                        total = len(sis)
                        for i, si in enumerate(sis):
                            if _active_downloads.get(tid, {}).get("cancelled"):
                                break
                            try:
                                downloaded = client.download(song_infos=[si])
                                percent = ((i + 1) / total) * 100
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
                await websocket.send_json({"type": "paused", "task_id": msg.get("task_id")})

    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        await websocket.close()