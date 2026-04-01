import { useEffect, useState } from 'react'
import {
  createUndercoverRoom,
  joinUndercoverRoom,
  reconnectUndercoverRoom,
} from '../services/undercoverEngine'
import {
  buildUndercoverReconnectUrl,
  loadUndercoverSession,
} from '../utils/undercoverSessionStorage'

type UndercoverHomePageProps = {
  onBackToHub: () => void
  notice?: string
  onClearNotice?: () => void
  onEnterLobby: (roomId: string, playerId: string, isHost: boolean, reconnectToken?: string) => void
  onReconnect?: (roomId: string, playerId: string, isHost: boolean, state: string, reconnectToken?: string) => void
}

export function UndercoverHomePage({
  onBackToHub,
  notice,
  onClearNotice,
  onEnterLobby,
  onReconnect,
}: UndercoverHomePageProps) {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [quickReconnecting, setQuickReconnecting] = useState(false)

  const savedSession = loadUndercoverSession()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')?.trim().toUpperCase()
    if (room) setRoomCode(room)
  }, [])

  async function handleCreateRoom() {
    setError('')
    if (!name.trim()) {
      setError('请输入你的名字')
      return
    }
    setLoading(true)
    try {
      const { roomId, playerId, reconnectToken } = await createUndercoverRoom(name.trim())
      onEnterLobby(roomId, playerId, true, reconnectToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建房间失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinRoom() {
    setError('')
    const code = roomCode.trim().toUpperCase()
    if (!code) {
      setError('请输入房间码')
      return
    }
    if (!joinName.trim()) {
      setError('请输入你的名字')
      return
    }
    setLoading(true)
    try {
      const { playerId, reconnectToken } = await joinUndercoverRoom(code, joinName.trim())
      onEnterLobby(code, playerId, false, reconnectToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入房间失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleQuickReconnect() {
    if (!savedSession) return
    setQuickReconnecting(true)
    setError('')
    try {
      const recon = await reconnectUndercoverRoom(savedSession.roomId, savedSession.playerId)
      onReconnect?.(
        recon.roomId,
        recon.playerId,
        recon.isHost,
        recon.state,
        savedSession.reconnectToken
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '重连失败')
    } finally {
      setQuickReconnecting(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center px-5 pt-6 pb-12 animate-page-enter">
      <div className="w-full max-w-sm mb-4">
        <button
          type="button"
          onClick={onBackToHub}
          className="min-h-[40px] rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2 text-xs font-medium text-slate-300/90 transition-colors active:bg-white/[0.08]"
        >
          ← 返回游戏大厅
        </button>
      </div>

      <div className="text-center mb-6">
        <p className="section-label mb-2">谁是卧底</p>
        <h1 className="text-3xl font-bold tracking-tight text-white/95">联机裁判系统</h1>
        <p className="mt-2 text-sm text-slate-400">开房后就能玩，发言线下进行，投票在这里完成。</p>
      </div>

      {notice && (
        <div className="w-full max-w-sm mb-4 rounded-xl border border-amber-500/20 bg-amber-950/30 p-3.5 text-sm text-amber-100/90 flex gap-2 items-start animate-slide-down">
          <span className="flex-1">{notice}</span>
          {onClearNotice && (
            <button type="button" onClick={onClearNotice} className="shrink-0 text-amber-300/80 font-medium text-xs">
              关闭
            </button>
          )}
        </div>
      )}

      {savedSession && (
        <div className="w-full max-w-sm mb-5 avalon-card avalon-card-glow-good p-4 animate-scale-in">
          <p className="text-sm font-medium text-slate-200">你有进行中的卧底对局</p>
          <p className="text-[0.75rem] text-slate-400 mt-0.5 font-mono">房间 {savedSession.roomId}</p>
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
                const url = buildUndercoverReconnectUrl(savedSession.roomId, savedSession.reconnectToken!)
                navigator.clipboard
                  .writeText(url)
                  .then(() => setError('已复制重连链接'))
                  .catch(() => prompt('复制此链接回到游戏：', url))
              }}
              className="w-full mt-2 min-h-[40px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 text-xs font-medium transition-colors active:bg-white/[0.08]"
            >
              复制我的重连链接
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="w-full max-w-sm mb-4 text-center animate-fail-shake" key={error}>
          <p className="text-red-400/90 text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <div className="avalon-card p-5 flex flex-col gap-3">
          <p className="section-label">创建房间</p>
          <input
            type="text"
            placeholder="你的名字"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-glass"
          />
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={loading}
            className="min-h-[48px] btn-primary px-4 py-3 font-semibold disabled:opacity-50 text-[0.9375rem]"
          >
            创建卧底房间
          </button>
        </div>

        <div className="divider" />

        <div className="avalon-card p-5 flex flex-col gap-3">
          <p className="section-label">加入房间</p>
          <input
            type="text"
            placeholder="房间码（如 U8K2PQ）"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="input-glass font-mono uppercase tracking-widest"
            maxLength={6}
          />
          <input
            type="text"
            placeholder="你的名字"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            className="input-glass"
          />
          <button
            type="button"
            onClick={handleJoinRoom}
            disabled={loading}
            className="min-h-[48px] btn-success px-4 py-3 font-semibold text-white rounded-[0.875rem] disabled:opacity-50 text-[0.9375rem]"
          >
            加入卧底房间
          </button>
        </div>
      </div>
    </div>
  )
}
