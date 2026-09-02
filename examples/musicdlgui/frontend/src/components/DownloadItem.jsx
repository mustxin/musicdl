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
  const isComplete = status === 'complete'

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-midnight-900/80 transition-colors">
      {/* Cover thumbnail */}
      <div className="w-12 h-12 rounded-lg bg-midnight-800 overflow-hidden flex-shrink-0">
        {songInfo.cover_url ? (
          <img
            src={songInfo.cover_url}
            alt={songInfo.song_name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-midnight-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-200 truncate">{songInfo.song_name || 'Unknown'}</p>
        <p className="text-xs text-neutral-500 truncate">{songInfo.singers || ''}</p>
      </div>

      {/* Progress bar */}
      <div className="w-32">
        <div className="h-1.5 bg-midnight-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isComplete ? 'bg-emerald-500' :
              status === 'error' ? 'bg-red-500' :
              status === 'cancelled' ? 'bg-midnight-600' :
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
        {isComplete && '✓ Done'}
        {status === 'error' && (error || 'Failed')}
        {status === 'cancelled' && 'Cancelled'}
      </span>

      {/* Cancel button */}
      {isActive ? (
        <button
          onClick={() => onCancel(item.id)}
          className="text-neutral-500 hover:text-red-400 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none rounded"
          title="Cancel"
          aria-label={`Cancel ${songInfo.song_name || 'download'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : (
        <span className="w-4" />
      )}
    </div>
  )
}