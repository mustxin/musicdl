import { useCallback, useEffect, useRef } from 'react'
import { useSearchContext } from '../contexts/SearchContext'
import useWebSocket from './useWebSocket'

const WS_HOST = window.location.hostname || '127.0.0.1'
const WS_URL = `ws://${WS_HOST}:8765/ws/search`

/**
 * Hook that wires the SearchContext to the WebSocket backend.
 * Call startSearch() to begin a search; results arrive via context.
 */
export default function useSearch() {
  const ctx = useSearchContext()
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx

  // Process incoming WebSocket messages via callback (avoids React 18 batching issues)
  const handleMessage = useCallback((data) => {
    const c = ctxRef.current
    switch (data.type) {
      case 'result':
        c.appendResult(data.song_info)
        break
      case 'source_done':
        break
      case 'search_done':
        c.setStatus('done')
        break
      case 'error':
        console.error('Search error:', data.message)
        c.setStatus('done')
        break
    }
  }, [])

  const { sendMessage, readyState, connect: wsConnect } = useWebSocket(WS_URL, handleMessage)
  const activeSources = Object.entries(ctx.sources)
    .filter(([, v]) => v.enabled)
    .map(([k]) => k)

  // If connection fails while searching, stop spinner
  useEffect(() => {
    if (readyState === 3 && ctx.status === 'searching') {
      ctx.setStatus('done')
    }
  }, [readyState, ctx.status])

  const startSearch = () => {
    if (!ctx.keyword.trim()) return
    ctx.clearResults()
    ctx.setStatus('searching')
    wsConnect()
    sendMessage({
      type: 'search',
      keyword: ctx.keyword,
      sources: activeSources,
    })
  }

  return { ...ctx, activeSources, startSearch, wsReadyState: readyState }
}