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
    """Remove cache files (.pkl) under the download dir. Returns stats.

    Walks each source subdirectory but stays inside the download root.
    Never touches audio files or .lrc lyrics.
    """
    root = get_download_dir()
    removed, freed_bytes = 0, 0
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            fp = os.path.join(dirpath, fn)
            if os.path.splitext(fn)[1].lower() in _CACHE_SUFFIXES or fn in _CACHE_NAMES:
                try:
                    freed_bytes += os.path.getsize(fp)
                    os.remove(fp)
                    removed += 1
                except OSError:
                    pass
    return {"removed": removed, "freed_bytes": freed_bytes}


def format_bytes(n: int) -> str:
    if n >= 1024 ** 3:
        return f"{n / 1024 ** 3:.2f} GB"
    if n >= 1024 ** 2:
        return f"{n / 1024 ** 2:.1f} MB"
    if n >= 1024:
        return f"{n / 1024:.0f} KB"
    return f"{n} B"