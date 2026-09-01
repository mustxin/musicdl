import { useState } from 'react'
import { SearchProvider } from './contexts/SearchContext'
import { DownloadProvider } from './contexts/DownloadContext'
import Sidebar from './components/Sidebar'
import SearchBar from './components/SearchBar'
import ResultGrid from './components/ResultGrid'
import DownloadPanel from './components/DownloadPanel'

function AppInner() {
  const [activePage, setActivePage] = useState('search')

  return (
    <div className="h-screen flex bg-neutral-950">
      {/* Sidebar */}
      <Sidebar activePage={activePage} onPageChange={setActivePage} />

      {/* Main content — switches between search and downloads */}
      <main className="flex-1 flex flex-col min-w-0 p-6">
        {activePage === 'search' ? (
          <>
            <SearchBar />
            <div className="mt-6 flex-1 flex flex-col min-h-0">
              <ResultGrid />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <DownloadPanel />
          </div>
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