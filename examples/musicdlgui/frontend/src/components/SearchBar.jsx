import { useCallback, useState, useEffect, useRef } from 'react'
import useSearch from '../hooks/useSearch'
import SearchHistory from './SearchHistory'
import SourceDropdown from './SourceDropdown'

export default function SearchBar() {
  const { keyword, setKeyword, status, sources, sourceStatus, startSearch } = useSearch()
  const [showHistory, setShowHistory] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(null)
  const containerRef = useRef(null)

  const activeSourceNames = Object.entries(sources)
    .filter(([, v]) => v.enabled)
    .map(([k, v]) => ({ name: k, short: v.short }))

  const totalSources = activeSourceNames.length
  const doneSources = activeSourceNames.filter(s => sourceStatus[s.name] === 'done').length
  const isSearching = status === 'searching'
  const isComplete = status === 'done'

  // Elapsed time counter
  useEffect(() => {
    if (isSearching) {
      setElapsed(0)
      elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(elapsedRef.current)
    }
    return () => clearInterval(elapsedRef.current)
  }, [isSearching])

  // Close history on click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && status !== 'searching' && keyword.trim()) {
        setShowHistory(false)
        startSearch()
      }
      if (e.key === 'Escape') {
        setShowHistory(false)
      }
    },
    [status, startSearch, keyword]
  )

  const handleHistorySelect = (kw) => {
    setKeyword(kw)
    setShowHistory(false)
    startSearch(kw)
  }

  const handleFocus = () => {
    if (!keyword.trim()) setShowHistory(true)
  }

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  return (
    <div className="w-full" ref={containerRef}>
      {/* Search input row */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              if (e.target.value.trim()) setShowHistory(false)
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, artists, albums..."
            className="w-full pl-10 pr-4 py-3 bg-midnight-900 border border-midnight-700 focus:border-midnight-600 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors"
            disabled={isSearching}
          />
          <SearchHistory visible={showHistory} onSelect={handleHistorySelect} />
        </div>
        {/* Sources dropdown */}
        <SourceDropdown />
        <button
          onClick={() => { setShowHistory(false); startSearch() }}
          disabled={isSearching || !keyword.trim()}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-midnight-800 disabled:text-neutral-500 text-white text-sm font-medium rounded-xl transition-colors disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
        >
          {isSearching ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching
            </>
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* Source tags + search progress (merged row) */}
      {(isSearching || isComplete) && (
        <div className="mt-3 p-3 rounded-2xl bg-midnight-900/60 border border-midnight-800">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Per-source badges */}
            {activeSourceNames.map(({ name, short }) => {
              const s = sourceStatus[name]
              const isDone = s === 'done'
              const isErr = s === 'error'
              return (
                <span
                  key={name}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                    isDone
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : isErr
                      ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                      : 'bg-midnight-800 text-neutral-400'
                  }`}
                >
                  {!isDone && !isErr && (
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {isDone && <span>✓</span>}
                  {isErr && <span>✗</span>}
                  {short}
                </span>
              )
            })}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Status text */}
            {isSearching ? (
              <span className="text-xs text-neutral-500">
                {doneSources}/{totalSources} done · {formatElapsed(elapsed)} elapsed
              </span>
            ) : (
              <span className="text-xs text-emerald-400">
                Complete · {doneSources}/{totalSources} sources · {formatElapsed(elapsed)}
              </span>
            )}
          </div>

          {/* User-friendly hint */}
          {isSearching && (
            <p className="text-xs text-neutral-600 mt-2">
              {doneSources > 0
                ? `资源解析中，已找到 ${doneSources} 个源的结果，其他源请耐心等待...`
                : '资源解析中，请耐心等待...'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}