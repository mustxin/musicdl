import { useDownloadContext } from '../contexts/DownloadContext'
import DownloadItem from './DownloadItem'

export default function DownloadPanel() {
  const { items, cancelDownload, clearCompleted } = useDownloadContext()

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <h2 className="text-lg font-semibold text-neutral-200">Downloads</h2>
          {items.length > 0 && (
            <span className="text-sm text-neutral-500">({items.length})</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openDownloadsFolder}
            className="text-xs text-neutral-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            Open folder
          </button>
          {hasCompleted && (
            <button
              onClick={clearCompleted}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
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
              <svg className="w-12 h-12 text-neutral-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <p className="text-sm text-neutral-600">No downloads yet</p>
              <p className="text-xs text-neutral-700 mt-1">Search and download music to see them here</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <DownloadItem
                key={item.id}
                item={item}
                onCancel={cancelDownload}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}