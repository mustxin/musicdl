import { createContext, useContext, useReducer, useCallback } from 'react'
import useWebSocket from '../hooks/useWebSocket'

const DownloadContext = createContext(null)

const WS_HOST = window.location.hostname || '127.0.0.1'
const WS_URL = `ws://${WS_HOST}:8765/ws/download`

const initialState = {
  items: [],
  panelExpanded: false,
}

function downloadReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEMS': {
      const { taskId, songInfos } = action.payload
      const newItems = songInfos.map((si, i) => ({
        id: `${taskId}-${i}`,
        songInfo: si,
        percent: 0,
        speed: '',
        status: 'queued',
      }))
      return { ...state, items: [...state.items, ...newItems], panelExpanded: true }
    }
    case 'UPDATE_PROGRESS': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.task_id &&
          item.status !== 'complete' && item.status !== 'error' && item.status !== 'cancelled'
            ? {
                ...item,
                percent: action.payload.percent,
                speed: action.payload.speed || item.speed,
                downloadedBytes: action.payload.downloaded_bytes ?? item.downloadedBytes,
                totalBytes: action.payload.total_bytes ?? item.totalBytes,
                status: 'downloading',
              }
            : item
        ),
      }
    }
    case 'MARK_COMPLETE': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.task_id
            ? { ...item, percent: 100, status: 'complete' }
            : item
        ),
      }
    }
    case 'MARK_ERROR': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.task_id
            ? { ...item, status: 'error', error: action.payload.message }
            : item
        ),
      }
    }
    case 'MARK_CANCELLED': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.task_id
            ? { ...item, status: 'cancelled' }
            : item
        ),
      }
    }
    case 'CLEAR_COMPLETED': {
      return {
        ...state,
        items: state.items.filter((item) => item.status !== 'complete' && item.status !== 'cancelled'),
      }
    }
    case 'TOGGLE_PANEL':
      return { ...state, panelExpanded: !state.panelExpanded }
    default:
      return state
  }
}

export function DownloadProvider({ children }) {
  const [state, dispatch] = useReducer(downloadReducer, initialState)

  // The download WebSocket lives HERE in the provider (never unmounts).
  // Previously it lived in useDownload() called from ResultGrid — which
  // unmounts when the user switches to the Downloads page, killing the
  // connection mid-download and freezing progress at 0%.
  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'progress':
        dispatch({ type: 'UPDATE_PROGRESS', payload: { task_id: data.task_id, song_name: data.song_name, percent: data.percent, speed: data.speed } })
        break
      case 'complete':
        dispatch({ type: 'MARK_COMPLETE', payload: { task_id: data.task_id } })
        break
      case 'error':
        dispatch({ type: 'MARK_ERROR', payload: { task_id: data.task_id || '', message: data.message } })
        break
      case 'cancelled':
        dispatch({ type: 'MARK_CANCELLED', payload: { task_id: data.task_id } })
        break
    }
  }, [])

  const { sendMessage, connect: wsConnect } = useWebSocket(WS_URL, handleMessage)

  const startDownload = useCallback((songInfos) => {
    const taskId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    dispatch({ type: 'ADD_ITEMS', payload: { taskId, songInfos } })
    wsConnect()
    sendMessage({
      type: 'download',
      task_id: taskId,
      song_infos: songInfos,
    })
  }, [wsConnect, sendMessage])

  const cancelDownload = useCallback((taskId) => {
    sendMessage({ type: 'cancel', task_id: taskId })
    dispatch({ type: 'MARK_CANCELLED', payload: { task_id: taskId } })
  }, [sendMessage])

  const clearCompleted = useCallback(() => dispatch({ type: 'CLEAR_COMPLETED' }), [])
  const togglePanel = useCallback(() => dispatch({ type: 'TOGGLE_PANEL' }), [])

  const activeCount = state.items.filter((i) => i.status === 'queued' || i.status === 'downloading').length

  const value = {
    ...state,
    startDownload,
    cancelDownload,
    clearCompleted,
    togglePanel,
    activeCount,
  }

  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>
}

export function useDownloadContext() {
  const ctx = useContext(DownloadContext)
  if (!ctx) throw new Error('useDownloadContext must be used within DownloadProvider')
  return ctx
}