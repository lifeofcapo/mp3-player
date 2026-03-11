import { useState } from 'react'
import { Download, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useDownload } from '@/hooks/useDownload'
import type { Playlist } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DownloadBarProps {
  playlists: Playlist[]
  activePlaylistId: number | null
  onComplete: () => void
}

function detectSource(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('spotify.com')) return 'Spotify'
  if (u.includes('soundcloud.com')) return 'SoundCloud'
  if (u.includes('vk.com') || u.includes('vkontakte')) return 'VK'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube'
  return ''
}

export function DownloadBar({ playlists, activePlaylistId, onComplete }: DownloadBarProps) {
  const [url, setUrl] = useState('')
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>(
    activePlaylistId ? String(activePlaylistId) : 'none'
  )
  const { jobs, download, isSubmitting, removeJob } = useDownload(onComplete)
  const [error, setError] = useState('')

  const source = detectSource(url)

  const handleSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setError('')
    try {
      const playlistId = selectedPlaylist !== 'none' ? Number(selectedPlaylist) : undefined
      await download(trimmed, playlistId)
      setUrl('')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка при отправке'
      setError(msg)
    }
  }

  return (
    <div className="download-section">
      <div className="download-input-wrap">
        <div className="download-input-container">
          <Input
            type="url"
            className="h-9 text-sm"
            placeholder="Вставьте ссылку YouTube / SoundCloud / Spotify / VK..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          {source && (
            <Badge variant="secondary" className="absolute right-2 text-[10px] font-bold tracking-wide">
              {source}
            </Badge>
          )}
        </div>
        <Select value={selectedPlaylist} onValueChange={(v) => setSelectedPlaylist(v ?? 'none')}>
          <SelectTrigger className="h-9 min-w-37.5 text-sm">
            <SelectValue>
              {selectedPlaylist === 'none'
                ? 'Без плейлиста'
                : playlists.find(p => String(p.id) === selectedPlaylist)?.name ?? 'Без плейлиста'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Без плейлиста</SelectItem>
            {playlists.map(pl => (
              <SelectItem key={pl.id} value={String(pl.id)}>{pl.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          className="h-9 gap-1.5 px-4"
          onClick={handleSubmit}
          disabled={isSubmitting || !url.trim()}
        >
          {isSubmitting
            ? <Loader2 size={14} className="animate-spin" />
            : <Download size={14} />
          }
          Скачать
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          {jobs.map(j => (
            <div
              key={j.id}
              className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm relative overflow-hidden"
            >
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <span className="font-medium truncate text-foreground">
                  {j.url.length > 60 ? j.url.slice(0, 57) + '...' : j.url}
                </span>
                <span className="text-xs text-muted-foreground">
                  {j.job.status === 'pending' && 'В очереди...'}
                  {j.job.status === 'downloading' && `Скачивается ${j.job.progress.toFixed(0)}%`}
                  {j.job.status === 'done' && 'Готово!'}
                  {j.job.status === 'error' && `Ошибка: ${j.job.error}`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {j.job.status === 'downloading' && <Loader2 size={14} className="animate-spin text-primary" />}
                {j.job.status === 'done' && <CheckCircle size={14} className="text-green-500" />}
                {j.job.status === 'error' && <AlertCircle size={14} className="text-destructive" />}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeJob(j.id)}
                >
                  <X size={12} />
                </Button>
              </div>

              {j.job.status === 'downloading' && (
                <div className="download-job-bar">
                  <div className="download-job-fill" style={{ width: `${j.job.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}