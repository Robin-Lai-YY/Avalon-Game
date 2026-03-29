import { useEffect, useState } from 'react'
import { createRoom, joinRoom, reconnectRoom } from '../services/gameEngine'
import { loadSession } from '../utils/sessionStorage'

type HomePageProps = {
  notice?: string
  onClearNotice?: () => void
  showRestoreBanner?: boolean
  onRetryRestore?: () => void | Promise<void>
  onEnterLobby: (roomId: string, playerId: string, isHost: boolean) => void
  onReconnect?: (roomId: string, playerId: string, isHost: boolean, state: string) => void
}

export function HomePage({
  notice,
  onClearNotice,
  showRestoreBanner,
  onRetryRestore,
  onEnterLobby,
  onReconnect,
}: HomePageProps) {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')?.trim().toUpperCase()
    if (room) setRoomCode(room)
  }, [])

  async function handleCreateRoom() {
    setError('')
    if (!name.trim()) {
      setError('Enter your name')
      return
    }
    setLoading(true)
    try {
      const { roomId, hostId } = await createRoom(name.trim())
      onEnterLobby(roomId, hostId, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinRoom() {
    setError('')
    const code = roomCode.trim().toUpperCase()
    if (!code) {
      setError('Enter room code')
      return
    }
    if (!joinName.trim()) {
      setError('Enter your name')
      return
    }
    setLoading(true)
    try {
      const { playerId } = await joinRoom(code, joinName.trim())
      onEnterLobby(code, playerId, false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to join room'
      if (msg === 'Game has already started' && onReconnect) {
        const session = loadSession()
        if (session?.roomId === code && session?.playerId) {
          try {
            const recon = await reconnectRoom(code, session.playerId)
            onReconnect(recon.roomId, recon.playerId, recon.isHost, recon.state)
            return
          } catch {
            setError('游戏已开始。若你刚掉线，请刷新页面自动恢复；否则无法加入已开始的对局。')
            return
          }
        }
        setError('游戏已开始。若你刚掉线，请刷新页面自动恢复；否则无法加入已开始的对局。')
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const base = import.meta.env.BASE_URL
  const coverSrc = `${base.endsWith('/') ? base : `${base}/`}app-cover.png`

  return (
    <div className="min-h-dvh flex flex-col items-center px-5 pt-6 pb-12 animate-page-enter">
      {/* Hero Cover */}
      <div className="w-full max-w-lg mx-auto shrink-0 mb-8">
        <div className="relative rounded-2xl overflow-hidden">
          <div className="relative w-full aspect-[2/1] max-h-[min(44vh,340px)]">
            <img
              src={coverSrc}
              alt="Avalon"
              className="hero-cover-img absolute inset-0 h-full w-full object-cover object-center"
              width={1024}
              height={512}
              decoding="async"
              fetchPriority="high"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--avalon-bg)] via-[var(--avalon-bg)]/40 to-transparent"
              aria-hidden
            />
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h1 className="text-4xl font-bold tracking-tight text-white/95">
          Avalon
        </h1>
        <p className="text-sm text-slate-400 mt-1.5 tracking-widest uppercase">
          组队与任务助手
        </p>
      </div>

      {/* Notices */}
      {notice && (
        <div className="w-full max-w-sm mb-4 rounded-xl border border-amber-500/20 bg-amber-950/30 backdrop-blur-sm p-3.5 text-sm text-amber-100/90 flex gap-2 items-start animate-slide-down">
          <span className="flex-1">{notice}</span>
          {onClearNotice && (
            <button type="button" onClick={onClearNotice} className="shrink-0 text-amber-300/80 font-medium text-xs uppercase tracking-wide">
              关闭
            </button>
          )}
        </div>
      )}

      {showRestoreBanner && onRetryRestore && (
        <div className="w-full max-w-sm mb-4 rounded-xl avalon-card avalon-card-glow-good p-4 text-sm text-slate-200 animate-scale-in">
          <p className="mb-3 text-slate-300/90 text-[0.8125rem] leading-relaxed">
            检测到你上次未退出的房间，但暂时无法连接。可重试恢复，或检查网络后刷新页面。
          </p>
          <button
            type="button"
            disabled={restoreLoading}
            onClick={async () => {
              setRestoreLoading(true)
              try {
                await onRetryRestore()
              } finally {
                setRestoreLoading(false)
              }
            }}
            className="w-full min-h-[44px] rounded-xl btn-primary px-4 py-2.5 font-semibold disabled:opacity-50 text-sm"
          >
            {restoreLoading ? '连接中…' : '重试回到房间'}
          </button>
        </div>
      )}

      {error && (
        <div className="w-full max-w-sm mb-4 text-center animate-fail-shake">
          <p className="text-red-400/90 text-sm">{error}</p>
        </div>
      )}

      {/* Cards */}
      <div className="flex flex-col gap-4 w-full max-w-sm stagger-children" style={{ animationDelay: '150ms' }}>
        {/* Create Room */}
        <div className="avalon-card p-5 flex flex-col gap-3">
          <p className="section-label">创建房间</p>
          <input
            type="text"
            placeholder="你的名字"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-glass"
            aria-label="Your name for create"
          />
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={loading}
            className="min-h-[48px] btn-primary px-4 py-3 font-semibold disabled:opacity-50 text-[0.9375rem]"
          >
            创建房间
          </button>
        </div>

        <div className="divider" />

        {/* Join Room */}
        <div className="avalon-card p-5 flex flex-col gap-3">
          <p className="section-label">加入房间</p>
          <input
            type="text"
            placeholder="房间码"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="input-glass font-mono uppercase tracking-widest"
            aria-label="Room code"
            maxLength={6}
          />
          <input
            type="text"
            placeholder="你的名字"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            className="input-glass"
            aria-label="Your name for join"
          />
          <button
            type="button"
            onClick={handleJoinRoom}
            disabled={loading}
            className="min-h-[48px] btn-success px-4 py-3 font-semibold text-white rounded-[0.875rem] disabled:opacity-50 text-[0.9375rem]"
          >
            加入房间
          </button>
        </div>
      </div>
    </div>
  )
}
