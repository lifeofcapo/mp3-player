import { useEffect, useState, useCallback } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useAudio } from '@/hooks/useAudio'
import { getTracks, getPlaylists, getPlaylist } from '@/api'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { PlayerBar } from '@/components/player/PlayerBar'
import { TrackList } from '@/components/tracks/TrackList'
import { DownloadBar } from '@/components/download/DownloadBar'
import type { Track, Playlist } from '@/types'
import { RefreshCw, Loader2 } from 'lucide-react'
import { ThemeProvider } from './components/theme-provider'
import { ModeToggle } from './components/mode-toggle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function App() {
  useAudio()

  const { activePlaylistId, setActivePlaylist } = usePlayerStore()

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
      <div className="app-root">
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
                <Badge variant="secondary" className="text-xs font-normal px-2">
                  {displayedTracks.length} {pluralTracks(displayedTracks.length)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={loadAll}
                title="Обновить"
              >
                <RefreshCw size={16} />
              </Button>
              <ModeToggle />
            </div>
          </header>

          <div className="content-area">
            {showDownloads ? (
              <>
                <DownloadBar
                  playlists={playlists}
                  activePlaylistId={activePlaylistId}
                  onComplete={loadAll}
                />
                <div className="downloads-hint">
                  <p>Вставьте ссылку выше, чтобы начать скачивание.</p>
                  <p>Поддерживаются: <strong>YouTube</strong>, <strong>SoundCloud</strong>, <strong>Spotify</strong>, <strong>VK Music</strong></p>
                </div>
              </>
            ) : loading ? (
              <div className="loading-state">
                <Loader2 className="animate-spin" size={24} />
                <span>Загрузка...</span>
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