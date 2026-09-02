import DownloadQueueBadge from './DownloadQueueBadge'

export default function Sidebar({ activePage, onPageChange }) {
  return (
    <aside className="w-48 h-full bg-midnight-900/60 border-r border-midnight-800 flex flex-col p-3">
      {/* Logo */}
      <div className="mb-6 px-3 pt-1">
        <h1 className="text-lg font-bold text-white tracking-tight">
          <span className="text-indigo-400" aria-hidden="true">♪</span> Musicdl
        </h1>
      </div>

      {/* Search page entry */}
      <button
        onClick={() => onPageChange('search')}
        className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-1 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${
          activePage === 'search'
            ? 'bg-indigo-500/10 text-indigo-300'
            : 'text-neutral-400 hover:text-neutral-200 hover:bg-midnight-800/60'
        }`}
      >
        {activePage === 'search' && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-indigo-400" aria-hidden="true" />
        )}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Search
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Downloads page entry */}
      <DownloadQueueBadge activePage={activePage} onPageChange={onPageChange} />
    </aside>
  )
}