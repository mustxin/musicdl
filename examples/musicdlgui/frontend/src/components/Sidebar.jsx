import SourceList from './SourceList'
import DownloadQueueBadge from './DownloadQueueBadge'

export default function Sidebar() {
  return (
    <aside className="w-56 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col p-4">
      {/* Logo */}
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold text-white tracking-tight">
          <span className="text-indigo-400">♪</span> Musicdl
        </h1>
      </div>

      {/* Source list */}
      <SourceList />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Download queue badge */}
      <DownloadQueueBadge />
    </aside>
  )
}