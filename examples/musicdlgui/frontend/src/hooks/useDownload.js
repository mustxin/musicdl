import { useEffect } from 'react'
import { useDownloadContext } from '../contexts/DownloadContext'
import useWebSocket from './useWebSocket'

const WS_URL = `ws://${window.location.hostname}:8765/ws/download`

/**
 * Hook that wires the DownloadContext to the WebSocket backend.
 */
export default function useDownload() {
  const ctx = useDownloadContext()
  const { sendMessage, lastMessage, connect: wsConnect } = useWebSocket(WS_URL)

  // Process incoming messages
  useEffect(() => {
    if (!lastMessage) return
    switch (lastMessage.type) {
      case 'progress':
        ctx.updateProgress(
          lastMessage.task_id,
          lastMessage.song_name,
          lastMessage.percent,
          lastMessage.speed
        )
        break
      case 'complete':
        ctx.markComplete(lastMessage.task_id)
        break
      case 'error':
        ctx.markError(lastMessage.task_id || '', lastMessage.message)
        break
      case 'cancelled':
        ctx.markCancelled(lastMessage.task_id)
        break
    }
  }, [lastMessage])

  const startDownload = (songInfos) => {
    ctx.addItems(songInfos)
    wsConnect()
    setTimeout(() => {
      sendMessage({
        type: 'download',
        song_infos: songInfos,
      })
    }, 200)
  }

  const cancelDownload = (taskId) => {
    sendMessage({ type: 'cancel', task_id: taskId })
    ctx.markCancelled(taskId)
  }

  return { ...ctx, startDownload, cancelDownload }
}