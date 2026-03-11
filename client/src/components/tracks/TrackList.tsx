import { useState } from 'react'
import { Music2, Play, Pause, Trash2, Plus, MoreHorizontal, Check } from 'lucide-react'
import { usePlayerStore } from '@/store/playerStore'
import type { Track, Playlist } from '@/types'
import { deleteTrack, addTrackToPlaylist } from '@/api'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

export function TrackList({ tracks, playlists, onTracksChange }: TrackListProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()
  const [addedMap, setAddedMap] = useState<Record<number, number[]>>({})

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
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon-xs">
                    <MoreHorizontal size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Добавить в плейлист</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {playlists.length === 0 && (
                    <DropdownMenuItem disabled>Нет плейлистов</DropdownMenuItem>
                  )}
                  {playlists.map(pl => {
                    const alreadyAdded = (addedMap[track.id] ?? []).includes(pl.id)
                    return (
                      <DropdownMenuItem
                        key={pl.id}
                        disabled={alreadyAdded}
                        onClick={() => handleAddToPlaylist(track, pl.id)}
                      >
                        {alreadyAdded ? <Check size={12} /> : <Plus size={12} />}
                        {pl.name}
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => handleDelete(e, track)}
                  >
                    <Trash2 size={12} />
                    Удалить трек
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )
      })}
    </div>
  )
}