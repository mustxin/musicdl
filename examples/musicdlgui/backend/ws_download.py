"""
Download WebSocket handler.
Manages music downloads with real-time progress streaming.
"""
import json
import uuid
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import WebSocket
from musicdl import musicdl
from musicdl.modules import SongInfo


# Project root is 3 levels up from this file: backend/ -> musicdlgui/ -> examples/ -> repo root
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_DOWNLOAD_DIR = os.path.join(_PROJECT_ROOT, "musicdl_outputs")

_download_executor = ThreadPoolExecutor(max_workers=5)
_active_downloads: dict[str, dict] = {}


def _build_song_info(data: dict, work_dir: str) -> SongInfo:
    """Reconstruct a SongInfo from the JSON-safe dict sent by the frontend."""
    song_name = data.get("song_name", "")
    singers = data.get("singers", "")
    source = data.get("source", "")
    # Use search result's work_dir if available, otherwise use the passed one
    wd = data.get("work_dir", "") or work_dir
    identifier = singers or source
    return SongInfo(
        source=source,
        song_name=song_name,
        singers=singers,
        album=data.get("album", ""),
        ext=data.get("ext", ""),
        file_size=data.get("file_size", ""),
        duration=data.get("duration", ""),
        cover_url=data.get("cover_url", ""),
        download_url=data.get("download_url", ""),
        bitrate=data.get("bitrate", 0),
        duration_s=data.get("duration_s", 0),
        raw_data=data.get("raw_data", {}),
        download_url_status={"ok": True},
        work_dir=wd,
        identifier=identifier,
    )


async def ws_download(websocket: WebSocket):
    await websocket.accept()

    loop = asyncio.get_running_loop()

    async def send_progress(task_id: str, song_name: str, percent: float, speed: str = ""):
        """Send a progress update. Safe to call from any thread."""
        try:
            await websocket.send_json({
                "type": "progress",
                "task_id": task_id,
                "song_name": song_name,
                "percent": round(percent, 1),
                "speed": speed,
            })
        except Exception:
            pass  # Connection may have closed

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "download":
                song_infos_data = msg.get("song_infos", [])
                task_id = msg.get("task_id", str(uuid.uuid4()))

                # Group by source
                by_source: dict[str, list] = {}
                for s in song_infos_data:
                    by_source.setdefault(s.get("source", ""), []).append(s)

                # Build SongInfo objects using the work_dir from search results
                song_infos = []
                for source, infos_data in by_source.items():
                    for s in infos_data:
                        wd = s.get("work_dir", "") or os.path.join(_DOWNLOAD_DIR, source)
                        os.makedirs(wd, exist_ok=True)
                        song_infos.append(_build_song_info(s, wd))

                for source, infos in by_source.items():
                    source_song_infos = [si for si in song_infos if si.source == source]
                    work_dir = source_song_infos[0].work_dir if source_song_infos else _DOWNLOAD_DIR
                    _active_downloads[task_id] = {"cancelled": False}
                    # Send initial 0% progress for each song
                    for i, si in enumerate(source_song_infos):
                        await websocket.send_json({
                            "type": "progress",
                            "task_id": f"{task_id}-{i}",
                            "song_name": si.song_name or "unknown",
                            "percent": 0,
                            "speed": "",
                        })

                    def do_download(src, sis, tid, work_dir):
                        client = musicdl.MusicClient(
                            music_sources=[src],
                            init_music_clients_cfg={src: {"work_dir": work_dir}},
                        )
                        for i, si in enumerate(sis):
                            if _active_downloads.get(tid, {}).get("cancelled"):
                                break
                            item_task_id = f"{tid}-{i}"
                            try:
                                downloaded = client.download(song_infos=[si])
                                future = asyncio.run_coroutine_threadsafe(
                                    send_progress(item_task_id, si.song_name or "unknown", 100),
                                    loop
                                )
                                future.result(timeout=5)
                            except Exception as e:
                                pass  # download failed for this item

                    await loop.run_in_executor(_download_executor, do_download, source, source_song_infos, task_id, work_dir)

                    # Clean up 0KB temp files left by mutagen tag writing
                    if os.path.isdir(work_dir):
                        for f in os.listdir(work_dir):
                            fpath = os.path.join(work_dir, f)
                            if os.path.isfile(fpath) and os.path.getsize(fpath) == 0:
                                try:
                                    os.remove(fpath)
                                except OSError:
                                    pass

                    if task_id in _active_downloads:
                        del _active_downloads[task_id]

                    # Send complete for each item
                    for i in range(len(source_song_infos)):
                        await websocket.send_json({"type": "complete", "task_id": f"{task_id}-{i}"})

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