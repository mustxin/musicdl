import { useState, useRef, useEffect, useCallback } from 'react'

const API_HOST = `http://${window.location.hostname || '127.0.0.1'}:8765`

export default function DownloadSettings() {
  const [open, setOpen] = useState(false)
  const [dir, setDir] = useState('')
  const [isDefault, setIsDefault] = useState(true)
  const [manualPath, setManualPath] = useState('')
  const [toast, setToast] = useState('')   // transient feedback
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  const fetchDir = useCallback(async () => {
    try {
      const res = await fetch(`${API_HOST}/settings/download-dir`)
      const data = await res.json()
      setDir(data.path || '')
      setIsDefault(!!data.is_default)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchDir() }, [fetchDir])

  // close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const pickFolder = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API_HOST}/settings/pick-folder`)
      const data = await res.json()
      if (data.ok && data.path) {
        setManualPath(data.path)
      } else if (data.error && data.error !== 'cancelled') {
        setToast(`选择器不可用（${data.error}），请手动输入路径`)
      }
    } catch {
      setToast('无法打开文件夹选择器，请手动输入路径')
    } finally {
      setBusy(false)
    }
  }

  const applyDir = async () => {
    const path = manualPath.trim()
    if (!path) return
    setBusy(true)
    try {
      const res = await fetch(`${API_HOST}/settings/download-dir`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      const data = await res.json()
      if (data.ok) {
        setDir(data.path)
        setIsDefault(false)
        setManualPath('')
        setToast('下载目录已更新')
      } else {
        setToast(`设置失败：${data.error}`)
      }
    } catch {
      setToast('设置失败：后端无响应')
    } finally {
      setBusy(false)
    }
  }

  const resetDir = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API_HOST}/settings/download-dir`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        setDir(data.path)
        setIsDefault(true)
        setManualPath('')
        setToast('已恢复默认目录')
      }
    } catch { /* ignore */ }
    finally { setBusy(false) }
  }

  const cleanCache = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API_HOST}/settings/clean-cache`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        const parts = [`已清理 ${data.removed} 个缓存/空文件`]
        if (data.removed_dirs > 0) parts.push(`${data.removed_dirs} 个空目录`)
        if (data.freed_bytes > 0) parts.push(`释放 ${data.freed_text}`)
        setToast(parts.join('，'))
      } else {
        setToast('清理失败')
      }
    } catch {
      setToast('清理失败：后端无响应')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs text-neutral-400 hover:text-neutral-100 bg-midnight-800/80 hover:bg-midnight-800 border border-transparent hover:border-midnight-700 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Download settings"
        title="Settings"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Settings
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-midnight-900 border border-midnight-700 rounded-xl shadow-2xl shadow-black/50 z-50 p-4">
          {/* download directory */}
          <p className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">下载目录</p>
          <p className="text-xs text-neutral-500 mt-1.5 break-all" title={dir}>{dir}</p>
          {isDefault && <p className="text-[10px] text-neutral-600 mt-0.5">（默认）</p>}

          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder="输入或选择新目录路径…"
              aria-label="New download directory"
              className="flex-1 h-8 px-3 text-xs bg-midnight-800 border border-midnight-700 focus:border-midnight-600 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-colors min-w-0"
            />
            <button
              onClick={pickFolder}
              disabled={busy}
              className="h-8 px-3 text-xs bg-midnight-800 hover:bg-midnight-700 text-neutral-300 rounded-lg border border-midnight-700 hover:border-midnight-600 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
              title="浏览选择文件夹"
            >
              浏览…
            </button>
            <button
              onClick={applyDir}
              disabled={busy || !manualPath.trim()}
              className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-midnight-800 disabled:opacity-30 text-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              应用
            </button>
          </div>

          {!isDefault && (
            <button
              onClick={resetDir}
              disabled={busy}
              className="mt-2 text-[11px] text-neutral-500 hover:text-neutral-300 cursor-pointer transition-colors"
            >
              恢复默认目录
            </button>
          )}

          <div className="border-t border-midnight-800 my-3" />

          {/* cache cleanup */}
          <p className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">缓存清理</p>
          <p className="text-xs text-neutral-500 mt-1.5 leading-5">
            清除下载目录下的 .pkl 缓存、0 字节残留音频文件及空目录，不影响正常音频文件。
          </p>
          <button
            onClick={cleanCache}
            disabled={busy}
            className="mt-3 h-8 px-3 text-xs bg-midnight-800 hover:bg-midnight-700 text-neutral-300 rounded-lg border border-midnight-700 hover:border-midnight-600 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-9V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            清理缓存文件
          </button>

          {toast && (
            <p className="mt-3 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2" role="status">
              {toast}
            </p>
          )}
        </div>
      )}
    </div>
  )
}