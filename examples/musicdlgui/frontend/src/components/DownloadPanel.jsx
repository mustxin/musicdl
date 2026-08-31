import useDownload from '../hooks/useDownload'
import DownloadItem from './DownloadItem'

export default function DownloadPanel() {
  const { items, panelExpanded, togglePanel, cancelDownload, clearCompleted } = useDownload()

  const hasCompleted = items.some((i) => i.status === 'complete' || i.status === 'cancelled')

  const openDownloadsFolder = async () => {
    try {
      const host = window.location.hostname || '127.0.0.1'
      await fetch(`http://${host}:8765/downloads/open`)
    } catch (err) {
      console.error('Failed to open downloads folder:', err)
    }
  }

  return (
    <div className="border-t border-neutral-800 bg-neutral-900/95 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          onClick={togglePanel}
          className="flex items-center gap-2 hover:text-neutral-200 transition-colors"
        >
          <svg
            className={`w-4 h-4 text-neutral-400 transition-transform ${panelExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-sm font-medium text-neutral-300">
            Downloads
          </span>
          {items.length > 0 && (
            <span className="text-xs text-neutral-500">({items.length})</span>
          )}
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={openDownloadsFolder}
            className="text-xs text-neutral-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
            title="Open downloads folder"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            Open folder
          </button>
          {hasCompleted && (
            <button
              onClick={(e) => { e.stopPropagation(); clearCompleted() }}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Clear completed
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {panelExpanded && (
        <div className="max-h-64 overflow-y-auto border-t border-neutral-800/50">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-600 text-center py-8">
              No downloads yet
            </p>
          ) : (
            items.map((item) => (
              <DownloadItem
                key={item.id}
                item={item}
                onCancel={cancelDownload}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}