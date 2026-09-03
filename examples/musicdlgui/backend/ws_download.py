"""
Download WebSocket handler.
Manages music downloads with real-time progress streaming.

Per-item completion is sent IMMEDIATELY when the item finishes (not batched),
and progress messages carry real byte/speed data by downloading directly
instead of going through musicdl's callback-less client.download().
"""
import json
import uuid
import os
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import WebSocket
from musicdl import musicdl
from musicdl.modules import SongInfo, SongInfoUtils


# Project root is 3 levels up from this file: backend/ -> musicdlgui/ -> examples/ -> repo root
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_DOWNLOAD_DIR = os.path.join(_PROJECT_ROOT, "musicdl_outputs")

_download_executor = ThreadPoolExecutor(max_workers=5)
_active_downloads: dict[str, dict] = {}

# Throttle: minimum interval between progress messages per item
_PROGRESS_INTERVAL = 0.25


def _build_song_info(data: dict, work_dir: str) -> SongInfo:
    """Reconstruct a SongInfo from the JSON-safe dict sent by the frontend."""
    song_name = data.get("song_name", "")
    singers = data.get("singers", "")
    source = data.get("source", "")
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


def _format_speed(bytes_per_sec: float) -> str:
    if bytes_per_sec >= 1024 * 1024:
        return f"{bytes_per_sec / 1024 / 1024:.1f} MB/s"
    if bytes_per_sec >= 1024:
        return f"{bytes_per_sec / 1024:.0f} KB/s"
    return f"{bytes_per_sec:.0f} B/s"


def _clean_zero_byte_files(work_dir: str):
    """Remove 0-byte mutagen temp stragglers (mkstemp leftovers).

    Windows may briefly hold file handles during tag writes, so retries.
    """
    if not work_dir or not os.path.isdir(work_dir):
        return
    for _round in range(5):
        removed_all = True
        try:
            for f in os.listdir(work_dir):
                fpath = os.path.join(work_dir, f)
                try:
                    if os.path.isfile(fpath) and os.path.getsize(fpath) == 0 and not f.endswith('.pkl'):
                        os.remove(fpath)
                        removed_all = False  # something changed; re-scan next round
                except OSError:
                    removed_all = False
        except OSError:
            return
        if removed_all:
            return
        time.sleep(0.2)


