import { useState, useEffect } from 'react'
import { ShieldCheck, ShieldX, LogIn, LogOut, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { getVkStatus, vkLogin, vkLogin2fa, vkLogout } from '@/api'
import type { VkStatus } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Step = 'idle' | '2fa' | 'loading'

export function VkAuthPanel() {
  const [status, setStatus] = useState<VkStatus | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [step, setStep] = useState<Step>('idle')

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const loadStatus = async () => {
    try {
      const s = await getVkStatus()
      setStatus(s)
      // Если не авторизован — раскрываем панель автоматически
      if (!s.authenticated) setExpanded(true)
    } catch {
      setStatus({ authenticated: false })
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleLogin = async () => {
    if (!login.trim() || !password.trim()) return
    setError('')
    setStep('loading')
    try {
      const res = await vkLogin(login.trim(), password)
      if (res.status === 'ok') {
        await loadStatus()
        setExpanded(false)
        setPassword('')
      } else if (res.status === '2fa_required') {
        setStep('2fa')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? e.message
        : 'Ошибка входа'
      setError(msg)
      setStep('idle')
    }
  }

  const handleSubmit2fa = async () => {
    if (!code.trim()) return
    setError('')
    setStep('loading')
    try {
      await vkLogin2fa(code.trim())
      await loadStatus()
      setExpanded(false)
      setCode('')
      setPassword('')
      setStep('idle')
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? e.message
        : 'Неверный код'
      setError(msg)
      setStep('2fa')
    }
  }

  const handleLogout = async () => {
    await vkLogout()
    setStatus({ authenticated: false })
    setExpanded(true)
    setStep('idle')
    setError('')
  }

  const isLoading = step === 'loading'

  return (
    <div className="vk-cookies-panel">
      <button
        type="button"
        className="vk-cookies-toggle"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="vk-cookies-toggle-left">
          {status?.authenticated
            ? <ShieldCheck size={14} className="text-green-500" />
            : <ShieldX size={14} className="text-muted-foreground" />
          }
          <span className="vk-cookies-toggle-text">
            {status === null
              ? 'VK: проверка...'
              : status.authenticated
                ? `VK: вошёл как ${status.login}`
                : 'VK: не авторизован'
            }
          </span>
        </span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <div className="vk-cookies-body">
          {status?.authenticated ? (
            // Залогинен
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Авторизован как <strong>{status.login}</strong>
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut size={12} />
                Выйти
              </Button>
            </div>
          ) : step === '2fa' ? (
            // Шаг 2FA
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Введи код из SMS или приложения-аутентификатора:
              </p>
              <Input
                className="h-8 text-sm"
                placeholder="Код подтверждения"
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit2fa()}
                autoFocus
                maxLength={8}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 flex-1 gap-1.5 text-xs"
                  onClick={handleSubmit2fa}
                  disabled={isLoading || !code.trim()}
                >
                  {isLoading ? 'Проверка...' : 'Подтвердить'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => { setStep('idle'); setError(''); setCode('') }}
                  disabled={isLoading}
                >
                  Назад
                </Button>
              </div>
            </div>
          ) : (
            // Шаг логина
            <div className="flex flex-col gap-3">
              <p className="vk-cookies-instruction-title">Войди в аккаунт VK:</p>
              <Input
                className="h-8 text-sm"
                placeholder="Телефон или email"
                value={login}
                onChange={e => setLogin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="username"
              />
              <div className="relative">
                <Input
                  className="h-8 text-sm pr-8"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Пароль"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleLogin}
                disabled={isLoading || !login.trim() || !password.trim()}
              >
                <LogIn size={12} />
                {isLoading ? 'Вход...' : 'Войти'}
              </Button>
              <p className="vk-cookies-note">
                Данные используются только для получения токена и хранятся локально.
                Пароль нигде не сохраняется.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}