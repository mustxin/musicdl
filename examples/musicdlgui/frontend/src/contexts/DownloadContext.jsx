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
            ? { ...item, status: 'error', error: action.payload.message, errorCode: action.payload.error_code || 'download_failed' }
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
    case 'MARK_PAUSED': {
      // single id, or '*'-prefixed batch payload marks all active items
      const id = action.payload.task_id
      return {
        ...state,
        items: state.items.map((item) => {
          const match = item.id === id || (id === '*' && (item.status === 'downloading' || item.status === 'queued'))
          return match ? { ...item, status: 'paused' } : item
        }),
      }
    }
    case 'MARK_RESUMED': {
      const id = action.payload.task_id
      return {
        ...state,
        items: state.items.map((item) => {
          const match = item.id === id || (id === '*' && item.status === 'paused')
          return match ? { ...item, status: 'downloading' } : item
        }),
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
        dispatch({ type: 'MARK_ERROR', payload: { task_id: data.task_id || '', message: data.message, error_code: data.error_code } })
        break
      case 'cancelled':
        dispatch({ type: 'MARK_CANCELLED', payload: { task_id: data.task_id } })
        break
      case 'paused':
        dispatch({ type: 'MARK_PAUSED', payload: { task_id: data.task_id } })
        break
      case 'resumed':
        dispatch({ type: 'MARK_RESUMED', payload: { task_id: data.task_id } })
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

  // ---- per-item + batch control ----
  const pauseItem = useCallback((itemId) => {
    sendMessage({ type: 'pause', task_id: itemId })
    dispatch({ type: 'MARK_PAUSED', payload: { task_id: itemId } })
  }, [sendMessage])

  const resumeItem = useCallback((itemId) => {
    sendMessage({ type: 'resume', task_id: itemId })
    dispatch({ type: 'MARK_RESUMED', payload: { task_id: itemId } })
  }, [sendMessage])

  const cancelItem = useCallback((itemId) => {
    sendMessage({ type: 'cancel', task_id: itemId })
    dispatch({ type: 'MARK_CANCELLED', payload: { task_id: itemId } })
  }, [sendMessage])

  const pauseAll = useCallback(() => {
    // pause every active batch on the backend
    const batchIds = new Set(state.items.map(i => i.id.split('-').slice(0, -1).join('-')))
    batchIds.forEach(tid => sendMessage({ type: 'pause', task_id: tid }))
    dispatch({ type: 'MARK_PAUSED', payload: { task_id: '*' } })
  }, [sendMessage, state.items])

  const resumeAll = useCallback(() => {
    const batchIds = new Set(state.items.filter(i => i.status === 'paused').map(i => i.id.split('-').slice(0, -1).join('-')))
    batchIds.forEach(tid => sendMessage({ type: 'resume', task_id: tid }))
    dispatch({ type: 'MARK_RESUMED', payload: { task_id: '*' } })
  }, [sendMessage, state.items])

  const cancelAll = useCallback(() => {
    const batchIds = new Set(state.items
      .filter(i => i.status === 'downloading' || i.status === 'queued' || i.status === 'paused')
      .map(i => i.id.split('-').slice(0, -1).join('-')))
    batchIds.forEach(tid => sendMessage({ type: 'cancel', task_id: tid }))
    state.items.forEach(i => {
      if (i.status === 'downloading' || i.status === 'queued' || i.status === 'paused') {
        dispatch({ type: 'MARK_CANCELLED', payload: { task_id: i.id } })
      }
    })
  }, [sendMessage, state.items])

  const cancelDownload = cancelItem
  const clearCompleted = useCallback(() => dispatch({ type: 'CLEAR_COMPLETED' }), [])
  const togglePanel = useCallback(() => dispatch({ type: 'TOGGLE_PANEL' }), [])

  const activeCount = state.items.filter((i) => i.status === 'queued' || i.status === 'downloading').length
  const pausedCount = state.items.filter((i) => i.status === 'paused').length

  const value = {
    ...state,
    startDownload,
    cancelDownload,
    pauseItem,
    resumeItem,
    cancelItem,
    pauseAll,
    resumeAll,
    cancelAll,
    clearCompleted,
    togglePanel,
    activeCount,
    pausedCount,
  }

  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>
}

export function useDownloadContext() {
  const ctx = useContext(DownloadContext)
  if (!ctx) throw new Error('useDownloadContext must be used within DownloadProvider')
  return ctx
}