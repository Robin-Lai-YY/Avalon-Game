import { useEffect, useState } from 'react'
import { createRoom, joinRoom, reconnectRoom } from '../services/gameEngine'
import { buildReconnectUrl, loadSession } from '../utils/sessionStorage'

type HomePageProps = {
  onBackToHub?: () => void
  notice?: string
  onClearNotice?: () => void
  showRestoreBanner?: boolean
  onRetryRestore?: () => void | Promise<void>
  onEnterLobby: (roomId: string, playerId: string, isHost: boolean, reconnectToken?: string) => void
  onReconnect?: (roomId: string, playerId: string, isHost: boolean, state: string, reconnectToken?: string) => void
}

export function HomePage({
  onBackToHub,
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
  const [quickReconnecting, setQuickReconnecting] = useState(false)

  const savedSession = loadSession()

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
      const { roomId, hostId, reconnectToken } = await createRoom(name.trim())
      onEnterLobby(roomId, hostId, true, reconnectToken)
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
      const { playerId, reconnectToken } = await joinRoom(code, joinName.trim())
      onEnterLobby(code, playerId, false, reconnectToken)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to join room'
      if (msg === 'Game has already started' && onReconnect) {
        const session = loadSession()
        if (session?.roomId === code && session?.playerId) {
          try {
            const recon = await reconnectRoom(code, session.playerId)
            onReconnect(recon.roomId, recon.playerId, recon.isHost, recon.state, session.reconnectToken)
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

  async function handleQuickReconnect() {
    if (!savedSession) return
    setQuickReconnecting(true)
    setError('')
    try {
      const recon = await reconnectRoom(savedSession.roomId, savedSession.playerId)
      onReconnect?.(recon.roomId, recon.playerId, recon.isHost, recon.state, savedSession.reconnectToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : '重连失败')
    } finally {
      setQuickReconnecting(false)
    }
  }

  const base = import.meta.env.BASE_URL
  const coverSrc = `${base.endsWith('/') ? base : `${base}/`}app-cover.png`

  return (
    <div className="min-h-dvh flex flex-col items-center px-5 pt-6 pb-12 animate-page-enter">
      {onBackToHub && (
        <div className="w-full max-w-lg mb-4">
          <button
            type="button"
            onClick={onBackToHub}
            className="min-h-[40px] rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2 text-xs font-medium text-slate-300/90 transition-colors active:bg-white/[0.08]"
          >
            ← 返回游戏大厅
          </button>
        </div>
      )}

      {/* Hero Cover */}
      <div className="w-full max-w-lg mx-auto shrink-0 mb-8">
        <div className="relative rounded-2xl overflow-hidden">
          <div className="relative w-full aspect-[2/1] max-h-[min(44vh,340px)]">
            <img
              src={coverSrc}
              alt="谁是真的派西维尔?"
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
      <div className="text-center mb-8 animate-slide-up px-1" style={{ animationDelay: '100ms' }}>
        <h1 className="text-[1.65rem] sm:text-4xl font-bold tracking-tight text-white/95 leading-snug">
          谁是真的派西维尔?
        </h1>
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

      {/* Quick Reconnect — always visible when session exists */}
      {savedSession && (
        <div className="w-full max-w-sm mb-5 avalon-card avalon-card-glow-good p-4 animate-scale-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-blue-400">
                <path d="M2 8a6 6 0 0111.46-2.46M14 8a6 6 0 01-11.46 2.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14 2v4h-4M2 14v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">你有进行中的游戏</p>
              <p className="text-[0.75rem] text-slate-400 mt-0.5 font-mono">房间 {savedSession.roomId}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={quickReconnecting}
            onClick={handleQuickReconnect}
            className="w-full mt-3 min-h-[44px] rounded-xl btn-primary px-4 py-2.5 font-semibold disabled:opacity-50 text-sm"
          >
            {quickReconnecting ? '连接中…' : '回到房间'}
          </button>
          {savedSession.reconnectToken && (
            <button
              type="button"
              onClick={() => {
                const url = buildReconnectUrl(savedSession.roomId, savedSession.reconnectToken!)
                navigator.clipboard.writeText(url).then(() => {
                  setError('')
                  setError('已复制重连链接，发给掉线的自己或队友即可回来')
                }).catch(() => {
                  prompt('复制此链接回到游戏：', url)
                })
              }}
              className="w-full mt-2 min-h-[40px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 text-xs font-medium transition-colors active:bg-white/[0.08]"
            >
              复制我的重连链接
            </button>
          )}
        </div>
      )}

      {/* Restore banner (network failure) */}
      {showRestoreBanner && onRetryRestore && !savedSession && (
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
        <div className="w-full max-w-sm mb-4 text-center animate-fail-shake" key={error}>
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
