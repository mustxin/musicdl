import useDownload from '../hooks/useDownload'
import DownloadItem from './DownloadItem'

export default function DownloadPanel() {
  const { items, panelExpanded, togglePanel, cancelDownload, clearCompleted } = useDownload()

  const hasCompleted = items.some((i) => i.status === 'complete' || i.status === 'cancelled')

  return (
    <div className="border-t border-neutral-800 bg-neutral-900/95 backdrop-blur">
      {/* Header */}
      <button
        onClick={togglePanel}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
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
        </div>
        {hasCompleted && (
          <button
            onClick={(e) => { e.stopPropagation(); clearCompleted() }}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Clear completed
          </button>
        )}
      </button>

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