import { useSearchContext } from '../contexts/SearchContext'

export default function SourceList() {
  const { sources, toggleSource } = useSearchContext()

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-2">
        Sources
      </h3>
      {Object.entries(sources).map(([name, cfg]) => (
        <button
          key={name}
          onClick={() => toggleSource(name)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
            cfg.enabled
              ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 border border-transparent'
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                cfg.enabled ? 'bg-indigo-400' : 'bg-neutral-600'
              }`}
            />
            {cfg.label}
          </span>
        </button>
      ))}
    </div>
  )
}