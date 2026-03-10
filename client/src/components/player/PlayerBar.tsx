import { usePlayerStore } from '@/store/playerStore'
import { useFormatTime } from '@/hooks/useAudio'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Shuffle, Repeat, Repeat1,
  Music2
} from 'lucide-react'

export function PlayerBar() {
  const {
    currentTrack, isPlaying, progress, duration,
    volume, isMuted, shuffle, repeat,
    togglePlay, nextTrack, prevTrack,
    setVolume, toggleMute, toggleShuffle, cycleRepeat,
    setProgress, audioEl
  } = usePlayerStore()

  const fmt = useFormatTime()

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !audioEl) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const time = ratio * duration
    audioEl.currentTime = time
    setProgress(time)
  }

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="player-bar">
      <div className="player-track-info">
        {currentTrack ? (
          <>
            <div className="player-cover">
              {currentTrack.cover_url ? (
                <img src={currentTrack.cover_url} alt={currentTrack.title} />
              ) : (
                <div className="player-cover-placeholder">
                  <Music2 size={20} />
                </div>
              )}
            </div>
            <div className="player-meta">
              <span className="player-title">{currentTrack.title}</span>
              <span className="player-artist">{currentTrack.artist}</span>
            </div>
          </>
        ) : (
          <div className="player-empty">
            <div className="player-cover-placeholder">
              <Music2 size={20} />
            </div>
            <div className="player-meta">
              <span className="player-title" style={{ color: 'var(--text-muted)' }}>Ничего не играет</span>
            </div>
          </div>
        )}
      </div>

      <div className="player-controls">
        <div className="player-buttons">
          <button
            className={`icon-btn ${shuffle ? 'active' : ''}`}
            onClick={toggleShuffle}
            title="Случайный порядок"
          >
            <Shuffle size={16} />
          </button>

          <button className="icon-btn" onClick={prevTrack} title="Предыдущий">
            <SkipBack size={20} />
          </button>

          <button
            className="play-btn"
            onClick={togglePlay}
            disabled={!currentTrack}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <button className="icon-btn" onClick={nextTrack} title="Следующий">
            <SkipForward size={20} />
          </button>

          <button
            className={`icon-btn ${repeat !== 'none' ? 'active' : ''}`}
            onClick={cycleRepeat}
            title="Повтор"
          >
            {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>

        <div className="player-progress-row">
          <span className="player-time">{fmt(progress)}</span>
          <div className="player-seekbar" onClick={handleSeek}>
            <div className="player-seekbar-track">
              <div
                className="player-seekbar-fill"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="player-seekbar-thumb"
                style={{ left: `${progressPct}%` }}
              />
            </div>
          </div>
          <span className="player-time">{fmt(duration)}</span>
        </div>
      </div>

      <div className="player-volume">
        <button className="icon-btn" onClick={toggleMute}>
          {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <div className="volume-slider">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  )
}