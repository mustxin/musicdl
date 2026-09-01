import { useDownloadContext } from '../contexts/DownloadContext'

export default function DownloadQueueBadge({ activePage, onPageChange }) {
  const { activeCount } = useDownloadContext()

  return (
    <button
      onClick={() => onPageChange('downloads')}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        activePage === 'downloads'
          ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
      }`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span>Downloads</span>
      {activeCount > 0 && (
        <span className="ml-auto bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {activeCount}
        </span>
      )}
    </button>
  )
}