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
        c.setSourceStatus(data.source, 'done')
        break
      case 'search_done':
        c.setStatus('done')
        break
      case 'error':
        console.error('Search error:', data.message)
        if (data.source) {
          c.setSourceStatus(data.source, 'error')
        }
        break
    }
  }, [])

  const { sendMessage, readyState, connect: wsConnect } = useWebSocket(WS_URL, handleMessage)
  const activeSources = Object.entries(ctx.sources)
    .filter(([, v]) => v.enabled)
    .map(([k]) => k)

  // Fallback: stop the spinner only when THIS instance's connection actually
  // dropped mid-search (readyState transitioned INTO closed). A never-connected
  // instance (e.g. ResultGrid's, which statically holds readyState=3) must not
  // kill the searching state.
  const prevReadyStateRef = useRef(readyState)
  useEffect(() => {
    const wasConnected = prevReadyStateRef.current !== 3
    prevReadyStateRef.current = readyState
    if (wasConnected && readyState === 3 && ctx.status === 'searching') {
      ctx.setStatus('done')
    }
  }, [readyState, ctx.status])

  const startSearch = (historyKeyword) => {
    const kw = historyKeyword || ctx.keyword
    if (!kw.trim()) return
    if (!historyKeyword) {
      ctx.setKeyword(kw)
    }
    ctx.clearResults()
    ctx.initSourceStatus(activeSources)
    ctx.setStatus('searching')
    wsConnect()
    sendMessage({
      type: 'search',
      keyword: kw,
      sources: activeSources,
    })
  }

  return { ...ctx, activeSources, startSearch, wsReadyState: readyState }
}