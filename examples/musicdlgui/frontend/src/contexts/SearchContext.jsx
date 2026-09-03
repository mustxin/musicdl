import { createContext, useContext, useReducer, useCallback } from 'react'

const SearchContext = createContext(null)

const STORAGE_KEY = 'musicdl_sources'

const DEFAULT_SOURCES = {
  MiguMusicClient: { enabled: true, label: 'Migu', short: 'Migu' },
  NeteaseMusicClient: { enabled: true, label: 'Netease', short: 'Netease' },
  QQMusicClient: { enabled: true, label: 'QQ Music', short: 'QQ' },
  KuwoMusicClient: { enabled: true, label: 'Kuwo', short: 'Kuwo' },
  QianqianMusicClient: { enabled: true, label: 'Qianqian', short: 'Qianqian' },
}

function loadSources() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      const merged = { ...DEFAULT_SOURCES }
      for (const [key, val] of Object.entries(parsed)) {
        if (merged[key]) merged[key] = { ...merged[key], enabled: val.enabled }
      }
      return merged
    }
  } catch {}
  return { ...DEFAULT_SOURCES }
}

function saveSources(sources) {
  try {
    const slim = {}
    for (const [k, v] of Object.entries(sources)) slim[k] = { enabled: v.enabled }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
  } catch {}
}

const initialState = {
  keyword: '',
  status: 'idle',
  results: [],
  sources: loadSources(),
  sourceStatus: {},  // { 'MiguMusicClient': 'pending'|'searching'|'done'|'error' }
  // Navigation: stack of completed searches, pointer to current entry
  historyStack: [],   // [{ keyword, results, sourceStatus }]
  historyIndex: -1,
}

function searchReducer(state, action) {
  switch (action.type) {
    case 'SET_KEYWORD':
      return { ...state, keyword: action.payload }
    case 'SET_STATUS':
      return { ...state, status: action.payload }
    case 'APPEND_RESULT':
      return { ...state, results: [...state.results, action.payload] }
    case 'CLEAR_RESULTS':
      return { ...state, results: [] }
    case 'SET_SOURCE_STATUS':
      return {
        ...state,
        sourceStatus: {
          ...state.sourceStatus,
          [action.payload.source]: action.payload.status,
        },
      }
    case 'INIT_SOURCE_STATUS': {
      const statuses = {}
      for (const s of action.payload) {
        statuses[s] = 'searching'
      }
      return { ...state, sourceStatus: statuses }
    }
    case 'TOGGLE_SOURCE': {
      const name = action.payload
      const updated = {
        ...state.sources,
        [name]: {
          ...state.sources[name],
          enabled: !state.sources[name].enabled,
        },
      }
      saveSources(updated)
      return { ...state, sources: updated }
    }
    case 'SET_ALL_SOURCES': {
      const updated = {}
      for (const k of Object.keys(state.sources)) {
        updated[k] = { ...state.sources[k], enabled: action.payload }
      }
      saveSources(updated)
      return { ...state, sources: updated }
    }
    case 'PUSH_HISTORY': {
      // Truncate forward entries, push new completed search
      const stack = [...state.historyStack.slice(0, state.historyIndex + 1), action.payload]
      return { ...state, historyStack: stack, historyIndex: stack.length - 1 }
    }
    case 'NAV_BACK': {
      if (state.historyIndex <= 0) return state
      const idx = state.historyIndex - 1
      const entry = state.historyStack[idx]
      return {
        ...state,
        historyIndex: idx,
        keyword: entry.keyword,
        results: entry.results,
        sourceStatus: entry.sourceStatus,
        status: 'done',
      }
    }
    case 'NAV_FORWARD': {
      if (state.historyIndex >= state.historyStack.length - 1) return state
      const idx = state.historyIndex + 1
      const entry = state.historyStack[idx]
      return {
        ...state,
        historyIndex: idx,
        keyword: entry.keyword,
        results: entry.results,
        sourceStatus: entry.sourceStatus,
        status: 'done',
      }
    }
    case 'RESET':
      return { ...initialState, sources: state.sources }
    default:
      return state
  }
}

export function SearchProvider({ children }) {
  const [state, dispatch] = useReducer(searchReducer, initialState)

  const setKeyword = useCallback((kw) => dispatch({ type: 'SET_KEYWORD', payload: kw }), [])
  const setStatus = useCallback((s) => dispatch({ type: 'SET_STATUS', payload: s }), [])
  const appendResult = useCallback((r) => dispatch({ type: 'APPEND_RESULT', payload: r }), [])
  const clearResults = useCallback(() => dispatch({ type: 'CLEAR_RESULTS' }), [])
  const setSourceStatus = useCallback((source, status) => dispatch({ type: 'SET_SOURCE_STATUS', payload: { source, status } }), [])
  const initSourceStatus = useCallback((sources) => dispatch({ type: 'INIT_SOURCE_STATUS', payload: sources }), [])
  const toggleSource = useCallback((name) => dispatch({ type: 'TOGGLE_SOURCE', payload: name }), [])
  const toggleAllSources = useCallback((enabled) => dispatch({ type: 'SET_ALL_SOURCES', payload: enabled }), [])
  const resetSearch = useCallback(() => dispatch({ type: 'RESET' }), [])
  const pushHistory = useCallback((entry) => dispatch({ type: 'PUSH_HISTORY', payload: entry }), [])
  const navBack = useCallback(() => dispatch({ type: 'NAV_BACK' }), [])
  const navForward = useCallback(() => dispatch({ type: 'NAV_FORWARD' }), [])

  const value = {
    ...state,
    setKeyword,
    setStatus,
    appendResult,
    clearResults,
    setSourceStatus,
    initSourceStatus,
    toggleSource,
    toggleAllSources,
    resetSearch,
    pushHistory,
    navBack,
    navForward,
  }

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearchContext() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearchContext must be used within SearchProvider')
  return ctx
}