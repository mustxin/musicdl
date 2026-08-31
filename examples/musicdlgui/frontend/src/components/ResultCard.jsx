const SOURCE_COLORS = {
  MiguMusicClient:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  NeteaseMusicClient: 'bg-red-500/10 text-red-400 border-red-500/30',
  QQMusicClient:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  KuwoMusicClient:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  QianqianMusicClient:'bg-purple-500/10 text-purple-400 border-purple-500/30',
  KugouMusicClient:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
}

const SOURCE_SHORT = {
  MiguMusicClient: 'Migu', NeteaseMusicClient: 'Netease', QQMusicClient: 'QQ',
  KuwoMusicClient: 'Kuwo', QianqianMusicClient: 'Qianqian', KugouMusicClient: 'Kugou',
}

export default function ResultCard({ songInfo, onDownload }) {
  const ext = (songInfo.ext || 'mp3').toUpperCase()
  const isLossless = ['FLAC', 'WAV', 'ALAC', 'APE', 'DSF', 'DFF'].includes(ext)
  const sourceColor = SOURCE_COLORS[songInfo.source] || 'bg-neutral-700/50 text-neutral-400 border-neutral-600/30'
  const sourceShort = SOURCE_SHORT[songInfo.source] || (songInfo.source || '').replace('MusicClient', '')

  return (
    <div className="group bg-neutral-800/50 hover:bg-neutral-800 rounded-xl border border-neutral-700/50 hover:border-neutral-600/50 transition-all duration-200 overflow-hidden">
      {/* Cover art area */}
      <div className="aspect-square bg-neutral-700/30 flex items-center justify-center relative">
        {songInfo.cover_url ? (
          <img
            src={songInfo.cover_url}
            alt={songInfo.song_name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <svg className="w-12 h-12 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        )}
        {/* Download button overlay */}
        <button
          onClick={() => onDownload(songInfo)}
          className="absolute bottom-2 right-2 w-9 h-9 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          title="Download"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${sourceColor}`}>
            {sourceShort}
          </span>
          <span className="text-xs text-neutral-500">{songInfo.duration || '--:--'}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            isLossless ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
            'bg-neutral-700/50 text-neutral-400 border border-neutral-600/30'
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