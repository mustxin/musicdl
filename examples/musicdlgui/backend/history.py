"""Shared search history module. Used by server.py and ws_search.py."""
import os
import json

# Project root is 3 levels up from this file: backend/ -> musicdlgui/ -> examples/ -> repo root
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_DOWNLOAD_DIR = os.path.join(_PROJECT_ROOT, "musicdl_outputs")
HISTORY_FILE = os.path.join(_DOWNLOAD_DIR, ".search_history.json")
MAX_HISTORY = 20

os.makedirs(_DOWNLOAD_DIR, exist_ok=True)


def read_history() -> list:
    """Read search history from JSON file."""
    try:
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return []


def write_history(items: list):
    """Write search history to JSON file."""
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def save_search_history(keyword: str, sources: list):
    """Add a search entry to history."""
    from datetime import datetime
    items = read_history()
    items = [h for h in items if h.get("keyword") != keyword]
    items.insert(0, {
        "keyword": keyword,
        "sources": sources,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
    })
    items = items[:MAX_HISTORY]
    write_history(items)