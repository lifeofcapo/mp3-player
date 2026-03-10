import { useState } from 'react'
import { Download, X, Loader2, CheckCircle, AlertCircle, Link } from 'lucide-react'
import { useDownload } from '@/hooks/useDownload'
import type { Playlist } from '@/types'

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
  const [selectedPlaylist, setSelectedPlaylist] = useState<number | undefined>(
    activePlaylistId ?? undefined
  )
  const { jobs, download, isSubmitting, removeJob } = useDownload(onComplete)
  const [error, setError] = useState('')

  const source = detectSource(url)

  const handleSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setError('')
    try {
      await download(trimmed, selectedPlaylist)
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
          <Link size={16} className="download-input-icon" />
          <input
            type="url"
            className="download-input"
            placeholder="Вставьте ссылку YouTube / SoundCloud / Spotify / VK..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          {source && (
            <span className="download-source-badge">{source}</span>
          )}
        </div>

        <select
          className="download-playlist-select"
          value={selectedPlaylist ?? ''}
          onChange={e => setSelectedPlaylist(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Без плейлиста</option>
          {playlists.map(pl => (
            <option key={pl.id} value={pl.id}>{pl.name}</option>
          ))}
        </select>

        <button
          className="download-btn"
          onClick={handleSubmit}
          disabled={isSubmitting || !url.trim()}
        >
          {isSubmitting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
          <span>Скачать</span>
        </button>
      </div>

      {error && (
        <div className="download-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="download-jobs">
          {jobs.map(j => (
            <div key={j.id} className={`download-job download-job-${j.job.status}`}>
              <div className="download-job-info">
                <span className="download-job-url">{j.url.length > 60 ? j.url.slice(0, 57) + '...' : j.url}</span>
                <span className="download-job-status">
                  {j.job.status === 'pending' && 'В очереди...'}
                  {j.job.status === 'downloading' && `Скачивается ${j.job.progress.toFixed(0)}%`}
                  {j.job.status === 'done' && 'Готово!'}
                  {j.job.status === 'error' && `Ошибка: ${j.job.error}`}
                </span>
              </div>

              <div className="download-job-right">
                {j.job.status === 'downloading' && (
                  <Loader2 size={14} className="spin text-accent" />
                )}
                {j.job.status === 'done' && (
                  <CheckCircle size={14} className="text-green" />
                )}
                {j.job.status === 'error' && (
                  <AlertCircle size={14} className="text-red" />
                )}
                <button className="icon-btn" onClick={() => removeJob(j.id)}>
                  <X size={12} />
                </button>
              </div>

              {j.job.status === 'downloading' && (
                <div className="download-job-bar">
                  <div
                    className="download-job-fill"
                    style={{ width: `${j.job.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}