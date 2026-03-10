import { useEffect, useState, useCallback } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useAudio } from '@/hooks/useAudio'
import { getTracks, getPlaylists, getPlaylist } from '@/api'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { PlayerBar } from '@/components/player/PlayerBar'
import { TrackList } from '@/components/tracks/TrackList'
import { DownloadBar } from '@/components/download/DownloadBar'
import type { Track, Playlist } from '@/types'
import { RefreshCw } from 'lucide-react'
import { ThemeProvider } from './components/theme-provider'

export default function App() {
  useAudio()

  const { theme, activePlaylistId, setActivePlaylist } = usePlayerStore()

  const [tracks, setTracks] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [playlistTracks, setPlaylistTracks] = useState<Track[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDownloads, setShowDownloads] = useState(false)

  const loadTracks = useCallback(async () => {
    const data = await getTracks()
    setTracks(data)
  }, [])

  const loadPlaylists = useCallback(async () => {
    const data = await getPlaylists()
    setPlaylists(data)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadTracks(), loadPlaylists()])
    } finally {
      setLoading(false)
    }
  }, [loadTracks, loadPlaylists])

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (activePlaylistId != null) {
      getPlaylist(activePlaylistId).then(pl => setPlaylistTracks(pl.tracks))
    } else {
      setPlaylistTracks(null)
    }
  }, [activePlaylistId])

  const displayedTracks = playlistTracks ?? tracks
  const currentPlaylist = playlists.find(p => p.id === activePlaylistId)

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <div className={`app-root`}>
      <Sidebar
        playlists={playlists}
        onPlaylistsChange={loadPlaylists}
        onSelectPlaylist={(id) => {
          setActivePlaylist(id)
          setShowDownloads(false)
        }}
        activePlaylistId={activePlaylistId}
        onShowDownloads={() => {
          setShowDownloads(true)
          setActivePlaylist(null)
        }}
      />

      <main className="main-content">
        <header className="main-header">
          <div className="main-header-left">
            <h1 className="main-title">
              {showDownloads ? 'Загрузки' :
               currentPlaylist ? currentPlaylist.name :
               'Все треки'}
            </h1>
            {!showDownloads && (
              <span className="main-subtitle">
                {displayedTracks.length} {pluralTracks(displayedTracks.length)}
              </span>
            )}
          </div>
          <button
            className="refresh-btn"
            onClick={loadAll}
            title="Обновить"
          >
            <RefreshCw size={16} />
          </button>
        </header>

        <DownloadBar
          playlists={playlists}
          activePlaylistId={activePlaylistId}
          onComplete={loadAll}
        />

        <div className="content-area">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <span>Загрузка...</span>
            </div>
          ) : showDownloads ? (
            <div className="downloads-hint">
              <p>Вставьте ссылку выше, чтобы начать скачивание.</p>
              <p>Поддерживаются: <strong>YouTube</strong>, <strong>SoundCloud</strong>, <strong>Spotify</strong>, <strong>VK Music</strong></p>
            </div>
          ) : (
            <TrackList
              tracks={displayedTracks}
              playlists={playlists}
              onTracksChange={loadAll}
              title={currentPlaylist ? currentPlaylist.name : undefined}
            />
          )}
        </div>
      </main>

      <PlayerBar />
    </div>
    </ThemeProvider>
  )
}

function pluralTracks(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'трек'
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'трека'
  return 'треков'
}