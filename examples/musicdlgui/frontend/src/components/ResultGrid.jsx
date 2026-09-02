import { useState, useEffect } from 'react'
import useSearch from '../hooks/useSearch'
import { useDownloadContext } from '../contexts/DownloadContext'
import ResultCard from './ResultCard'

const formatElapsed = (s) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

export default function ResultGrid() {
  const { results, status, keyword, sources, sourceStatus } = useSearch()
  const { startDownload } = useDownloadContext()
  const [elapsed, setElapsed] = useState(0)

  const isSearching = status === 'searching'

  // Elapsed timer — runs while the engine is working
  useEffect(() => {
    if (isSearching) {
      setElapsed(0)
      const timer = setInterval(() => setElapsed(e => e + 1), 1000)
      return () => clearInterval(timer)
    }
  }, [isSearching])

  const enabledSources = Object.entries(sources)
    .filter(([, v]) => v.enabled)
    .map(([k, v]) => ({ name: k, short: v.short }))
  const doneCount = enabledSources.filter(s => sourceStatus[s.name] === 'done').length

  const handleDownload = (songInfo) => {
    startDownload([songInfo])
  }

  const handleDownloadAll = () => {
    if (results.length > 0) {
      startDownload(results)
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

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header with download all */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-400">
          {results.length} result{results.length !== 1 ? 's' : ''}
        </p>
        {results.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className="text-xs px-3 py-1.5 bg-midnight-800 hover:bg-midnight-700 text-neutral-300 rounded-lg border border-midnight-700 hover:border-midnight-600 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          >
            Download All
          </button>
        )}
      </div>

      {/* Result grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {results.map((songInfo, idx) => (
          <ResultCard
            key={`${songInfo.song_name}-${songInfo.singers}-${idx}`}
            songInfo={songInfo}
            onDownload={handleDownload}
          />
        ))}
      </div>
    </div>
  )
}