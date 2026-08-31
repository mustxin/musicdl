import { useEffect } from 'react'
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
  const { sendMessage, lastMessage, readyState, connect: wsConnect } = useWebSocket(WS_URL)
  const activeSources = Object.entries(ctx.sources)
    .filter(([, v]) => v.enabled)
    .map(([k]) => k)

  // Process incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return
    switch (lastMessage.type) {
      case 'result':
        ctx.appendResult(lastMessage.song_info)
        break
      case 'source_done':
        break
      case 'search_done':
        ctx.setStatus('done')
        break
      case 'error':
        console.error('Search error:', lastMessage.message)
        break
    }
  }, [lastMessage])

  const startSearch = () => {
    if (!ctx.keyword.trim()) return
    ctx.clearResults()
    ctx.setStatus('searching')
    wsConnect()
    setTimeout(() => {
      sendMessage({
        type: 'search',
        keyword: ctx.keyword,
        sources: activeSources,
      })
    }, 200)
  }

  return { ...ctx, activeSources, startSearch, wsReadyState: readyState }
}