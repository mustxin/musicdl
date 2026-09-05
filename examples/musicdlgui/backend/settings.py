"""GUI settings: directory layout + cache cleanup.

Directory split (musicdlgui is location-agnostic — no repo-root dependency):
- SEARCH CACHE:  backend/.cache/  (internal; musicdl writes search_results.pkl
  there). Packaged Electron apps override via MUSICDLGUI_CACHE_DIR env var.
- DOWNLOADS:     ~/Music/musicdlgui by default; user-configurable, stored in
  backend/.gui_settings.json so it survives restarts. ws_download resolves it
  at request time via get_download_dir().
- SETTINGS/HISTORY: backend/.gui_settings.json / backend/.search_history.json.
"""
import os
import json
import time

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_SETTINGS_FILE = os.path.join(_BACKEND_DIR, ".gui_settings.json")
# Internal search cache (musicdl search_results.pkl) — never user-facing.
# Packaged apps override via MUSICDLGUI_CACHE_DIR (set by electron/main.js).
DEFAULT_CACHE_DIR = os.environ.get("MUSICDLGUI_CACHE_DIR") or os.path.join(_BACKEND_DIR, ".cache")
# User-facing default download dir; overridable via settings (.gui_settings.json).
DEFAULT_DOWNLOAD_DIR = os.path.join(os.path.expanduser("~"), "Music", "musicdlgui")

# Files considered cache/junk
_CACHE_SUFFIXES = (".pkl",)  # search_results.pkl / download_results.pkl
_CACHE_NAMES = {".search_history.json"}  # (defensive; legacy locations)
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


def get_default_download_dir() -> str:
    """The default download dir, created on first use."""
    os.makedirs(DEFAULT_DOWNLOAD_DIR, exist_ok=True)
    return DEFAULT_DOWNLOAD_DIR


def get_search_cache_dir() -> str:
    """The internal search cache dir, created on first use."""
    os.makedirs(DEFAULT_CACHE_DIR, exist_ok=True)
    return DEFAULT_CACHE_DIR


def get_download_dir() -> str:
    """Current download directory (custom if set, else the default)."""
    d = _read_settings().get("download_dir", "")
    if d and os.path.isdir(d):
        return d
    return get_default_download_dir()


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
    return get_default_download_dir()


def _clean_tree(root: str, remove_pkl: bool) -> tuple[int, int, int]:
    """Walk one tree removing junk. Returns (removed, freed_bytes, removed_dirs).

    remove_pkl=True → also remove .pkl cache files (used for the SEARCH CACHE
    dir where everything is junk; the download dir keeps .pkl checks only
    defensively for users pointing at legacy locations).
    Targets: .pkl (optional), 0-byte shells, empty dirs (bottom-up).
    Never touches non-empty audio files or .lrc lyrics.
    """
    if not root or not os.path.isdir(root):
        return 0, 0, 0
    removed, freed_bytes, removed_dirs = 0, 0, 0
    for _round in range(3):  # Windows may briefly hold handles — retry
        for dirpath, _dirnames, filenames in os.walk(root, topdown=False):
            for fn in filenames:
                fp = os.path.join(dirpath, fn)
                ext = os.path.splitext(fn)[1].lower()
                try:
                    size = os.path.getsize(fp)
                except OSError:
                    continue
                is_cache = remove_pkl and (ext in _CACHE_SUFFIXES or fn in _CACHE_NAMES)
                if is_cache or size == 0:
                    try:
                        os.remove(fp)
                        removed += 1
                        freed_bytes += size
                    except OSError:
                        pass
            # after removing files (walk is bottom-up), drop dirs that are now empty
            try:
                if not os.listdir(dirpath) and os.path.abspath(dirpath) != os.path.abspath(root):
                    os.rmdir(dirpath)
                    removed_dirs += 1
            except OSError:
                pass
        time.sleep(0.2)
    return removed, freed_bytes, removed_dirs


def clean_cache() -> dict:
    """Remove junk from BOTH the search-cache dir and the download dir.

    Search cache: .pkl files, 0-byte shells, empty dirs (all junk).
    Download dir: 0-byte shells, empty dirs; .pkl kept as a defensive
    check for users whose download dir is a legacy musicdl_outputs tree.
    Never touches non-empty audio files or .lrc lyrics.
    """
    removed, freed_bytes, removed_dirs = 0, 0, 0
    for root, remove_pkl in ((get_search_cache_dir(), True), (get_download_dir(), False)):
        r, b, d = _clean_tree(root, remove_pkl)
        removed += r
        freed_bytes += b
        removed_dirs += d
    return {"removed": removed, "freed_bytes": freed_bytes, "removed_dirs": removed_dirs}


def format_bytes(n: int) -> str:
    if n >= 1024 ** 3:
        return f"{n / 1024 ** 3:.2f} GB"
    if n >= 1024 ** 2:
        return f"{n / 1024 ** 2:.1f} MB"
    if n >= 1024:
        return f"{n / 1024:.0f} KB"
    return f"{n} B"