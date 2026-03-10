import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/store/playerStore'

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { setAudioEl, setProgress, setDuration, nextTrack, volume, isPlaying } = usePlayerStore()

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.volume = volume
    audioRef.current = audio
    setAudioEl(audio)

    const handleTimeUpdate = () => setProgress(audio.currentTime)
    const handleDurationChange = () => setDuration(audio.duration || 0)
    const handleEnded = () => nextTrack()
    const handlePlay = () => usePlayerStore.setState({ isPlaying: true })
    const handlePause = () => usePlayerStore.setState({ isPlaying: false })

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.pause()
      audio.src = ''
      setAudioEl(null)
    }
  }, [])

  return audioRef
}

export function useFormatTime() {
  return (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }
}