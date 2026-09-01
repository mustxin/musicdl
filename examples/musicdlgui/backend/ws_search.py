"""
Search WebSocket handler.
Streams search results from musicdl to the frontend in real time.
"""
import os
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import WebSocket
from musicdl import musicdl
from history import save_search_history


DEFAULT_SOURCES = [
    "MiguMusicClient", "NeteaseMusicClient", "QQMusicClient",
    "KuwoMusicClient", "QianqianMusicClient",
]

# Project root is 3 levels up from this file: backend/ -> musicdlgui/ -> examples/ -> repo root
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_DOWNLOAD_DIR = os.path.join(_PROJECT_ROOT, "musicdl_outputs")

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

    # Save to search history
    save_search_history(keyword, sources)

    loop = asyncio.get_event_loop()

    for source in sources:
        try:
            client = musicdl.MusicClient(
                music_sources=[source],
                init_music_clients_cfg={source: {"work_dir": _DOWNLOAD_DIR}},
            )
            search_results = await loop.run_in_executor(
                _search_executor, lambda s=source, c=client: c.search(keyword=keyword)
            )
        except Exception as e:
            await websocket.send_json({"type": "error", "source": source, "message": str(e)})
            continue

        for song_info in search_results.get(source, []):
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
                    "work_dir": getattr(song_info, 'work_dir', ''),
                    "raw_data": song_info.raw_data if isinstance(song_info.raw_data, dict) else {},
                }
            })
        await websocket.send_json({"type": "source_done", "source": source})

    await websocket.send_json({"type": "search_done"})
    await websocket.close()