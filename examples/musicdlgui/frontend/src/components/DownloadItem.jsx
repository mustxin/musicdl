const STATUS_STYLES = {
  queued: 'text-neutral-400',
  downloading: 'text-indigo-400',
  paused: 'text-amber-400',
  complete: 'text-emerald-400',
  error: 'text-red-400',
  cancelled: 'text-neutral-500',
}

const formatBytes = (b) => {
  if (!b || b <= 0) return ''
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${b} B`
}

const ACTION_BTN = 'w-7 h-7 flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-100 hover:bg-midnight-700/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none'

export default function DownloadItem({ item, onPause, onResume, onCancel }) {
  const { songInfo, percent, speed, status, error, errorCode, downloadedBytes, totalBytes } = item
  const isActive = status === 'downloading' || status === 'queued'
  const isPaused = status === 'paused'
  const isComplete = status === 'complete'
  const isError = status === 'error'
  const isLinkExpired = isError && errorCode === 'link_expired'
  const isDownloading = status === 'downloading'
  const sizeText = totalBytes > 0
    ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
    : formatBytes(downloadedBytes) || (songInfo.file_size || '')

  const statusText =
    isDownloading ? 'Downloading' :
    status === 'queued' ? 'Queued' :
    isPaused ? 'Paused' :
    isComplete ? '✓ Done' :
    isError ? 'Failed' :
    status === 'cancelled' ? 'Cancelled' : ''

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

      {/* Song info + error detail line */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-200 truncate">{songInfo.song_name || 'Unknown'}</p>
        {isError ? (
          <p className="text-xs truncate mt-0.5" title={error}>
            <span className={isLinkExpired ? 'text-amber-400/90' : 'text-red-400/90'}>
              {isLinkExpired ? '⏱ ' : '⚠ '}{error || '下载失败'}
            </span>
            {isLinkExpired && (
              <span className="text-neutral-600"> · 搜索同关键词重新下载即可</span>
            )}
          </p>
        ) : (
          <p className="text-xs text-neutral-500 truncate">{songInfo.singers || ''}</p>
        )}
      </div>

      {/* Progress bar + size/speed line under it */}
      <div className="w-40 flex-shrink-0">
        <div className="h-1.5 bg-midnight-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isComplete ? 'bg-emerald-500' :
              isPaused ? 'bg-amber-500' :
              isError ? (isLinkExpired ? 'bg-amber-500' : 'bg-red-500') :
              status === 'cancelled' ? 'bg-midnight-600' :
              'bg-indigo-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {/* size + speed on one line, speed only while downloading */}
        <p className="text-[10px] text-neutral-500 text-right tabular-nums mt-1 truncate">
          {sizeText || `${Math.round(percent)}%`}
          {isDownloading && speed && (
            <span className="text-indigo-400/80 ml-1.5">{speed}</span>
          )}
        </p>
      </div>

      {/* Status text */}
      <span className={`text-xs w-20 text-right ${STATUS_STYLES[status] || 'text-neutral-500'}`}>
        {statusText}
      </span>

      {/* Per-item actions: pause / resume / cancel */}
      <div className="flex items-center gap-1 w-24 justify-end">
        {(isActive || isPaused) && (
          <>
            {isActive && (
              <button
                onClick={() => onPause(item.id)}
                className={ACTION_BTN}
                title="Pause"
                aria-label={`Pause ${songInfo.song_name || 'download'}`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
                </svg>
              </button>
            )}
            {isPaused && (
              <button
                onClick={() => onResume(item.id)}
                className={ACTION_BTN}
                title="Resume"
                aria-label={`Resume ${songInfo.song_name || 'download'}`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 4l14 8-14 8z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => onCancel(item.id)}
              className={`${ACTION_BTN} hover:text-red-400`}
              title="Cancel"
              aria-label={`Cancel ${songInfo.song_name || 'download'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}