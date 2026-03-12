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

// VK Cookies (оставляем для совместимости)
export const getVkCookiesStatus = () =>
  api.get<{ has_cookies: boolean; age_days?: number; warning?: string | null }>('/cookies/vk/status').then(r => r.data)

export const uploadVkCookies = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/cookies/vk', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export const deleteVkCookies = () =>
  api.delete('/cookies/vk').then(r => r.data)

// VK Auth
export interface VkStatus {
  authenticated: boolean
  login?: string
  user_id?: number
}

export const getVkStatus = () =>
  api.get<VkStatus>('/vk/status').then(r => r.data)

export const vkLogin = (login: string, password: string) =>
  api.post<{ status: 'ok' | '2fa_required' }>('/vk/login', { login, password }).then(r => r.data)

export const vkLogin2fa = (code: string) =>
  api.post<{ status: 'ok' }>('/vk/login/2fa', { code }).then(r => r.data)

export const vkLogout = () =>
  api.delete('/vk/logout').then(r => r.data)