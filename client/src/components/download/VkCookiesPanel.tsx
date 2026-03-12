import { useState, useEffect, useRef } from 'react'
import { ShieldCheck, ShieldX, ShieldAlert, Upload, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { getVkCookiesStatus, uploadVkCookies, deleteVkCookies } from '@/api'
import { Button } from '@/components/ui/button'

interface VkCookiesStatus {
  has_cookies: boolean
  age_days?: number
  warning?: string | null
}

export function VkCookiesPanel() {
  const [status, setStatus] = useState<VkCookiesStatus | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadStatus = async () => {
    try {
      const s = await getVkCookiesStatus()
      setStatus(s)
    } catch {
      setStatus({ has_cookies: false })
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMessage('')
    try {
      await uploadVkCookies(file)
      setMessage('✓ Куки успешно загружены')
      await loadStatus()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки'
      setMessage('✗ ' + msg)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    await deleteVkCookies()
    setMessage('Куки удалены')
    await loadStatus()
  }

  const statusIcon = () => {
    if (!status) return null
    if (!status.has_cookies) return <ShieldX size={14} className="text-muted-foreground" />
    if (status.warning) return <ShieldAlert size={14} className="text-yellow-500" />
    return <ShieldCheck size={14} className="text-green-500" />
  }

  const statusText = () => {
    if (!status) return 'Проверка...'
    if (!status.has_cookies) return 'Куки VK не загружены'
    if (status.warning) return `Куки VK: ${status.warning}`
    return `Куки VK активны (${status.age_days} дн.)`
  }

  return (
    <div className="vk-cookies-panel">
      <button
        type="button"
        className="vk-cookies-toggle"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="vk-cookies-toggle-left">
          {statusIcon()}
          <span className="vk-cookies-toggle-text">{statusText()}</span>
        </span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <div className="vk-cookies-body">
          <div className="vk-cookies-instruction">
            <p className="vk-cookies-instruction-title">Как получить cookies.txt для VK:</p>
            <ol className="vk-cookies-steps">
              <li>
                Установи расширение{' '}
                <a
                  href="https://addons.mozilla.org/firefox/addon/export-cookies-txt/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vk-cookies-link"
                >
                  Export Cookies <ExternalLink size={10} />
                </a>{' '}
                для Firefox (рекомендуется) или аналогичное для Chrome
              </li>
              <li>Войди в аккаунт на <strong>vk.com</strong></li>
              <li>Нажми на иконку расширения и экспортируй cookies для vk.com</li>
              <li>Загрузи полученный файл <strong>cookies.txt</strong> ниже</li>
            </ol>
            <p className="vk-cookies-note">
              ⚠ Куки действуют ~2 недели. После истечения загрузи новые.
            </p>
          </div>

          <div className="vk-cookies-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={12} />
              {uploading ? 'Загрузка...' : 'Загрузить cookies.txt'}
            </Button>

            {status?.has_cookies && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 size={12} />
                Удалить куки
              </Button>
            )}
          </div>

          {message && (
            <p className={`vk-cookies-message ${message.startsWith('✓') ? 'success' : ''}`}>
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}