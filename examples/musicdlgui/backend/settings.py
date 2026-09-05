"""GUI settings: custom download directory + cache cleanup.

The download dir is stored in backend/.gui_settings.json so it survives
restarts; ws_download reads it at request time via get_download_dir().
"""
import os
import json

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, "..", "..", ".."))
_SETTINGS_FILE = os.path.join(_BACKEND_DIR, ".gui_settings.json")
DEFAULT_DOWNLOAD_DIR = os.path.join(_PROJECT_ROOT, "musicdl_outputs")

# Files considered cache/junk inside the download directory
_CACHE_SUFFIXES = (".pkl",)  # search_results.pkl / download_results.pkl
_CACHE_NAMES = {".search_history.json"}  # (defensive; normally not under download dir)
# NOTE on 0-byte audio shells: open(path,'wb') creates the file before the
# first chunk arrives; a pause/cancel/error in that window (or an empty-body
# 200 response) leaves it at 0 bytes. clean_cache deletes ANY 0-byte file,
# which covers audio shells and stray temp writes alike. Empty dirs are the
# leftovers of source-client dirs whose every file was removed.


def _read_settings() -> dict:
    try:
        if os.path.exists(_SETTINGS_FILE):
            with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _write_settings(settings: dict):
    with open(_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)


def get_download_dir() -> str:
    """Current download directory (custom if set, else the default)."""
    d = _read_settings().get("download_dir", "")
    if d and os.path.isdir(d):
        return d
    return DEFAULT_DOWNLOAD_DIR


def set_download_dir(path: str) -> tuple[bool, str]:
    """Set a custom download directory. Creates it if missing."""
    try:
        os.makedirs(path, exist_ok=True)
    except Exception as e:
        return False, str(e)
    _write_settings({**_read_settings(), "download_dir": os.path.abspath(path)})
    return True, os.path.abspath(path)


def reset_download_dir() -> str:
    """Reset to the default directory."""
    _write_settings({**_read_settings(), "download_dir": ""})
    return DEFAULT_DOWNLOAD_DIR


def clean_cache() -> dict:
    """Remove junk under the download dir. Returns stats.

    Targets:
    - .pkl cache files (search/download result dumps)
    - 0-byte audio files (empty shells from interrupted downloads — see
      the comment on _AUDIO_SUFFIXES for how they arise)
    - 0-byte unknown files (stray temp writes)
    - empty directories left after the above removals (bottom-up)
    Never touches non-empty audio files or .lrc lyrics.
    """
    root = get_download_dir()
    removed, freed_bytes = 0, 0
    empty_dirs = []
    for dirpath, dirnames, filenames in os.walk(root, topdown=False):
        for fn in filenames:
            fp = os.path.join(dirpath, fn)
            ext = os.path.splitext(fn)[1].lower()
            try:
                size = os.path.getsize(fp)
            except OSError:
                continue
            is_cache = ext in _CACHE_SUFFIXES or fn in _CACHE_NAMES
            # 0-byte junk: audio shells and any other empty file
            is_zero_shell = size == 0
            if is_cache or is_zero_shell:
                try:
                    os.remove(fp)
                    removed += 1
                    freed_bytes += size  # 0 for shells; count anyway for uniformity
                except OSError:
                    pass
        # after removing files (walk is bottom-up), drop dirs that are now empty
        try:
            if not os.listdir(dirpath) and os.path.abspath(dirpath) != os.path.abspath(root):
                os.rmdir(dirpath)
                empty_dirs.append(dirpath)
        except OSError:
            pass
    return {"removed": removed, "freed_bytes": freed_bytes, "removed_dirs": len(empty_dirs)}


def format_bytes(n: int) -> str:
    if n >= 1024 ** 3:
        return f"{n / 1024 ** 3:.2f} GB"
    if n >= 1024 ** 2:
        return f"{n / 1024 ** 2:.1f} MB"
    if n >= 1024:
        return f"{n / 1024:.0f} KB"
    return f"{n} B"