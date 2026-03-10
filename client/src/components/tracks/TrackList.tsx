import { useState } from 'react'
import { Music2, Play, Pause, Trash2, Plus, MoreHorizontal, Check } from 'lucide-react'
import { usePlayerStore } from '@/store/playerStore'
import type { Track, Playlist } from '@/types'
import { deleteTrack, addTrackToPlaylist } from '@/api'

interface TrackListProps {
  tracks: Track[]
  playlists: Playlist[]
  onTracksChange: () => void
  title?: string
}

function sourceColor(type: string) {
  switch (type) {
    case 'youtube': return '#ff4040'
    case 'soundcloud': return '#ff5500'
    case 'spotify': return '#1db954'
    case 'vk': return '#4a76a8'
    default: return 'var(--text-muted)'
  }
}

function sourceLabel(type: string) {
  switch (type) {
    case 'youtube': return 'YT'
    case 'soundcloud': return 'SC'
    case 'spotify': return 'SP'
    case 'vk': return 'VK'
    default: return '?'
  }
}

function formatDuration(seconds: number) {
  if (!seconds || !isFinite(seconds)) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface AddToPlaylistMenuProps {
  track: Track
  playlists: Playlist[]
  onClose: () => void
}

function AddToPlaylistMenu({ track, playlists, onClose }: AddToPlaylistMenuProps) {
  const [added, setAdded] = useState<number[]>([])

  const handleAdd = async (playlistId: number) => {
    await addTrackToPlaylist(playlistId, track.id)
    setAdded(prev => [...prev, playlistId])
  }

  return (
    <div className="track-menu" onClick={e => e.stopPropagation()}>
      <div className="track-menu-header">Добавить в плейлист</div>
      {playlists.length === 0 && (
        <div className="track-menu-empty">Нет плейлистов</div>
      )}
      {playlists.map(pl => (
        <button
          key={pl.id}
          className="track-menu-item"
          onClick={() => handleAdd(pl.id)}
          disabled={added.includes(pl.id)}
        >
          {added.includes(pl.id) ? <Check size={12} /> : <Plus size={12} />}
          {pl.name}
        </button>
      ))}
      <div className="track-menu-divider" />
      <button className="track-menu-close" onClick={onClose}>Закрыть</button>
    </div>
  )
}

export function TrackList({ tracks, playlists, onTracksChange, title }: TrackListProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()
  const [menuTrack, setMenuTrack] = useState<Track | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const handleDelete = async (e: React.MouseEvent, track: Track) => {
    e.stopPropagation()
    await deleteTrack(track.id)
    onTracksChange()
  }

  const handlePlay = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay()
    } else {
      playTrack(track, tracks)
    }
  }

  if (tracks.length === 0) {
    return (
      <div className="tracks-empty">
        <div className="tracks-empty-icon">
          <Music2 size={40} />
        </div>
        <p>Нет треков</p>
        <span>Вставьте ссылку выше, чтобы скачать музыку</span>
      </div>
    )
  }

  return (
    <div className="tracklist">
      {title && <h2 className="tracklist-title">{title}</h2>}
      <div className="tracklist-header">
        <span>#</span>
        <span>Название</span>
        <span className="tracklist-header-album">Альбом</span>
        <span>Длина</span>
      </div>
      <div className="tracklist-rows">
        {tracks.map((track, i) => {
          const isActive = currentTrack?.id === track.id
          const isHovered = hoveredId === track.id

          return (
            <div
              key={track.id}
              className={`track-row ${isActive ? 'track-row-active' : ''}`}
              onMouseEnter={() => setHoveredId(track.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handlePlay(track)}
            >
              {/* Index / play icon */}
              <div className="track-index">
                {isHovered || (isActive && isPlaying) ? (
                  <button className="track-play-icon" onClick={e => { e.stopPropagation(); handlePlay(track) }}>
                    {isActive && isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                ) : (
                  <span className={isActive ? 'text-accent' : ''}>{i + 1}</span>
                )}
              </div>

              <div className="track-info">
                <div className="track-cover">
                  {track.cover_url ? (
                    <img src={track.cover_url} alt={track.title} />
                  ) : (
                    <div className="track-cover-placeholder">
                      <Music2 size={14} />
                    </div>
                  )}
                  <span
                    className="track-source-badge"
                    style={{ background: sourceColor(track.source_type) }}
                  >
                    {sourceLabel(track.source_type)}
                  </span>
                </div>
                <div className="track-text">
                  <span className="track-title">{track.title}</span>
                  <span className="track-artist">{track.artist}</span>
                </div>
              </div>

              <div className="track-album">
                {track.album || '—'}
              </div>

              <div className="track-right">
                <span className="track-duration">{formatDuration(track.duration)}</span>
                <div className="track-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="icon-btn track-action-btn"
                    onClick={(e) => { e.stopPropagation(); setMenuTrack(menuTrack?.id === track.id ? null : track) }}
                    title="Добавить в плейлист"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  <button
                    className="icon-btn track-action-btn track-delete-btn"
                    onClick={(e) => handleDelete(e, track)}
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {menuTrack?.id === track.id && (
                  <AddToPlaylistMenu
                    track={track}
                    playlists={playlists}
                    onClose={() => setMenuTrack(null)}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}