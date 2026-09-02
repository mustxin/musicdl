import { useCallback, useState, useEffect, useRef } from 'react'
import useSearch from '../hooks/useSearch'
import SearchHistory from './SearchHistory'
import SourceDropdown from './SourceDropdown'

export default function SearchBar() {
  const { keyword, setKeyword, status, startSearch } = useSearch()
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

  const handleFocus = () => {
    if (!keyword.trim()) setShowHistory(true)
  }

  const handleClear = () => {
    setKeyword('')
    inputRef.current?.focus()
  }

  const isSearching = status === 'searching'

  return (
    <div className="w-full" ref={containerRef}>
      {/* Spotify-style unified pill row */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
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
            disabled={isSearching}
          />
          {/* Clear button */}
          {keyword && !isSearching && (
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
        <button
          onClick={() => { setShowHistory(false); startSearch() }}
          disabled={isSearching || !keyword.trim()}
          className="h-12 px-7 bg-indigo-600 hover:bg-indigo-500 disabled:bg-midnight-800 disabled:text-neutral-500 text-white text-sm font-medium rounded-full transition-colors disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
        >
          {isSearching ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    </div>
  )
}