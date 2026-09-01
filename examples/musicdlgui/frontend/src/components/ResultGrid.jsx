import useSearch from '../hooks/useSearch'
import useDownload from '../hooks/useDownload'
import ResultCard from './ResultCard'

export default function ResultGrid() {
  const { results, status } = useSearch()
  const { startDownload } = useDownload()

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
          <svg className="w-16 h-16 text-neutral-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-neutral-500 text-sm">Search for music to get started</p>
        </div>
      </div>
    )
  }

  if (status === 'searching' && results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin w-8 h-8 text-indigo-400 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-neutral-400 text-sm">Searching...</p>
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