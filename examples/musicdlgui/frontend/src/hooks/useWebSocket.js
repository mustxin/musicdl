import { useRef, useState, useCallback, useEffect } from 'react'

const WS_READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}

/**
 * Generic WebSocket hook with auto-reconnect.
 * @param {string} url - WebSocket endpoint URL
 * @returns {{ sendMessage: Function, lastMessage: object|null, readyState: number, connect: Function, disconnect: Function }}
 */
export default function useWebSocket(url) {
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const pendingMessages = useRef([])
  const [lastMessage, setLastMessage] = useState(null)
  const [readyState, setReadyState] = useState(WS_READY_STATES.CLOSED)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return

    pendingMessages.current = []
    const ws = new WebSocket(url)
    wsRef.current = ws
    setReadyState(WS_READY_STATES.CONNECTING)

    ws.onopen = () => {
      setReadyState(WS_READY_STATES.OPEN)
      // Flush any queued messages
      const queued = pendingMessages.current
      pendingMessages.current = []
      for (const msg of queued) {
        ws.send(JSON.stringify(msg))
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLastMessage(data)
      } catch {
        setLastMessage({ type: 'raw', data: event.data })
      }
    }

    ws.onclose = () => {
      setReadyState(WS_READY_STATES.CLOSED)
      reconnectTimer.current = setTimeout(() => connect(), 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [url])

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current)
    wsRef.current?.close()
    setReadyState(WS_READY_STATES.CLOSED)
  }, [])

  const sendMessage = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    } else {
      // Buffer message — will be flushed when connection opens
      pendingMessages.current.push(msg)
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [])

  return { sendMessage, lastMessage, readyState, connect, disconnect }
}