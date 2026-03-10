import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track, RepeatMode, Theme, Playlist } from '@/types'
import { getAudioUrl } from '@/api'

interface PlayerState {
  // Queue & current track
  queue: Track[]
  currentIndex: number
  currentTrack: Track | null

  // Playback state
  isPlaying: boolean
  progress: number
  duration: number
  volume: number
  isMuted: boolean
  shuffle: boolean
  repeat: RepeatMode

  // UI state
  theme: Theme
  activePlaylistId: number | null
  playlists: Playlist[]
  isLoading: boolean

  // Actions
  setQueue: (tracks: Track[], startIndex?: number) => void
  playTrack: (track: Track, queue?: Track[]) => void
  togglePlay: () => void
  nextTrack: () => void
  prevTrack: () => void
  setProgress: (progress: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setTheme: (theme: Theme) => void
  setActivePlaylist: (id: number | null) => void
  setPlaylists: (playlists: Playlist[]) => void

  // Audio element ref (not persisted)
  audioEl: HTMLAudioElement | null
  setAudioEl: (el: HTMLAudioElement | null) => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      isPlaying: false,
      progress: 0,
      duration: 0,
      volume: 0.8,
      isMuted: false,
      shuffle: false,
      repeat: 'none',
      theme: 'dark',
      activePlaylistId: null,
      playlists: [],
      isLoading: false,
      audioEl: null,

      setAudioEl: (el) => set({ audioEl: el }),

      setQueue: (tracks, startIndex = 0) => {
        const track = tracks[startIndex] ?? null
        set({ queue: tracks, currentIndex: startIndex, currentTrack: track })
        if (track) {
          const { audioEl } = get()
          if (audioEl) {
            audioEl.src = getAudioUrl(track.id)
            audioEl.play().catch(() => {})
          }
        }
      },

      playTrack: (track, queue) => {
        const newQueue = queue ?? get().queue
        const idx = newQueue.findIndex(t => t.id === track.id)
        const finalQueue = idx === -1 ? [track, ...newQueue] : newQueue
        const finalIdx = idx === -1 ? 0 : idx

        set({ queue: finalQueue, currentIndex: finalIdx, currentTrack: track, isPlaying: true, progress: 0 })

        const { audioEl } = get()
        if (audioEl) {
          audioEl.src = getAudioUrl(track.id)
          audioEl.play().catch(() => {})
        }
      },

      togglePlay: () => {
        const { isPlaying, audioEl, currentTrack } = get()
        if (!currentTrack) return
        if (isPlaying) {
          audioEl?.pause()
          set({ isPlaying: false })
        } else {
          audioEl?.play().catch(() => {})
          set({ isPlaying: true })
        }
      },

      nextTrack: () => {
        const { queue, currentIndex, shuffle, repeat, audioEl } = get()
        if (!queue.length) return

        let nextIdx: number
        if (repeat === 'one') {
          nextIdx = currentIndex
        } else if (shuffle) {
          nextIdx = Math.floor(Math.random() * queue.length)
        } else {
          nextIdx = currentIndex + 1
          if (nextIdx >= queue.length) {
            nextIdx = repeat === 'all' ? 0 : -1
          }
        }

        if (nextIdx === -1) {
          audioEl?.pause()
          set({ isPlaying: false, progress: 0 })
          return
        }

        const track = queue[nextIdx]
        set({ currentIndex: nextIdx, currentTrack: track, progress: 0, isPlaying: true })
        if (audioEl) {
          audioEl.src = getAudioUrl(track.id)
          audioEl.play().catch(() => {})
        }
      },

      prevTrack: () => {
        const { queue, currentIndex, audioEl, progress } = get()
        if (!queue.length) return

        // If more than 3 seconds in, restart current track
        if (progress > 3) {
          if (audioEl) audioEl.currentTime = 0
          set({ progress: 0 })
          return
        }

        const prevIdx = Math.max(0, currentIndex - 1)
        const track = queue[prevIdx]
        set({ currentIndex: prevIdx, currentTrack: track, progress: 0, isPlaying: true })
        if (audioEl) {
          audioEl.src = getAudioUrl(track.id)
          audioEl.play().catch(() => {})
        }
      },

      setProgress: (progress) => set({ progress }),
      setDuration: (duration) => set({ duration }),

      setVolume: (volume) => {
        const { audioEl } = get()
        if (audioEl) audioEl.volume = volume
        set({ volume, isMuted: volume === 0 })
      },

      toggleMute: () => {
        const { isMuted, volume, audioEl } = get()
        const newMuted = !isMuted
        if (audioEl) audioEl.volume = newMuted ? 0 : volume
        set({ isMuted: newMuted })
      },

      toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),

      cycleRepeat: () => set(s => ({
        repeat: s.repeat === 'none' ? 'all' : s.repeat === 'all' ? 'one' : 'none'
      })),

      setTheme: (theme) => set({ theme }),
      setActivePlaylist: (id) => set({ activePlaylistId: id }),
      setPlaylists: (playlists) => set({ playlists }),
    }),
    {
      name: 'universeplay-storage',
      partialize: (state) => ({
        volume: state.volume,
        shuffle: state.shuffle,
        repeat: state.repeat,
        theme: state.theme,
      }),
    }
  )
)