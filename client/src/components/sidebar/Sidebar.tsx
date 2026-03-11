import { useState } from 'react'
import { Music2, ListMusic, Plus, Trash2, Download } from 'lucide-react'
import type { Playlist } from '@/types'
import { createPlaylist, deletePlaylist } from '@/api'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SidebarProps {
  playlists: Playlist[]
  onPlaylistsChange: () => void
  onSelectPlaylist: (id: number | null) => void
  activePlaylistId: number | null
  onShowDownloads: () => void
}

export function Sidebar({ playlists, onPlaylistsChange, onSelectPlaylist, activePlaylistId, onShowDownloads }: SidebarProps) {
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreateInput, setShowCreateInput] = useState(false)

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim()
    if (!name) return
    setCreating(true)
    try {
      await createPlaylist(name)
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
          <Music2 size={18} />
        </div>
        <span className="sidebar-logo-text">Universe<span>Play</span></span>
      </div>

      <nav className="sidebar-nav">
        <button
          type="button"
          className={cn('sidebar-nav-item', activePlaylistId === null ? 'active' : '')}
          onClick={() => onSelectPlaylist(null)}
        >
          <Music2 size={15} />
          <span>Все треки</span>
        </button>

        <button type="button" className="sidebar-nav-item" onClick={onShowDownloads}>
          <Download size={15} />
          <span>Загрузки</span>
        </button>
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <div className="sidebar-section-title">
            <ListMusic size={12} />
            <span>Плейлисты</span>
          </div>
          <button
            type="button"
            className="sidebar-add-btn cursor-pointer"
            onClick={() => setShowCreateInput(v => !v)}
            title="Создать плейлист"
          >
            <Plus size={14} />
          </button>
        </div>

        {showCreateInput && (
          <div className="sidebar-create-input">
            <Input
              autoFocus
              className="h-7 text-xs"
              placeholder="Название плейлиста"
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreatePlaylist()
                if (e.key === 'Escape') { setShowCreateInput(false); setNewPlaylistName('') }
              }}
            />
            <button
              type="button"
              className="sidebar-create-input-btn"
              disabled={creating || !newPlaylistName.trim()}
              onClick={handleCreatePlaylist}
            >
              {creating ? '...' : 'OK'}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-0.5 mt-1">
          {playlists.map(pl => (
            <button
              type="button"
              key={pl.id}
              className={cn('sidebar-playlist-item', activePlaylistId === pl.id ? 'active' : '')}
              onClick={() => onSelectPlaylist(pl.id)}
            >
              <span className="sidebar-playlist-name">{pl.name}</span>
              <span className="sidebar-playlist-count">{pl.track_count}</span>
              <button
                type="button"
                className="sidebar-delete-btn"
                onClick={(e) => handleDeletePlaylist(e, pl.id)}
                title="Удалить плейлист"
              >
                <Trash2 size={12} />
              </button>
            </button>
          ))}

          {playlists.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">
              Нет плейлистов
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}