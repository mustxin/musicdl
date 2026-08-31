import { useCallback } from 'react'
import useSearch from '../hooks/useSearch'

export default function SearchBar() {
  const { keyword, setKeyword, status, sources, startSearch } = useSearch()

  const activeSourceNames = Object.entries(sources)
    .filter(([, v]) => v.enabled)
    .map(([k, v]) => v.short || k)

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && status !== 'searching') {
        startSearch()
      }
    },
    [status, startSearch]
  )

  const isSearching = status === 'searching'

  return (
    <div className="w-full">
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
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, artists, albums..."
            className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
            disabled={isSearching}
          />
        </div>
        <button
          onClick={startSearch}
          disabled={isSearching || !keyword.trim()}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm font-medium rounded-xl transition-colors disabled:cursor-not-allowed flex items-center gap-2"
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

      {/* Active source tags */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {activeSourceNames.map((name) => (
          <span
            key={name}
            className="px-2.5 py-0.5 text-xs rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}