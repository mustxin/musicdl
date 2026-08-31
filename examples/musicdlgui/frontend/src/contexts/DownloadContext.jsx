import { createContext, useContext, useReducer, useCallback } from 'react'

const DownloadContext = createContext(null)

const initialState = {
  items: [],
  panelExpanded: false,
}

function downloadReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEMS': {
      const newItems = action.payload.map((si, i) => ({
        id: `${Date.now()}-${i}`,
        songInfo: si,
        percent: 0,
        speed: '',
        status: 'queued',
      }))
      return { ...state, items: [...state.items, ...newItems], panelExpanded: true }
    }
    case 'ASSIGN_TASK_ID': {
      const { task_id, source } = action.payload
      return {
        ...state,
        items: state.items.map((item) =>
          item.status === 'queued' && (!source || item.songInfo?.source === source)
            ? { ...item, id: task_id }
            : item
        ),
      }
    }
    case 'UPDATE_PROGRESS': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.task_id || item.songInfo?.song_name === action.payload.song_name
            ? { ...item, percent: action.payload.percent, speed: action.payload.speed || item.speed, status: 'downloading' }
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

  const addItems = useCallback((songInfos) => dispatch({ type: 'ADD_ITEMS', payload: songInfos }), [])
  const assignTaskId = useCallback((taskId, source) =>
    dispatch({ type: 'ASSIGN_TASK_ID', payload: { task_id: taskId, source } }), [])
  const updateProgress = useCallback((taskId, songName, percent, speed) =>
    dispatch({ type: 'UPDATE_PROGRESS', payload: { task_id: taskId, song_name: songName, percent, speed } }), [])
  const markComplete = useCallback((taskId) => dispatch({ type: 'MARK_COMPLETE', payload: { task_id: taskId } }), [])
  const markError = useCallback((taskId, message) => dispatch({ type: 'MARK_ERROR', payload: { task_id: taskId, message } }), [])
  const markCancelled = useCallback((taskId) => dispatch({ type: 'MARK_CANCELLED', payload: { task_id: taskId } }), [])
  const clearCompleted = useCallback(() => dispatch({ type: 'CLEAR_COMPLETED' }), [])
  const togglePanel = useCallback(() => dispatch({ type: 'TOGGLE_PANEL' }), [])

  const activeCount = state.items.filter((i) => i.status === 'queued' || i.status === 'downloading').length

  const value = {
    ...state,
    addItems,
    assignTaskId,
    updateProgress,
    markComplete,
    markError,
    markCancelled,
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