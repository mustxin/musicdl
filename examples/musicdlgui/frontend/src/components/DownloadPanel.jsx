import { useDownloadContext } from '../contexts/DownloadContext'
import DownloadItem from './DownloadItem'

const BATCH_BTN = 'flex items-center gap-1.5 h-8 px-3 rounded-full text-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none border'

export default function DownloadPanel({ onGoSearch }) {
  const {
    items, pauseItem, resumeItem, cancelItem,
    pauseAll, resumeAll, cancelAll, clearCompleted,
    activeCount, pausedCount,
  } = useDownloadContext()

  const hasCompleted = items.some((i) => i.status === 'complete' || i.status === 'cancelled')
  const hasActive = activeCount > 0
  const hasPaused = pausedCount > 0

  const openDownloadsFolder = async () => {
    try {
      const host = window.location.hostname || '127.0.0.1'
      await fetch(`http://${host}:8765/downloads/open`)
    } catch (err) {
      console.error('Failed to open downloads folder:', err)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <h2 className="text-lg font-semibold text-neutral-200">Downloads</h2>
          {items.length > 0 && (
            <span className="text-sm text-neutral-500">
              ({items.length}{activeCount > 0 && ` · ${activeCount} active`}{pausedCount > 0 && ` · ${pausedCount} paused`})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Batch operations */}
          {(hasActive || hasPaused) && (
            <div className="flex items-center gap-2">
              {hasActive && (
                <button
                  onClick={pauseAll}
                  className={`${BATCH_BTN} bg-midnight-800/80 hover:bg-midnight-800 text-neutral-400 hover:text-neutral-100 border-transparent hover:border-midnight-700`}
                  aria-label="Pause all active downloads"
                  title="Pause all"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
                  </svg>
                  Pause all
                </button>
              )}
              {hasPaused && (
                <button
                  onClick={resumeAll}
                  className={`${BATCH_BTN} bg-midnight-800/80 hover:bg-midnight-800 text-neutral-400 hover:text-neutral-100 border-transparent hover:border-midnight-700`}
                  aria-label="Resume all paused downloads"
                  title="Resume all"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 4l14 8-14 8z" />
                  </svg>
                  Resume all
                </button>
              )}
              <button
                onClick={cancelAll}
                className={`${BATCH_BTN} bg-midnight-800/80 hover:bg-red-500/10 text-neutral-400 hover:text-red-300 border-transparent hover:border-red-500/30`}
                aria-label="Cancel all active downloads"
                title="Cancel all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel all
              </button>
            </div>
          )}
          <button
            onClick={openDownloadsFolder}
            className="text-xs text-neutral-500 hover:text-indigo-400 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            Open folder
          </button>
          {hasCompleted && (
            <button
              onClick={clearCompleted}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
            >
              Clear completed
            </button>
          )}
        </div>
      </div>

      {/* Download list */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-12 h-12 text-midnight-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <p className="text-sm text-neutral-500">No downloads yet</p>
              {onGoSearch && (
                <button
                  onClick={onGoSearch}
                  className="mt-4 text-xs px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                >
                  Search for music →
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <DownloadItem
                key={item.id}
                item={item}
                onPause={pauseItem}
                onResume={resumeItem}
                onCancel={cancelItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}