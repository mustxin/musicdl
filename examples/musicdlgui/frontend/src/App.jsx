import { SearchProvider } from './contexts/SearchContext'
import { DownloadProvider } from './contexts/DownloadContext'
import Sidebar from './components/Sidebar'
import SearchBar from './components/SearchBar'
import ResultGrid from './components/ResultGrid'
import DownloadPanel from './components/DownloadPanel'

function AppInner() {
  return (
    <div className="h-screen flex flex-col bg-neutral-950">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 p-6">
          <SearchBar />
          <div className="mt-6 flex-1 flex flex-col min-h-0">
            <ResultGrid />
          </div>
        </main>
      </div>

      {/* Download panel (fixed at bottom) */}
      <DownloadPanel />
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