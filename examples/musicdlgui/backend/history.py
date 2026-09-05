"""Shared search history module. Used by server.py and ws_search.py."""
import os
import json

# Backend dir is this file's directory — fully location-agnostic
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
HISTORY_FILE = os.path.join(_BACKEND_DIR, ".search_history.json")
MAX_HISTORY = 20


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