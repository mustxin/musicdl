import DownloadQueueBadge from './DownloadQueueBadge'

export default function Sidebar({ activePage, onPageChange }) {
  return (
    <aside className="w-48 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col p-3">
      {/* Logo */}
      <div className="mb-6 px-2">
        <h1 className="text-lg font-bold text-white tracking-tight">
          <span className="text-indigo-400">♪</span> Musicdl
        </h1>
      </div>

      {/* Search page entry */}
      <button
        onClick={() => onPageChange('search')}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
          activePage === 'search'
            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
            : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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