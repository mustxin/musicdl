import { createContext, useContext, useReducer, useCallback } from 'react'

const SearchContext = createContext(null)

const DEFAULT_SOURCES = {
  MiguMusicClient: { enabled: true, label: 'Migu', short: 'Migu' },
  NeteaseMusicClient: { enabled: true, label: 'Netease', short: 'Netease' },
  QQMusicClient: { enabled: true, label: 'QQ Music', short: 'QQ' },
  KuwoMusicClient: { enabled: true, label: 'Kuwo', short: 'Kuwo' },
  QianqianMusicClient: { enabled: true, label: 'Qianqian', short: 'Qianqian' },
}

const initialState = {
  keyword: '',
  status: 'idle',
  results: [],
  sources: { ...DEFAULT_SOURCES },
  sourceStatus: {},  // { 'MiguMusicClient': 'pending'|'searching'|'done'|'error' }
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
      return {
        ...state,
        sources: {
          ...state.sources,
          [name]: {
            ...state.sources[name],
            enabled: !state.sources[name].enabled,
          },
        },
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
  const resetSearch = useCallback(() => dispatch({ type: 'RESET' }), [])

  const value = {
    ...state,
    setKeyword,
    setStatus,
    appendResult,
    clearResults,
    setSourceStatus,
    initSourceStatus,
    toggleSource,
    resetSearch,
  }

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearchContext() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearchContext must be used within SearchProvider')
  return ctx
}