# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

musicdl is a lightweight music downloader library and CLI written in pure Python. It supports 50+ music sources organized into four categories: direct platform APIs, aggregator gateways, audio book platforms, and unofficial download sites.

## Commands

```bash
# Install from local source
pip install -e .

# Run the interactive CLI
musicdl
musicdl -m NeteaseMusicClient,QQMusicClient
musicdl -k "Jay Chou" -m NeteaseMusicClient,QQMusicClient

# Parse and download a playlist
musicdl -p "https://music.163.com/#/playlist?id=3039971654" -m NeteaseMusicClient

# Run directly (no install needed)
python musicdl/musicdl.py
```

There is no test suite in this repository.

## Architecture

### Registry-Based Plugin System

All music clients are registered through a builder pattern:

- `BaseModuleBuilder` ([musicdl/modules/utils/modulebuilder.py](musicdl/modules/utils/modulebuilder.py)) — a generic registry that stores callable class references keyed by name. Provides `register()`, `build()`, `delete()`, etc.
- `MusicClientBuilder` ([musicdl/modules/sources/__init__.py](musicdl/modules/sources/__init__.py)) — extends `BaseModuleBuilder` with a static `REGISTERED_MODULES` dict containing all 50+ client classes.
- `BuildMusicClient` — a partially-applied `MusicClientBuilder().build`, exported as a callable. Given `{'type': 'NeteaseMusicClient', ...}`, it instantiates the registered class with the remaining kwargs.

### BaseMusicClient ([musicdl/modules/sources/base.py](musicdl/modules/sources/base.py))

The abstract base that every music client extends. Key contract:

| Method | Purpose |
|--------|---------|
| `_constructsearchurls(keyword, rule, request_overrides)` | Must be overridden. Returns a list of URL dicts to fetch. |
| `_search(keyword, search_url, ...)` | Must be overridden. Fetches one search URL and appends `SongInfo` objects to the provided list. |
| `search(keyword, ...)` | **Inherited.** Orchestrates multi-threaded search: calls `_constructsearchurls` → dispatches `_search` via `ThreadPoolExecutor` → deduplicates → saves results as `.pkl`. |
| `_download(song_info, ...)` | **Inherited.** Handles HLS and HTTP download of a single `SongInfo`. |
| `download(song_infos, ...)` | **Inherited.** Orchestrates multi-threaded download with a `rich` progress bar. |
| `parseplaylist(playlist_url, ...)` | Optional override. Parses a platform-specific playlist URL into `SongInfo` list. |

The base class also provides `get()`/`post()` HTTP helpers with retry logic, auto-proxy support via `pyfreeproxy`, curl-cffi impersonation, and session management.

### MusicClient Facade ([musicdl/musicdl.py](musicdl/musicdl.py))

The unified entry point that orchestrates multiple `BaseMusicClient` instances:

- `__init__` instantiates one `BaseMusicClient` per source via `BuildMusicClient`, each with its own config, thread count, request overrides, and search rules.
- `search(keyword)` fans out to all sources concurrently via `ThreadPoolExecutor`, then merges results.
- `download(song_infos)` classifies `SongInfo` objects by source and dispatches to each client's `download()`.
- `parseplaylist(playlist_url)` tries each source until one succeeds.
- `startcmdui()` runs the interactive terminal UI loop (search → select → download).

The CLI (`MusicClientCMD`) is a Click command that parses JSON config strings and delegates to `MusicClient`.

### SongInfo Dataclass ([musicdl/modules/utils/data.py](musicdl/modules/utils/data.py))

The central data model passed between all layers. Key fields: `source`, `song_name`, `singers`, `album`, `ext`, `download_url`, `protocol` (HTTP/HLS), `lyric`, `cover_url`, `episodes` (for audio book platforms with multi-episode content). The `with_valid_download_url` property validates the URL before download.

### Client Categories

- **`sources/`** — Direct integrations with 25+ music platforms (Netease, QQ, Spotify, Apple Music, YouTube, etc.). Each file is one class extending `BaseMusicClient`.
- **`audiobooks/`** — Audio book platforms (Ximalaya, Lizhi, Qingting, LRTS, iTunes). These often return `SongInfo` with `episodes` (nested `SongInfo` list).
- **`common/`** — Aggregator/multi-source gateways (GDStudio, TuneHub, MP3Juice, etc.) that proxy search across multiple underlying platforms.
- **`thirdpartysites/`** — Unofficial download sites and scrapers (Gequbao, Mitu, Fangpi, etc.).

### Utils Layer ([musicdl/modules/utils/](musicdl/modules/utils/))

- `cmd.py` — `CommandBuilder` fluent API for constructing CLI tool invocations (FFmpeg, N_m3u8DL-RE, mp4decrypt, metaflac, amdecrypt). Used by clients that need external tools for decryption/remuxing (Apple Music, TIDAL, MOOV, SoundCloud).
- `songinfoutils.py` — `SongInfoUtils` for supplementing metadata (via TinyTag), embedding lyrics/cover art/tags (via mutagen), and Whisper-based LRC generation.
- `cookies.py` — Cookie format conversion utilities.
- `hls.py` — `HLSDownloader` for M3U8 stream downloads.
- `logger.py` — `LoggerHandle` wrapper.
- Platform-specific utils: `neteaseutils.py`, `qqutils.py`, `spotifyutils.py`, `tidalutils.py`, `appleutils.py`, etc.

### Decorator Pattern for Headers/Cookies

Three decorators in `utils/__init__.py` — `usesearchheaderscookies`, `usedownloadheaderscookies`, `useparseheaderscookies` — temporarily swap `self.session.headers` and `self.default_cookies` before a method call and restore them after. This allows one client instance to use different headers/cookies for search vs. download vs. playlist parsing.

### External CLI Tool Dependencies

Some clients require external tools installed on `PATH`:
- **FFmpeg** — Apple Music, MOOV, SoundCloud, StreetVoice, TIDAL (decryption/remuxing)
- **N_m3u8DL-RE** — Apple Music, MOOV, SoundCloud, TIDAL (M3U8/MPD stream download)
- **Bento4 (mp4decrypt)** — Apple Music, MOOV, SoundCloud, TIDAL (DRM decryption)
- **amdecrypt** — Apple Music only (FairPlay decryption with wrapper server)
- **Node.js** — YouTube Music only (via `nodejs-wheel` and custom JS interpreter)

### MCP Server ([mcp/server_local.py](mcp/server_local.py))

A FastMCP-based server exposing `search` and `download` tools for use with Claude and other MCP-compatible agents.