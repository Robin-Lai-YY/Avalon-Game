import { useEffect, useRef, useState } from 'react'
import {
  createNinjaRoom,
  joinNinjaRoom,
  reclaimNinjaSeatByName,
  reconnectNinjaRoom,
} from '../services/ninjaEngine'
import { buildNinjaReconnectUrl, loadNinjaSession } from '../utils/ninjaSessionStorage'

type ReclaimPrompt = {
  roomId: string
  name: string
  candidateName: string
  offline: boolean
}

type NinjaHomePageProps = {
  onBackToHub: () => void
  notice?: string
  onClearNotice?: () => void
  onEnterLobby: (
    roomId: string,
    playerId: string,
    isHost: boolean,
    reconnectToken?: string,
    seatGeneration?: number
  ) => void
  onReconnect?: (
    roomId: string,
    playerId: string,
    isHost: boolean,
    state: string,
    reconnectToken?: string,
    seatGeneration?: number
  ) => void
}

function readInviteRoomFromUrl(): string | null {
  const room = new URLSearchParams(window.location.search).get('room')?.trim().toUpperCase()
  return room || null
}

export function NinjaHomePage({
  onBackToHub,
  notice,
  onClearNotice,
  onEnterLobby,
  onReconnect,
}: NinjaHomePageProps) {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [quickReconnecting, setQuickReconnecting] = useState(false)
  const [reclaimPrompt, setReclaimPrompt] = useState<ReclaimPrompt | null>(null)
  const [inviteRoom] = useState<string | null>(() => readInviteRoomFromUrl())
  const joinNameRef = useRef<HTMLInputElement>(null)

  const isInviteJoin = Boolean(inviteRoom)
  const savedSession = loadNinjaSession()
  const showQuickReconnect =
    Boolean(savedSession) && (!isInviteJoin || savedSession?.roomId === inviteRoom)

  useEffect(() => {
    if (inviteRoom) {
      setRoomCode(inviteRoom)
      return
    }
    const room = readInviteRoomFromUrl()
    if (room) setRoomCode(room)
  }, [inviteRoom])

  useEffect(() => {
    if (!isInviteJoin) return
    const t = window.setTimeout(() => joinNameRef.current?.focus(), 100)
    return () => window.clearTimeout(t)
  }, [isInviteJoin])

  async function handleCreateRoom() {
    setError('')
    setReclaimPrompt(null)
    if (!name.trim()) {
      setError('请输入你的名字')
      return
    }
    setLoading(true)
    try {
      const { roomId, playerId, reconnectToken, seatGeneration } = await createNinjaRoom(name.trim())
      onEnterLobby(roomId, playerId, true, reconnectToken, seatGeneration)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建房间失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinRoom() {
    setError('')
    setReclaimPrompt(null)
    const code = (isInviteJoin ? inviteRoom : roomCode)?.trim().toUpperCase() ?? ''
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
      const result = await joinNinjaRoom(code, joinName.trim())
      if ('needsReclaim' in result && result.needsReclaim) {
        setReclaimPrompt({
          roomId: code,
          name: joinName.trim(),
          candidateName: result.candidateName,
          offline: result.offline,
        })
        return
      }
      if (result.rejoined && onReconnect) {
        onReconnect(
          code,
          result.playerId,
          result.isHost,
          result.state,
          result.reconnectToken,
          result.seatGeneration
        )
      } else {
        onEnterLobby(code, result.playerId, result.isHost, result.reconnectToken, result.seatGeneration)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入房间失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmReclaim() {
    if (!reclaimPrompt) return
    setLoading(true)
    setError('')
    try {
      const recon = await reclaimNinjaSeatByName(reclaimPrompt.roomId, reclaimPrompt.name, { force: true })
      setReclaimPrompt(null)
      onReconnect?.(
        reclaimPrompt.roomId,
        recon.playerId,
        recon.isHost,
        recon.state,
        recon.reconnectToken,
        recon.seatGeneration
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '认领座位失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleQuickReconnect() {
    if (!savedSession) return
    setQuickReconnecting(true)
    setError('')
    try {
      const recon = await reconnectNinjaRoom(savedSession.roomId, savedSession.playerId)
      onReconnect?.(
        recon.roomId,
        recon.playerId,
        recon.isHost,
        recon.state,
        recon.reconnectToken ?? savedSession.reconnectToken,
        recon.seatGeneration
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
        <p className="section-label mb-2">忍者之夜</p>
        {isInviteJoin ? (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white/95">加入房间</h1>
            <p className="mt-2 font-mono text-lg tracking-wider text-emerald-300/90">{inviteRoom}</p>
            <p className="mt-2 text-sm text-slate-400">输入你的名字即可进房；若曾掉线请用原来的昵称。</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-white/95">阵营推理与暗杀</h1>
            <p className="mt-2 text-sm text-slate-400">轮抽忍者牌、暗夜行动、为你的流派斩杀敌人。</p>
          </>
        )}
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

      {reclaimPrompt && (
        <div className="w-full max-w-sm mb-5 avalon-card border border-sky-400/25 p-4 animate-scale-in">
          <p className="text-sm font-medium text-slate-100">
            房间里已有「{reclaimPrompt.candidateName}」
          </p>
          <p className="mt-1.5 text-[0.8125rem] text-slate-400 leading-relaxed">
            {reclaimPrompt.offline
              ? '该座位看起来已离线。若这是你，可以回到原座位。'
              : '该座位似乎仍在线。若刚才是你被挤出或换了微信页面，可确认认领；否则请换个名字。'}
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleConfirmReclaim()}
            className="w-full mt-3 min-h-[44px] rounded-xl btn-primary px-4 py-2.5 font-semibold disabled:opacity-50 text-sm"
          >
            {reclaimPrompt.offline ? '回到座位（离线）' : '确定是我，回到座位'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setReclaimPrompt(null)}
            className="w-full mt-2 min-h-[40px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 text-xs font-medium"
          >
            换个名字
          </button>
        </div>
      )}

      {showQuickReconnect && savedSession && (
        <div className="w-full max-w-sm mb-5 avalon-card avalon-card-glow-good p-4 animate-scale-in">
          <p className="text-sm font-medium text-slate-200">你有进行中的忍者之夜对局</p>
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
                const url = buildNinjaReconnectUrl(savedSession.roomId, savedSession.reconnectToken!)
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
        {isInviteJoin ? (
          <div className="avalon-card p-5 flex flex-col gap-3">
            <p className="section-label">你的名字</p>
            <input
              ref={joinNameRef}
              type="text"
              placeholder="输入昵称后加入"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleJoinRoom()
              }}
              className="input-glass"
              autoComplete="nickname"
            />
            <button
              type="button"
              onClick={handleJoinRoom}
              disabled={loading}
              className="min-h-[48px] btn-success px-4 py-3 font-semibold text-white rounded-[0.875rem] disabled:opacity-50 text-[0.9375rem]"
            >
              {loading ? '加入中…' : '加入忍者房间'}
            </button>
          </div>
        ) : (
          <>
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
                创建忍者房间
              </button>
            </div>

            <div className="divider" />

            <div className="avalon-card p-5 flex flex-col gap-3">
              <p className="section-label">加入房间</p>
              <input
                type="text"
                placeholder="房间码（如 N3K9PQ）"
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
                加入忍者房间
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
