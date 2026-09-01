import { useState, useRef, useEffect } from 'react'
import { useSearchContext } from '../contexts/SearchContext'

export default function SourceDropdown() {
  const { sources, toggleSource } = useSearchContext()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const enabledCount = Object.values(sources).filter(v => v.enabled).length

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Sources
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
            {enabledCount}
          </span>
          <svg className={`w-3 h-3 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {Object.entries(sources).map(([name, cfg]) => (
            <label
              key={name}
              className="flex items-center justify-between px-3 py-2.5 hover:bg-neutral-700/50 cursor-pointer transition-colors"
            >
              <span className="text-sm text-neutral-300 select-none">{cfg.label}</span>
              {/* Toggle switch */}
              <button
                onClick={(e) => { e.preventDefault(); toggleSource(name) }}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                  cfg.enabled ? 'bg-indigo-500' : 'bg-neutral-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    cfg.enabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}