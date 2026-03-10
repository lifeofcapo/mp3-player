import { useState } from 'react'
import {
  Music2, ListMusic, Plus, Trash2,
  Sun, Moon, Sparkles, TreePine,
  Download, ChevronRight
} from 'lucide-react'
import { usePlayerStore } from '@/store/playerStore'
import type { Theme, Playlist } from '@/types'
import { createPlaylist, deletePlaylist, getPlaylists } from '@/api'

interface SidebarProps {
  playlists: Playlist[]
  onPlaylistsChange: () => void
  onSelectPlaylist: (id: number | null) => void
  activePlaylistId: number | null
  onShowDownloads: () => void
}

const themes: { id: Theme; label: string; icon: React.ReactNode }[] = [
  { id: 'dark', label: 'Dark', icon: <Moon size={14} /> },
  { id: 'light', label: 'Light', icon: <Sun size={14} /> }
]

export function Sidebar({ playlists, onPlaylistsChange, onSelectPlaylist, activePlaylistId, onShowDownloads }: SidebarProps) {
  const { theme, setTheme } = usePlayerStore()
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreateInput, setShowCreateInput] = useState(false)

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return
    setCreating(true)
    try {
      await createPlaylist(newPlaylistName.trim())
      setNewPlaylistName('')
      setShowCreateInput(false)
      onPlaylistsChange()
    } finally {
      setCreating(false)
    }
  }

  const handleDeletePlaylist = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    await deletePlaylist(id)
    if (activePlaylistId === id) onSelectPlaylist(null)
    onPlaylistsChange()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Music2 size={20} />
        </div>
        <span className="sidebar-logo-text">Universe<span>Play</span></span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-nav-item ${activePlaylistId === null ? 'active' : ''}`}
          onClick={() => onSelectPlaylist(null)}
        >
          <Music2 size={16} />
          <span>Все треки</span>
        </button>

        <button
          className="sidebar-nav-item"
          onClick={onShowDownloads}
        >
          <Download size={16} />
          <span>Загрузки</span>
        </button>
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <div className="sidebar-section-title">
            <ListMusic size={14} />
            <span>Плейлисты</span>
          </div>
          <button
            className="sidebar-add-btn"
            onClick={() => setShowCreateInput(v => !v)}
            title="Создать плейлист"
          >
            <Plus size={14} />
          </button>
        </div>

        {showCreateInput && (
          <div className="sidebar-create-input">
            <input
              autoFocus
              type="text"
              placeholder="Название плейлиста..."
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreatePlaylist()
                if (e.key === 'Escape') setShowCreateInput(false)
              }}
            />
            <button onClick={handleCreatePlaylist} disabled={creating || !newPlaylistName.trim()}>
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div className="sidebar-playlists">
          {playlists.length === 0 && (
            <p className="sidebar-empty">Нет плейлистов</p>
          )}
          {playlists.map(pl => (
            <div
              key={pl.id}
              className={`sidebar-playlist-item ${activePlaylistId === pl.id ? 'active' : ''}`}
              onClick={() => onSelectPlaylist(pl.id)}
            >
              <div className="sidebar-playlist-info">
                <span className="sidebar-playlist-name">{pl.name}</span>
                <span className="sidebar-playlist-count">{pl.track_count} треков</span>
              </div>
              <button
                className="sidebar-playlist-delete"
                onClick={e => handleDeletePlaylist(e, pl.id)}
                title="Удалить"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-themes">
        <p className="sidebar-themes-label">Тема</p>
        <div className="sidebar-themes-grid">
          {themes.map(t => (
            <button
              key={t.id}
              className={`theme-btn theme-btn-${t.id} ${theme === t.id ? 'active' : ''}`}
              onClick={() => setTheme(t.id)}
              title={t.label}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}