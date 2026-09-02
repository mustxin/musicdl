const SOURCE_COLORS = {
  MiguMusicClient:    'bg-blue-500/15 text-blue-300 border-blue-400/30',
  NeteaseMusicClient: 'bg-red-500/15 text-red-300 border-red-400/30',
  QQMusicClient:      'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  KuwoMusicClient:    'bg-yellow-500/15 text-yellow-300 border-yellow-400/30',
  QianqianMusicClient:'bg-purple-500/15 text-purple-300 border-purple-400/30',
  KugouMusicClient:   'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
}

const SOURCE_SHORT = {
  MiguMusicClient: 'Migu', NeteaseMusicClient: 'Netease', QQMusicClient: 'QQ',
  KuwoMusicClient: 'Kuwo', QianqianMusicClient: 'Qianqian', KugouMusicClient: 'Kugou',
}

export default function ResultCard({ songInfo, onDownload }) {
  const ext = (songInfo.ext || 'mp3').toUpperCase()
  const isLossless = ['FLAC', 'WAV', 'ALAC', 'APE', 'DSF', 'DFF'].includes(ext)
  const sourceColor = SOURCE_COLORS[songInfo.source] || 'bg-midnight-800 text-neutral-400 border-midnight-600'
  const sourceShort = SOURCE_SHORT[songInfo.source] || (songInfo.source || '').replace('MusicClient', '')

  return (
    <div className="group bg-midnight-900/80 hover:bg-midnight-900 rounded-2xl border border-midnight-700/60 hover:border-midnight-600 transition-[transform,background-color,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 overflow-hidden">
      {/* Cover art area */}
      <div className="aspect-square bg-midnight-800 relative">
        {songInfo.cover_url ? (
          <img
            src={songInfo.cover_url}
            alt={songInfo.song_name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-midnight-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
        {/* Source badge — floating on cover top-left */}
        <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-md border backdrop-blur-sm ${sourceColor}`}>
          {sourceShort}
        </span>
        {/* Bottom gradient mask + persistent download button */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        <button
          onClick={() => onDownload(songInfo)}
          className="absolute bottom-2 right-2 w-9 h-9 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-black/40 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          title="Download"
          aria-label={`Download ${songInfo.song_name || 'track'}`}
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-neutral-100 truncate" title={songInfo.song_name}>
          {songInfo.song_name || 'Unknown'}
        </h3>
        <p className="text-xs text-neutral-400 truncate mt-0.5" title={songInfo.singers}>
          {songInfo.singers || 'Unknown Artist'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-neutral-500">{songInfo.duration || '--:--'}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium border ${
            isLossless ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
            'bg-midnight-800 text-neutral-400 border-midnight-600'
          }`}>
            {ext}
          </span>
          {songInfo.file_size && (
            <span className="text-xs text-neutral-600">{songInfo.file_size}</span>
          )}
        </div>
      </div>
    </div>
  )
}