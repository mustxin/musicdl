import { useState, useEffect, useRef, useCallback } from 'react'

const API_HOST = `http://${window.location.hostname || '127.0.0.1'}:8765`

const SOURCE_SHORT = {
  MiguMusicClient: 'Migu', NeteaseMusicClient: 'Netease', QQMusicClient: 'QQ',
  KuwoMusicClient: 'Kuwo', QianqianMusicClient: 'Qianqian', KugouMusicClient: 'Kugou',
}

export default function SearchHistory({ onSelect, visible }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_HOST}/history`)
      const data = await res.json()
      setItems(data)
    } catch {
      // ignore fetch errors
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (visible) {
      fetchHistory()
    }
  }, [visible, fetchHistory])

  const clearHistory = async () => {
    try {
      await fetch(`${API_HOST}/history`, { method: 'DELETE' })
      setItems([])
    } catch {
      // ignore
    }
  }

  if (!visible) return null

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-midnight-900 border border-midnight-700 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
      {loading ? (
        <div className="px-4 py-6 text-center">
          <svg className="animate-spin w-4 h-4 text-neutral-500 mx-auto" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-neutral-500">No search history</p>
        </div>
      ) : (
        <>
          <div className="max-h-64 overflow-y-auto">
            {items.map((item, idx) => (
              <button
                key={`${item.keyword}-${idx}`}
                onClick={() => onSelect(item.keyword)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-midnight-800 transition-colors text-left cursor-pointer"
              >
                <svg className="w-4 h-4 text-neutral-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-200 truncate">{item.keyword}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(item.sources || []).slice(0, 3).map(s => (
                      <span key={s} className="text-[10px] text-neutral-600">
                        {SOURCE_SHORT[s] || s.replace('MusicClient', '')}
                      </span>
                    ))}
                    {item.timestamp && (
                      <span className="text-[10px] text-neutral-600">{item.timestamp}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {/* Clear button */}
          <div className="border-t border-midnight-800 px-4 py-2">
            <button
              onClick={clearHistory}
              className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
            >
              Clear history
            </button>
          </div>
        </>
      )}
    </div>
  )
}