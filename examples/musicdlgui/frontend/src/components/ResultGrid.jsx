import useSearch from '../hooks/useSearch'
import useDownload from '../hooks/useDownload'
import ResultCard from './ResultCard'

export default function ResultGrid() {
  const { results, status, sourceStatus, sources } = useSearch()
  const { startDownload } = useDownload()

  const handleDownload = (songInfo) => {
    startDownload([songInfo])
  }

  const handleDownloadAll = () => {
    if (results.length > 0) {
      startDownload(results)
    }
  }

  const activeSources = Object.entries(sources)
    .filter(([, v]) => v.enabled)
    .map(([k, v]) => ({ name: k, short: v.short }))

  const totalSources = activeSources.length
  const doneSources = activeSources.filter(s => sourceStatus[s.name] === 'done').length
  const errorSources = activeSources.filter(s => sourceStatus[s.name] === 'error').length
  const isComplete = status === 'done'

  if (status === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-neutral-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-neutral-500 text-sm">Search for music to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Search progress indicator */}
      <div className="mb-4 p-3 rounded-xl bg-neutral-900/50 border border-neutral-800">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isComplete ? (errorSources > 0 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-indigo-500'
              }`}
              style={{ width: totalSources > 0 ? `${(doneSources / totalSources) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-xs text-neutral-500 tabular-nums whitespace-nowrap">
            {doneSources}/{totalSources}
          </span>
        </div>

        {/* Per-source status chips */}
        <div className="flex flex-wrap gap-2">
          {activeSources.map(({ name, short }) => {
            const s = sourceStatus[name]
            const isDone = s === 'done'
            const isError = s === 'error'
            const isSearching = !isDone && !isError
            return (
              <span
                key={name}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  isDone
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : isError
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-neutral-700 text-neutral-400'
                }`}
              >
                {isSearching && (
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isDone && <span className="text-emerald-400">✓</span>}
                {isError && <span>✗</span>}
                {short}
              </span>
            )
          })}
        </div>

        {/* Status text */}
        <p className="text-xs text-neutral-500 mt-2">
          {isComplete
            ? `Search complete — ${results.length} result${results.length !== 1 ? 's' : ''} found`
            : results.length > 0
            ? `Found ${results.length} result${results.length !== 1 ? 's' : ''} so far, searching remaining sources...`
            : 'Searching...'}
        </p>
      </div>

      {/* Header with download all */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-400">
          {results.length} result{results.length !== 1 ? 's' : ''}
        </p>
        {results.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className="text-xs px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
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