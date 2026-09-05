import { useCallback, useState, useEffect, useRef } from 'react'
import useSearch from '../hooks/useSearch'
import SearchHistory from './SearchHistory'
import SourceDropdown from './SourceDropdown'

const NAV_BTN = 'w-8 h-12 flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-500'

export default function SearchBar() {
  const {
    keyword, setKeyword, status, startSearch,
    navBack, navForward, canGoBack, canGoForward,
  } = useSearch()
  const [showHistory, setShowHistory] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

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

  const handleClear = () => {
    setKeyword('')
    inputRef.current?.focus()
  }

  const handleRefresh = () => {
    if (status !== 'searching' && keyword.trim()) {
      startSearch()
    }
  }

  const isSearching = status === 'searching'

  // Listen for external focus requests (e.g. "Search for music" button on the
  // downloads page switches to search and focuses the input)
  useEffect(() => {
    const handler = () => inputRef.current?.focus()
    window.addEventListener('musicdl:focus-search', handler)
    return () => window.removeEventListener('musicdl:focus-search', handler)
  }, [])

  // Focusing the search box switches the app to the search page — the search
  // bar is persistent in the header, so this is how users "go back to search".
  const handleFocus = () => {
    window.dispatchEvent(new Event('musicdl:goto-search'))
    if (!keyword.trim()) setShowHistory(true)
  }

  return (
    <div className="w-full" ref={containerRef}>
      {/* Browser-style nav group + search pill */}
      <div className="flex gap-2 items-center">
        {/* Back / Forward / Refresh */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={navBack}
            disabled={!canGoBack}
            className={NAV_BTN}
            aria-label="Back to previous search"
            title="Back"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={navForward}
            disabled={!canGoForward}
            className={NAV_BTN}
            aria-label="Forward to next search"
            title="Forward"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isSearching || !keyword.trim()}
            className={NAV_BTN}
            aria-label="Refresh search results"
            title="Refresh"
          >
            <svg className={`w-[18px] h-[18px] ${isSearching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="flex-1 relative min-w-0">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-neutral-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              if (e.target.value.trim()) setShowHistory(false)
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, artists, albums..."
            aria-label="Search keywords"
            className={`w-full h-12 pl-11 ${keyword ? 'pr-11' : 'pr-5'} bg-midnight-800/80 hover:bg-midnight-800 border border-transparent hover:border-midnight-700 focus:border-midnight-600 rounded-full text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all duration-200`}
          />
          {/* Clear button — clickable anytime there's content (even mid-search) */}
          {keyword && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-100 hover:bg-midnight-700 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
              aria-label="Clear search"
              title="Clear"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <SearchHistory visible={showHistory} onSelect={handleHistorySelect} />
        </div>

        {/* Sources dropdown */}
        <SourceDropdown />
      </div>
    </div>
  )
}