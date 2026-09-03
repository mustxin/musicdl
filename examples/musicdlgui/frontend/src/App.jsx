import { useState } from 'react'
import { SearchProvider } from './contexts/SearchContext'
import { DownloadProvider } from './contexts/DownloadContext'
import SearchBar from './components/SearchBar'
import ResultGrid from './components/ResultGrid'
import DownloadPanel from './components/DownloadPanel'
import DownloadNavTab from './components/DownloadNavTab'

function AppInner() {
  const [activePage, setActivePage] = useState('search')

  return (
    <div className="h-screen flex flex-col bg-midnight-950">
      {/* Thunder-style top toolbar: logo + centered search + download tab */}
      <header className="flex items-center gap-6 px-6 h-16 bg-midnight-900/60 border-b border-midnight-800 flex-shrink-0">
        {/* Logo */}
        <h1 className="text-lg font-bold text-white tracking-tight whitespace-nowrap">
          <span className="text-indigo-400" aria-hidden="true">♪</span> Musicdl
        </h1>

        {/* Search bar — persistent, top-centered */}
        <div className="flex-1 flex justify-center min-w-0">
          <div className="w-2/3 min-w-0">
            <SearchBar />
          </div>
        </div>

        {/* Download tab */}
        <DownloadNavTab activePage={activePage} onPageChange={setActivePage} />
      </header>

      {/* Main content — search results or download list */}
      <main className="flex-1 flex flex-col min-h-0 px-6 py-6">
        {activePage === 'search' ? (
          <ResultGrid />
        ) : (
          <DownloadPanel onGoSearch={() => {
            setActivePage('search')
            // Focus the search input after the page switch renders
            setTimeout(() => window.dispatchEvent(new Event('musicdl:focus-search')), 0)
          }} />
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <DownloadProvider>
      <SearchProvider>
        <AppInner />
      </SearchProvider>
    </DownloadProvider>
  )
}