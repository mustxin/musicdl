const STATUS_STYLES = {
  queued: 'text-neutral-400',
  downloading: 'text-indigo-400',
  complete: 'text-emerald-400',
  error: 'text-red-400',
  cancelled: 'text-neutral-500',
}

export default function DownloadItem({ item, onCancel }) {
  const { songInfo, percent, speed, status, error } = item
  const isActive = status === 'downloading' || status === 'queued'

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-800/30 transition-colors">
      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-200 truncate">{songInfo.song_name || 'Unknown'}</p>
        <p className="text-xs text-neutral-500 truncate">{songInfo.singers || ''}</p>
      </div>

      {/* Progress bar */}
      <div className="w-32">
        <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              status === 'complete' ? 'bg-emerald-500' :
              status === 'error' ? 'bg-red-500' :
              'bg-indigo-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Speed / percent */}
      <span className="text-xs text-neutral-500 w-16 text-right tabular-nums">
        {speed ? `${speed}` : `${Math.round(percent)}%`}
      </span>

      {/* Status text */}
      <span className={`text-xs w-20 text-right ${STATUS_STYLES[status] || 'text-neutral-500'}`}>
        {status === 'downloading' && 'Downloading'}
        {status === 'queued' && 'Queued'}
        {status === 'complete' && 'Done'}
        {status === 'error' && (error || 'Failed')}
        {status === 'cancelled' && 'Cancelled'}
      </span>

      {/* Cancel button */}
      {isActive && (
        <button
          onClick={() => onCancel(item.id)}
          className="text-neutral-500 hover:text-red-400 transition-colors"
          title="Cancel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}