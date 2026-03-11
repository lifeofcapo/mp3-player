import { usePlayerStore } from '@/store/playerStore'
import { useFormatTime } from '@/hooks/useAudio'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Shuffle, Repeat, Repeat1,
  Music2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

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
                  <Music2 size={18} />
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
            <div className="player-cover-placeholder" style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--muted)' }}>
              <Music2 size={18} />
            </div>
            <div className="player-meta">
              <span className="player-title" style={{ color: 'var(--muted-foreground)' }}>Ничего не играет</span>
            </div>
          </div>
        )}
      </div>
      <div className="player-controls">
        <div className="player-buttons">
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(shuffle && 'text-primary')}
            onClick={toggleShuffle}
            title="Случайный порядок"
          >
            <Shuffle size={15} />
          </Button>

          <Button variant="ghost" size="icon-sm" onClick={prevTrack} title="Предыдущий">
            <SkipBack size={18} />
          </Button>

          <button
            className="play-btn"
            onClick={togglePlay}
            disabled={!currentTrack}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <Button variant="ghost" size="icon-sm" onClick={nextTrack} title="Следующий">
            <SkipForward size={18} />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(repeat !== 'none' && 'text-primary')}
            onClick={cycleRepeat}
            title="Повтор"
          >
            {repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </Button>
        </div>

        <div className="player-progress-row">
          <span className="player-time">{fmt(progress)}</span>
          <div className="player-seekbar" onClick={handleSeek}>
            <div className="player-seekbar-track">
              <div className="player-seekbar-fill" style={{ width: `${progressPct}%` }} />
              <div className="player-seekbar-thumb" style={{ left: `${progressPct}%` }} />
            </div>
          </div>
          <span className="player-time">{fmt(duration)}</span>
        </div>
      </div>

      <div className="player-volume">
        <Button variant="ghost" size="icon-sm" onClick={toggleMute}>
          {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </Button>
        <div className="w-20">
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[isMuted ? 0 : volume]}
            onValueChange={(val) => {
              // base-ui Slider передаёт number, не number[]
              const num = Array.isArray(val) ? val[0] : (val as unknown as number)
              setVolume(num)
            }}
            className="cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}