async def ws_download(websocket: WebSocket):
    await websocket.accept()

    loop = asyncio.get_running_loop()

    async def _send(payload: dict):
        try:
            await websocket.send_json(payload)
        except Exception:
            pass  # Connection may have closed

    async def send_progress(task_id: str, song_name: str, percent: float,
                            downloaded_bytes: int = 0, total_bytes: int = 0,
                            speed: str = ""):
        await _send({
            "type": "progress",
            "task_id": task_id,
            "song_name": song_name,
            "percent": round(percent, 1),
            "downloaded_bytes": downloaded_bytes,
            "total_bytes": total_bytes,
            "speed": speed,
        })

    async def _send_error(task_id: str, message: str):
        await _send({
            "type": "error",
            "task_id": task_id,
            "message": str(message)[:200],
        })

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "download":
                song_infos_data = msg.get("song_infos", [])
                task_id = msg.get("task_id", str(uuid.uuid4()))

                # Send initial 0% progress for every song, using the GLOBAL
                # index from the frontend's song_infos array so item ids
                # match one-to-one (multi-source batches included).
                for i, s in enumerate(song_infos_data):
                    await send_progress(f"{task_id}-{i}", s.get("song_name") or "unknown", 0)

                # Build SongInfo objects (work_dir from search results)
                global_infos = []
                for s in song_infos_data:
                    source = s.get("source", "")
                    wd = s.get("work_dir", "") or os.path.join(_DOWNLOAD_DIR, source)
                    os.makedirs(wd, exist_ok=True)
                    global_infos.append(_build_song_info(s, wd))

                _active_downloads[task_id] = {"cancelled": False}
                _active_downloads[task_id]["remaining"] = len(global_infos)

                def report_item_done(tid: str):
                    """Track batch completion for cleanup."""
                    entry = _active_downloads.get(tid)
                    if entry is not None:
                        entry["remaining"] = entry.get("remaining", 0) - 1
                        if entry.get("remaining", 0) <= 0:
                            _active_downloads.pop(tid, None)

                def do_download(items_with_idx, tid):
                    """Stream-download each item directly, sending real progress.

                    musicdl's client.download() swallows per-item errors and
                    provides no progress callback — so we GET the download_url
                    ourselves (chunk by chunk, computing speed/bytes/percent)
                    and let SongInfoUtils handle tag-writing afterwards.
                    """
                    for i, si in items_with_idx:
                        if _active_downloads.get(tid, {}).get("cancelled"):
                            break
                        item_task_id = f"{tid}-{i}"
                        song_label = si.song_name or "unknown"
                        try:
                            # Pick a client from the item's source for its
                            # session/retry machinery
                            client = musicdl.MusicClient(
                                music_sources=[si.source],
                                init_music_clients_cfg={si.source: {"work_dir": si.work_dir, "disable_print": True}},
                            ).music_clients[si.source]
                            resp = client.get(si.download_url, stream=True, timeout=(10, 60))
                            resp.raise_for_status()
                            total_bytes = int(float(resp.headers.get("Content-Length", 0) or 0))
                            # Fallback total from search-time file_size text
                            if total_bytes <= 0 and si.file_size:
                                m = str(si.file_size).upper().replace(" ", "")
                                for unit, mult in (("GB", 1024**3), ("MB", 1024**2), ("KB", 1024)):
                                    if m.endswith(unit):
                                        try: total_bytes = int(float(m[:-len(unit)]) * mult)
                                        except ValueError: pass
                                        break
                            downloaded = 0
                            last_report = 0.0
                            speed = 0.0
                            speed_window_start = time.monotonic()
                            speed_window_bytes = 0
                            with open(si.save_path, "wb") as fp:
                                for chunk in resp.iter_content(chunk_size=64 * 1024):
                                    if _active_downloads.get(tid, {}).get("cancelled"):
                                        break
                                    if not chunk:
                                        continue
                                    fp.write(chunk)
                                    downloaded += len(chunk)
                                    speed_window_bytes += len(chunk)
                                    now = time.monotonic()
                                    elapsed_win = now - speed_window_start
                                    if elapsed_win >= 1.0:
                                        speed = speed_window_bytes / elapsed_win
                                        speed_window_start = now
                                        speed_window_bytes = 0
                                    if now - last_report >= _PROGRESS_INTERVAL:
                                        last_report = now
                                        percent = (downloaded / total_bytes * 100) if total_bytes > 0 else 0.0
                                        try:
                                            fut = asyncio.run_coroutine_threadsafe(
                                                send_progress(item_task_id, song_label, percent,
                                                              downloaded, total_bytes, _format_speed(speed)),
                                                loop,
                                            )
                                            fut.result(timeout=5)
                                        except Exception:
                                            pass
                            # verify the file actually landed with content
                            if not os.path.isfile(si.save_path) or os.path.getsize(si.save_path) == 0:
                                raise RuntimeError('download produced no file')
                            # write tags/lyrics like client.download() would
                            try:
                                SongInfoUtils.supplsonginfothensavelyricsthenwritetags(
                                    si, logger_handle=client.logger_handle, disable_print=True)
                            except Exception:
                                pass  # tag failure is not a download failure
                            # clean mutagen temp stragglers in this item's dir now
                            _clean_zero_byte_files(si.work_dir)
                            # immediate per-item completion
                            try:
                                fut = asyncio.run_coroutine_threadsafe(
                                    _send({"type": "complete", "task_id": item_task_id}), loop)
                                fut.result(timeout=5)
                            except Exception:
                                pass
                            report_item_done(tid)
                        except Exception as e:
                            print(f"[ws_download] failed {si.song_name}: {e}")
                            try:
                                fut = asyncio.run_coroutine_threadsafe(
                                    _send_error(item_task_id, f"{e}"), loop)
                                fut.result(timeout=5)
                            except Exception:
                                pass
                            # clean stragglers on the failure path too
                            try:
                                _clean_zero_byte_files(si.work_dir)
                            except Exception:
                                pass
                            report_item_done(tid)

                # Run the whole batch (all sources) in one executor job; items
                # download sequentially within it — simple and cancels cleanly.
                items_with_idx = list(enumerate(global_infos))
                await loop.run_in_executor(_download_executor, do_download, items_with_idx, task_id)

                # Final pass: keep sweeping 0-byte temp files for a few seconds.
                # mutagen/safeeditaudio temp files can be re-created or held
                # open briefly after an item finishes; a single sweep races.
                async def _deferred_final_clean(work_dirs):
                    for _ in range(10):
                        await asyncio.sleep(1.0)
                        dirty = False
                        for wd in work_dirs:
                            try:
                                before = os.path.isdir(wd) and any(
                                    os.path.getsize(os.path.join(wd, f)) == 0
                                    for f in os.listdir(wd)
                                    if os.path.isfile(os.path.join(wd, f)) and not f.endswith('.pkl'))
                                if before:
                                    _clean_zero_byte_files(wd)
                                    dirty = True
                            except Exception:
                                pass
                        if not dirty:
                            return
                asyncio.create_task(_deferred_final_clean(list({si.work_dir for si in global_infos})))

            elif msg.get("type") == "cancel":
                task_id = msg.get("task_id")
                if task_id in _active_downloads:
                    _active_downloads[task_id]["cancelled"] = True
                await _send({"type": "cancelled", "task_id": task_id})

            elif msg.get("type") == "pause":
                await _send({"type": "paused", "task_id": msg.get("task_id")})

    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass