import { useCallback, useRef } from 'react'
import { useDownloadContext } from '../contexts/DownloadContext'
import useWebSocket from './useWebSocket'

const WS_HOST = window.location.hostname || '127.0.0.1'
const WS_URL = `ws://${WS_HOST}:8765/ws/download`

/**
 * Hook that wires the DownloadContext to the WebSocket backend.
 */
export default function useDownload() {
  const ctx = useDownloadContext()
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx

  // Process incoming messages via callback (avoids React 18 batching issues)
  const handleMessage = useCallback((data) => {
    const c = ctxRef.current
    switch (data.type) {
      case 'task_created':
        c.assignTaskId(data.task_id, data.source)
        break
      case 'progress':
        c.updateProgress(
          data.task_id,
          data.song_name,
          data.percent,
          data.speed
        )
        break
      case 'complete':
        c.markComplete(data.task_id)
        break
      case 'error':
        c.markError(data.task_id || '', data.message)
        break
      case 'cancelled':
        c.markCancelled(data.task_id)
        break
    }
  }, [])

  const { sendMessage, connect: wsConnect } = useWebSocket(WS_URL, handleMessage)

  const startDownload = (songInfos) => {
    ctx.addItems(songInfos)
    wsConnect()
    sendMessage({
      type: 'download',
      song_infos: songInfos,
    })
  }

  const cancelDownload = (taskId) => {
    sendMessage({ type: 'cancel', task_id: taskId })
    ctx.markCancelled(taskId)
  }

  return { ...ctx, startDownload, cancelDownload }
}