export interface Track {
  id: number
  title: string
  artist: string
  album: string
  duration: number
  source_url: string
  source_type: 'youtube' | 'soundcloud' | 'spotify' | 'vk'
  cover_url: string
}

export interface Playlist {
  id: number
  name: string
  track_count: number
}

export interface PlaylistDetail {
  id: number
  name: string
  tracks: Track[]
}

export interface DownloadJob {
  id: number
  status: 'pending' | 'downloading' | 'done' | 'error'
  progress: number
  error: string
  track_id: number | null
}

export type RepeatMode = 'none' | 'all' | 'one'
export type Theme = 'dark' | 'light' | 'system'