import { useState, useEffect, useMemo, useRef } from 'react'
import useSearch from '../hooks/useSearch'
import { useDownloadContext } from '../contexts/DownloadContext'
import ResultCard from './ResultCard'

const formatElapsed = (s) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'duration', label: 'Duration' },
  { value: 'size', label: 'File size' },
  { value: 'name', label: 'Name' },
]

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'lossless', label: 'Lossless' },
  { value: 'mp3', label: 'MP3' },
]

function parseSizeToBytes(sizeStr) {
  if (!sizeStr) return 0
  const m = String(sizeStr).match(/([\d.]+)\s*([KMGT]?B)/i)
  if (!m) return 0
  const val = parseFloat(m[1])
  const unit = m[2].toUpperCase()
  const mult = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }
  return val * (mult[unit] || 1)
}

function parseDurationToSecs(durationStr) {
  if (!durationStr) return 0
  const parts = String(durationStr).split(':').map(Number)
  if (parts.some(isNaN)) return 0
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

const CONTROL_BTN = 'flex items-center gap-1.5 h-8 px-3 rounded-full text-xs text-neutral-400 hover:text-neutral-100 bg-midnight-800/80 hover:bg-midnight-800 border border-transparent hover:border-midnight-700 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none'

export default function ResultGrid() {
  const { results, status, keyword, sources, sourceStatus } = useSearch()
  const { startDownload } = useDownloadContext()
  const [elapsed, setElapsed] = useState(0)
  const [sortBy, setSortBy] = useState('default')
  const [filter, setFilter] = useState('all')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showBackTop, setShowBackTop] = useState(false)
  const [sortDir, setSortDir] = useState('desc')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  const scrollRef = useRef(null)
  const sortMenuRef = useRef(null)
  const filterMenuRef = useRef(null)

  const isSearching = status === 'searching'

  // Elapsed timer — runs while the engine is working
  useEffect(() => {
    if (isSearching) {
      setElapsed(0)
      const timer = setInterval(() => setElapsed(e => e + 1), 1000)
      return () => clearInterval(timer)
    }
  }, [isSearching])

  // Close sort/filter menus on click outside
  useEffect(() => {
    const handler = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setShowSortMenu(false)
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) setShowFilterMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset controls when a new search starts
  useEffect(() => {
    setSortBy('default')
    setFilter('all')
  }, [keyword, status === 'searching'])

  const handleScrollBackTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const displayedResults = useMemo(() => {
    let list = [...results]
    if (filter === 'lossless') {
      list = list.filter(r => ['FLAC', 'WAV', 'ALAC', 'APE', 'DSF', 'DFF'].includes((r.ext || '').toUpperCase()))
    } else if (filter === 'mp3') {
      list = list.filter(r => (r.ext || '').toUpperCase() === 'MP3')
    }
    if (sortBy !== 'default') {
      const dir = sortDir === 'asc' ? 1 : -1
      list.sort((a, b) => {
        let cmp = 0
        if (sortBy === 'duration') {
          cmp = parseDurationToSecs(a.duration) - parseDurationToSecs(b.duration)
        } else if (sortBy === 'size') {
          cmp = parseSizeToBytes(a.file_size) - parseSizeToBytes(b.file_size)
        } else if (sortBy === 'name') {
          cmp = (a.song_name || '').localeCompare(b.song_name || '', 'zh-CN')
        }
        return cmp * dir
      })
    }
    return list
  }, [results, filter, sortBy, sortDir])

  // Back-to-top visibility on scroll — declared after displayedResults (TDZ)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => setShowBackTop(el.scrollTop > 200)
    handler()  // sync initial state in case we re-mounted mid-scroll
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [status, displayedResults.length])  // re-bind when the scroll container actually renders

  const enabledSources = Object.entries(sources)
    .filter(([, v]) => v.enabled)
    .map(([k, v]) => ({ name: k, short: v.short }))
  const doneCount = enabledSources.filter(s => sourceStatus[s.name] === 'done').length

  const handleDownload = (songInfo) => {
    startDownload([songInfo])
  }

  const handleDownloadAll = () => {
    // Entering batch mode with everything pre-selected — the user then
    // confirms via the Download action button.
    setSelectionMode(true)
    setSelectedKeys(new Set(displayedResults.map((_, i) => i)))
  }

  // ---- Batch selection mode ----
  // Selection keys are INDICES into displayedResults — unique even when the
  // search returns duplicate tracks (same name/singer/source), which string
  // keys cannot guarantee.
  const resultKey = (songInfo) => displayedResults.indexOf(songInfo)

  const enterSelectionMode = () => {
    setSelectionMode(true)
    setSelectedKeys(new Set())
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedKeys(new Set())
  }

  const toggleSelect = (songInfo) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      const k = resultKey(songInfo)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const allSelected = selectionMode && displayedResults.length > 0 && selectedKeys.size === displayedResults.length

  const toggleSelectAll = () => {
    setSelectedKeys(prev => {
      if (allSelected) return new Set()
      return new Set(displayedResults.map((_, i) => i))
    })
  }

  const selectedSongs = selectionMode
    ? displayedResults.filter(r => selectedKeys.has(resultKey(r)))
    : []

  const handleDownloadSelected = () => {
    if (selectedSongs.length > 0) {
      startDownload(selectedSongs)
      exitSelectionMode()
    }
  }

  if (status === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-midnight-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-neutral-500 text-sm">Search for music to get started</p>
        </div>
      </div>
    )
  }

  if (isSearching && results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" aria-live="polite">
        <div className="text-center">
          {/* Equalizer — the engine is working */}
          <div className="flex items-end justify-center gap-1.5 h-7 mx-auto" aria-hidden="true">
            {[0, 1, 2, 3].map(i => (
              <span
                key={i}
                className="eq-bar w-1.5 h-7 rounded-full bg-indigo-400"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-neutral-200 text-sm font-medium mt-4">Searching…</p>
          <p className="text-neutral-600 text-xs mt-1 tabular-nums">
            {doneCount}/{enabledSources.length} sources · {formatElapsed(elapsed)} elapsed
          </p>
        </div>
      </div>
    )
  }

  if (status === 'done' && results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-14 h-14 text-midnight-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-neutral-400 text-sm">
            No results for “{keyword}”
          </p>
          <p className="text-neutral-600 text-xs mt-1.5">
            Try a different keyword, or enable more sources in the Sources dropdown
          </p>
        </div>
      </div>
    )
  }

  const sortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Default'
  const filterLabel = FILTER_OPTIONS.find(o => o.value === filter)?.label || 'All'

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Header — OUTSIDE the scroll area, so the scrollbar's top aligns
          with the card grid. Two modes: normal (sort/filter/download-all)
          and selection (select-all/selected-count/exit). */}
      <div className="flex items-center justify-between pb-4 pr-2.5">
        <div className="flex items-center gap-2">
          {/* Result count — leftmost, then action buttons */}
          <p className="text-sm text-neutral-400 mr-2">
            {displayedResults.length} result{displayedResults.length !== 1 ? 's' : ''}
            {(filter !== 'all' || sortBy !== 'default') && !selectionMode && (
              <span className="text-neutral-600"> · {results.length} total</span>
            )}
          </p>

          {results.length > 0 && !selectionMode && (
            <>
            <button
              onClick={handleDownloadAll}
              disabled={displayedResults.length === 0}
              className="text-xs px-3 py-1.5 h-8 bg-midnight-800 hover:bg-midnight-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300 rounded-full border border-midnight-700 hover:border-midnight-600 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            <button
              onClick={enterSelectionMode}
              className="text-xs px-3 py-1.5 h-8 bg-midnight-800/80 hover:bg-midnight-800 text-neutral-400 hover:text-neutral-100 rounded-full border border-transparent hover:border-midnight-700 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none flex items-center gap-1.5"
              aria-label="Enter batch selection mode"
              title="Batch select"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Batch
            </button>
            </>
          )}

          {/* Selection-mode toolbar — replaces download/batch while active */}
          {results.length > 0 && selectionMode && (
            <>
              <button
                onClick={toggleSelectAll}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none border ${
                  allSelected
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-midnight-800/80 hover:bg-midnight-800 text-neutral-400 hover:text-neutral-100 border-transparent hover:border-midnight-700'
                }`}
                aria-pressed={allSelected}
              >
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${allSelected ? 'border-white' : 'border-neutral-400'}`}>
                  {allSelected && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {allSelected
                  ? `Deselect all (${selectedKeys.size})`
                  : selectedKeys.size > 0
                  ? `Select all (${selectedKeys.size}/${displayedResults.length})`
                  : `Select all (${displayedResults.length})`}
              </button>
              <button
                onClick={handleDownloadSelected}
                disabled={selectedKeys.size === 0}
                className="text-xs px-3 py-1.5 h-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-midnight-800 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
              <button
                onClick={exitSelectionMode}
                className="flex items-center gap-1 h-8 px-3 rounded-full text-xs text-neutral-400 hover:text-red-300 bg-midnight-800/80 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
                aria-label="Exit batch selection mode"
                title="Exit selection"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Exit
              </button>
            </>
          )}
        </div>

          {results.length > 0 && !selectionMode && (
            <div className="flex items-center gap-2">
            {/* Sort dropdown */}
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false) }}
                className={CONTROL_BTN}
                aria-haspopup="listbox"
                aria-expanded={showSortMenu}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9M17 9v10m0 0l-3-3m3 3l3-3" />
                </svg>
                Sort: {sortLabel}
                {sortBy !== 'default' && (
                  <span className="text-neutral-600">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 bg-midnight-900 border border-midnight-700 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden w-44" role="listbox">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (sortBy === opt.value && opt.value !== 'default') {
                          setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                        } else {
                          setSortBy(opt.value)
                          setSortDir(opt.value === 'default' ? 'desc' : 'desc')
                        }
                        setShowSortMenu(false)
                      }}
                      role="option"
                      aria-selected={sortBy === opt.value}
                      className={`w-full text-left px-3 py-2 text-xs cursor-pointer transition-colors ${
                        sortBy === opt.value ? 'text-indigo-300 bg-indigo-500/10' : 'text-neutral-400 hover:text-neutral-100 hover:bg-midnight-800/60'
                      }`}
                    >
                      {opt.label}
                      {sortBy === opt.value && opt.value !== 'default' && (
                        <span className="float-right text-neutral-600">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter dropdown */}
            <div className="relative" ref={filterMenuRef}>
              <button
                onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false) }}
                className={CONTROL_BTN}
                aria-haspopup="listbox"
                aria-expanded={showFilterMenu}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter: {filterLabel}
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-1 bg-midnight-900 border border-midnight-700 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden w-40" role="listbox">
                  {FILTER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setFilter(opt.value); setShowFilterMenu(false) }}
                      role="option"
                      aria-selected={filter === opt.value}
                      className={`w-full text-left px-3 py-2 text-xs cursor-pointer transition-colors ${
                        filter === opt.value ? 'text-indigo-300 bg-indigo-500/10' : 'text-neutral-400 hover:text-neutral-100 hover:bg-midnight-800/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            </div>
          )}
      </div>

      {/* Scrollable card grid — scrollbar top aligns with the first card row */}
      <div className="flex-1 overflow-y-auto pr-2.5" ref={scrollRef}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-4">
          {displayedResults.map((songInfo, idx) => (
            <ResultCard
              key={`${songInfo.song_name}-${songInfo.singers}-${idx}`}
              songInfo={songInfo}
              onDownload={handleDownload}
              selectionMode={selectionMode}
              selected={selectedKeys.has(resultKey(songInfo))}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      </div>

      {/* Back-to-top — appears after scrolling; 10px gap to the scrollbar */}
      {showBackTop && (
        <button
          onClick={handleScrollBackTop}
          className="absolute bottom-8 right-[22px] w-10 h-10 bg-midnight-800 border border-midnight-700 hover:border-indigo-500/50 hover:bg-midnight-700 text-neutral-400 hover:text-indigo-300 rounded-full flex items-center justify-center shadow-xl shadow-black/50 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none z-40"
          aria-label="Back to top"
          title="Back to top"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}