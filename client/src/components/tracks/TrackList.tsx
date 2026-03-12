import { useState, useRef, useEffect } from 'react'
import { Music2, Play, Pause, Trash2, Plus, MoreHorizontal, Check } from 'lucide-react'
import { usePlayerStore } from '@/store/playerStore'
import type { Track, Playlist } from '@/types'
import { deleteTrack, addTrackToPlaylist } from '@/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    default: return 'var(--muted-foreground)'
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

interface TrackMenuProps {
  track: Track
  playlists: Playlist[]
  addedMap: Record<number, number[]>
  onAddToPlaylist: (track: Track, playlistId: number) => Promise<void>
  onDelete: (track: Track) => Promise<void>
}

function TrackMenu({ track, playlists, addedMap, onAddToPlaylist, onDelete }: TrackMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="track-menu-wrap" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Действия с треком"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
      >
        <MoreHorizontal size={14} />
      </Button>

      {open && (
        <div className="track-menu" onClick={e => e.stopPropagation()}>
          <div className="track-menu-header">Добавить в плейлист</div>
          <div className="track-menu-divider" />

          {playlists.length === 0 && (
            <div className="track-menu-empty">Нет плейлистов</div>
          )}

          {playlists.map(pl => {
            const alreadyAdded = (addedMap[track.id] ?? []).includes(pl.id)
            return (
              <button
                key={pl.id}
                className="track-menu-item"
                disabled={alreadyAdded}
                onClick={async () => {
                  await onAddToPlaylist(track, pl.id)
                  setOpen(false)
                }}
              >
                {alreadyAdded ? <Check size={12} /> : <Plus size={12} />}
                {pl.name}
              </button>
            )
          })}

          <div className="track-menu-divider" />

          <button
            className="track-menu-item"
            style={{ color: 'var(--destructive)' }}
            onClick={async () => {
              await onDelete(track)
              setOpen(false)
            }}
          >
            <Trash2 size={12} />
            Удалить трек
          </button>
        </div>
      )}
    </div>
  )
}

export function TrackList({ tracks, playlists, onTracksChange }: TrackListProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()
  const [addedMap, setAddedMap] = useState<Record<number, number[]>>({})

  const handleDelete = async (track: Track) => {
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

  const handleAddToPlaylist = async (track: Track, playlistId: number) => {
    await addTrackToPlaylist(playlistId, track.id)
    setAddedMap(prev => ({
      ...prev,
      [track.id]: [...(prev[track.id] ?? []), playlistId]
    }))
  }

  if (tracks.length === 0) {
    return (
      <div className="tracks-empty">
        <div className="tracks-empty-icon">
          <Music2 size={24} />
        </div>
        <p className="tracks-empty-title">Нет треков</p>
        <p className="tracks-empty-sub">Перейдите в «Загрузки» и добавьте первый трек</p>
      </div>
    )
  }

  return (
    <div className="track-list">
      {tracks.map((track, idx) => {
        const isActive = currentTrack?.id === track.id
        const isCurrentPlaying = isActive && isPlaying

        return (
          <div
            key={track.id}
            className={cn('track-item', isActive && 'playing')}
            onClick={() => handlePlay(track)}
          >
            <div className="relative w-7 flex items-center justify-center">
              <span className="track-num text-xs text-muted-foreground">{idx + 1}</span>
              <span className="track-play-icon">
                {isCurrentPlaying
                  ? <Pause size={14} />
                  : <Play size={14} />
                }
              </span>
            </div>

            <div className="track-cover">
              {track.cover_url
                ? <img src={track.cover_url} alt={track.title} />
                : <Music2 size={16} className="text-muted-foreground" />
              }
            </div>

            <div className="track-info">
              <span className="track-title">{track.title}</span>
              <span className="track-artist">{track.artist}</span>
            </div>

            <span
              className="track-source"
              style={{ background: `${sourceColor(track.source_type)}22`, color: sourceColor(track.source_type) }}
            >
              {sourceLabel(track.source_type)}
            </span>

            <span className="track-duration">{formatDuration(track.duration)}</span>

            <div className="track-actions" onClick={e => e.stopPropagation()}>
              <TrackMenu
                track={track}
                playlists={playlists}
                addedMap={addedMap}
                onAddToPlaylist={handleAddToPlaylist}
                onDelete={handleDelete}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}