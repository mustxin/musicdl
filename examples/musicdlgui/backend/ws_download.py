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

_download_executor = ThreadPoolExecutor(max_workers=10)
# Per-BATCH control state: { task_id: {"cancelled": bool, "paused": bool,
# "remaining": int, "items": {global_idx: {"paused": bool, "cancelled": bool,
# "downloaded": int, "total": int, "si": SongInfo}} } }
_active_downloads: dict[str, dict] = {}

# Throttle: minimum interval between progress messages per item
_PROGRESS_INTERVAL = 0.25


def _item_state(task_id: str, idx: int) -> dict | None:
    entry = _active_downloads.get(task_id)
    if entry is None:
        return None
    return entry["items"].get(idx)


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


def _classify_download_error(exc: Exception) -> tuple[str, str]:
    """Map a raw download exception to (error_code, user-friendly message).

    error_code drives the frontend presentation (retry hint, icon, wording).
    """
    raw = str(exc)
    # Extract HTTP status defensively: response attr may be a Response whose
    # status_code is a property that can fail; never trust and-chains here.
    status = None
    try:
        resp = getattr(exc, 'response', None)
        if resp is not None:
            status = resp.status_code
    except Exception:
        status = None
    if status is None:
        import re as _re
        m = _re.search(r"\b([45]\d\d)\b", raw)
        if m:
            status = int(m.group(1))
    if not isinstance(status, int):
        status = None
    if status in (403, 410):
        return "link_expired", "下载链接已过期，请重新搜索后再下载"
    if status == 404:
        return "link_gone", "资源不存在或已被下架"
    if status is not None and 400 <= status < 500:
        return "request_rejected", f"下载请求被拒绝（HTTP {status}），请稍后重试或重新搜索"
    if status is not None and 500 <= status < 600:
        return "server_error", f"源服务器错误（HTTP {status}），请稍后重试"
    if "timed out" in raw.lower() or "timeout" in raw.lower():
        return "timeout", "下载超时，请检查网络后重试"
    if "connection" in raw.lower() or isinstance(exc, (ConnectionError, OSError)):
        return "network", "网络连接失败，请检查网络后重试"
    return "download_failed", "下载失败，请重试；若持续失败请重新搜索"


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

    async def _send_error(task_id: str, message: str, error_code: str = "download_failed"):
        await _send({
            "type": "error",
            "task_id": task_id,
            "message": str(message)[:200],
            "error_code": error_code,
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

                _active_downloads[task_id] = {
                    "cancelled": False,
                    "remaining": len(global_infos),
                    "items": {
                        i: {"paused": False, "cancelled": False, "downloaded": 0, "total": 0, "override_pause": False}
                        for i in range(len(global_infos))
                    },
                }

                def report_item_done(tid: str):
                    entry = _active_downloads.get(tid)
                    if entry is not None:
                        entry["remaining"] = entry.get("remaining", 0) - 1
                        if entry.get("remaining", 0) <= 0:
                            _active_downloads.pop(tid, None)

                def do_download(items_with_idx, tid):
                    """Dispatch each item as its OWN executor job.

                    Downloads run in PARALLEL — a paused item blocks only
                    itself; later items start immediately. (Previously the
                    batch was a serial for-loop: pausing item-0 stalled
                    items 1..N behind it, and 'resume' on a later, un-started
                    item was a no-op because the loop never reached it.)
                    """
                    import requests as _requests
                    UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'}

                    def batch_cancelled():
                        return _active_downloads.get(tid, {}).get("cancelled", False)

                    def item_or_batch_paused(ist):
                        # pause is per-item OR batch-level; a per-item resume
                        # sets override_pause so that one item runs despite
                        # the batch flag (isolation between items).
                        if ist.get("override_pause"):
                            return False
                        return ist["paused"] or _active_downloads.get(tid, {}).get("paused", False)

                    def item_or_batch_cancelled(ist):
                        return ist["cancelled"] or batch_cancelled()

                    def download_one(i, si):
                        item_task_id = f"{tid}-{i}"
                        song_label = si.song_name or "unknown"
                        ist = _item_state(tid, i)
                        if ist is None:
                            return  # batch already gone
                        # If paused before starting (queued under pause), wait here.
                        while item_or_batch_paused(ist) and not item_or_batch_cancelled(ist):
                            time.sleep(0.2)
                        try:
                            # retry loop — re-entered on resume
                            while True:
                                if item_or_batch_cancelled(ist):
                                    return
                                resume_from = ist["downloaded"]
                                headers = dict(UA)
                                if resume_from > 0 and os.path.isfile(si.save_path):
                                    headers['Range'] = f'bytes={resume_from}-'
                                elif resume_from > 0:
                                    # partial file vanished — restart
                                    ist["downloaded"] = 0
                                    resume_from = 0
                                resp = _requests.get(
                                    si.download_url, stream=True, timeout=(10, 60),
                                    headers=headers,
                                )
                                # 200 = full body (server ignored Range); 206 = partial
                                if resp.status_code == 200 and resume_from > 0:
                                    ist["downloaded"] = 0
                                    resume_from = 0
                                resp.raise_for_status()
                                total_bytes = int(float(resp.headers.get("Content-Length", 0) or 0))
                                if total_bytes > 0:
                                    if resume_from > 0:
                                        total_bytes += resume_from
                                    ist["total"] = total_bytes
                                elif ist["total"] > 0:
                                    total_bytes = ist["total"]
                                # Fallback total from search-time file_size text
                                if total_bytes <= 0 and si.file_size:
                                    m = str(si.file_size).upper().replace(" ", "")
                                    for unit, mult in (("GB", 1024**3), ("MB", 1024**2), ("KB", 1024)):
                                        if m.endswith(unit):
                                            try: total_bytes = int(float(m[:-len(unit)]) * mult)
                                            except ValueError: pass
                                            break
                                    if total_bytes > 0:
                                        ist["total"] = total_bytes
                                downloaded = resume_from
                                speed = 0.0
                                speed_window_start = time.monotonic()
                                speed_window_bytes = 0
                                paused_flag = False
                                with open(si.save_path, "ab" if resume_from > 0 else "wb") as fp:
                                    for chunk in resp.iter_content(chunk_size=64 * 1024):
                                        # per-item or batch cancellation
                                        if item_or_batch_cancelled(ist):
                                            return
                                        # per-item or batch pause — break stream, keep offset
                                        if item_or_batch_paused(ist):
                                            paused_flag = True
                                            break
                                        if not chunk:
                                            continue
                                        fp.write(chunk)
                                        downloaded += len(chunk)
                                        ist["downloaded"] = downloaded
                                        speed_window_bytes += len(chunk)
                                        now = time.monotonic()
                                        elapsed_win = now - speed_window_start
                                        if elapsed_win >= 1.0:
                                            speed = speed_window_bytes / elapsed_win
                                            speed_window_start = now
                                            speed_window_bytes = 0
                                        if now - last_report[0] >= _PROGRESS_INTERVAL:
                                            last_report[0] = now
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
                                if paused_flag:
                                    # wait until resumed (item-level AND batch-level
                                    # both clear) or terminal
                                    while item_or_batch_paused(ist) and not item_or_batch_cancelled(ist):
                                        time.sleep(0.2)
                                    if item_or_batch_cancelled(ist):
                                        return
                                    continue  # re-request with Range from ist["downloaded"]
                                # stream finished normally
                                break
                            # verify the file actually landed with content
                            if not os.path.isfile(si.save_path) or os.path.getsize(si.save_path) == 0:
                                raise RuntimeError('download produced no file')
                            # write tags/lyrics like client.download() would
                            try:
                                from musicdl.modules.utils import LoggerHandle
                                SongInfoUtils.supplsonginfothensavelyricsthenwritetags(
                                    si, logger_handle=LoggerHandle(), disable_print=True)
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
                            code, friendly = _classify_download_error(e)
                            print(f"[ws_download] failed {si.song_name} ({code}): {e}")
                            try:
                                fut = asyncio.run_coroutine_threadsafe(
                                    _send_error(item_task_id, friendly, code), loop)
                                fut.result(timeout=5)
                            except Exception:
                                pass
                            try:
                                _clean_zero_byte_files(si.work_dir)
                            except Exception:
                                pass
                            report_item_done(tid)

                    # shared per-thread last-report timestamp
                    last_report = [0.0]

                    # parallel dispatch: one job per item, no item blocks another
                    for i, si in items_with_idx:
                        if batch_cancelled():
                            break
                        _download_executor.submit(download_one, i, si)

                # Fire-and-forget: the executor job runs in the background so
                # this handler loop keeps reading pause/resume/cancel messages
                # WHILE the batch downloads. (Awaiting it here would block
                # control messages until the whole batch finished.)
                items_with_idx = list(enumerate(global_infos))
                loop.run_in_executor(_download_executor, do_download, items_with_idx, task_id)

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
                # cancel one item ("{task}-{idx}") or whole batch (task_id)
                tid = msg.get("task_id", "")
                base, _, idx = tid.rpartition("-")
                entry = _active_downloads.get(base) if base else None
                if idx.isdigit() and entry is not None and int(idx) in entry["items"]:
                    entry["items"][int(idx)]["cancelled"] = True
                elif tid in _active_downloads:
                    _active_downloads[tid]["cancelled"] = True
                await _send({"type": "cancelled", "task_id": tid})

            elif msg.get("type") == "pause":
                tid = msg.get("task_id", "")
                base, _, idx = tid.rpartition("-")
                entry = _active_downloads.get(base) if base else None
                if idx.isdigit() and entry is not None and int(idx) in entry["items"]:
                    entry["items"][int(idx)]["paused"] = True
                    entry["items"][int(idx)]["override_pause"] = False
                elif tid in _active_downloads:
                    _active_downloads[tid]["paused"] = True
                await _send({"type": "paused", "task_id": tid})

            elif msg.get("type") == "resume":
                tid = msg.get("task_id", "")
                base, _, idx = tid.rpartition("-")
                entry = _active_downloads.get(base) if base else None
                if idx.isdigit() and entry is not None and int(idx) in entry["items"]:
                    # Resume ONE item: give it a per-item OVERRIDE so it starts
                    # even while the batch-level pause flag stays set. Other
                    # items keep waiting on the batch flag — full isolation.
                    entry["items"][int(idx)]["paused"] = False
                    entry["items"][int(idx)]["override_pause"] = True
                elif tid in _active_downloads:
                    _active_downloads[tid]["paused"] = False
                    # batch resume clears every item's pause state
                    for st in _active_downloads[tid]["items"].values():
                        st["paused"] = False
                        st["override_pause"] = False
                await _send({"type": "resumed", "task_id": tid})

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