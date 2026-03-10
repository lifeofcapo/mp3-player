import axios from 'axios'
import type { Track, Playlist, PlaylistDetail, DownloadJob } from '@/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
})

// Tracks
export const getTracks = () =>
  api.get<Track[]>('/tracks').then(r => r.data)

export const deleteTrack = (id: number) =>
  api.delete(`/tracks/${id}`)

export const getAudioUrl = (id: number) =>
  `${api.defaults.baseURL}/tracks/${id}/audio`

// Downloads
export const startDownload = (url: string, playlist_id?: number) =>
  api.post<DownloadJob>('/downloads', { url, playlist_id }).then(r => r.data)

export const getJobStatus = (id: number) =>
  api.get<DownloadJob>(`/downloads/${id}`).then(r => r.data)

// Playlists
export const getPlaylists = () =>
  api.get<Playlist[]>('/playlists').then(r => r.data)

export const createPlaylist = (name: string) =>
  api.post<Playlist>('/playlists', { name }).then(r => r.data)

export const getPlaylist = (id: number) =>
  api.get<PlaylistDetail>(`/playlists/${id}`).then(r => r.data)

export const addTrackToPlaylist = (playlistId: number, trackId: number) =>
  api.post(`/playlists/${playlistId}/tracks`, { track_id: trackId })

export const removeTrackFromPlaylist = (playlistId: number, trackId: number) =>
  api.delete(`/playlists/${playlistId}/tracks/${trackId}`)

export const deletePlaylist = (id: number) =>
  api.delete(`/playlists/${id}`)