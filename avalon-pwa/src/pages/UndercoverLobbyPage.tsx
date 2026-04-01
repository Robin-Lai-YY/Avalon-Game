import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import {
  getRecommendedRoleCounts,
  setUndercoverPlayerReady,
  setUndercoverRoleSettings,
  startUndercoverGame,
} from '../services/undercoverEngine'
import type { UndercoverRoom } from '../types/undercover'

type UndercoverLobbyPageProps = {
  roomId: string
  playerId: string
  onBack: () => void
  onRemovedFromLobby?: () => void
  onEnterGame?: () => void
}

export function UndercoverLobbyPage({
  roomId,
  playerId,
  onBack,
  onRemovedFromLobby,
  onEnterGame,
}: UndercoverLobbyPageProps) {
  const [room, setRoom] = useState<UndercoverRoom | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [setting, setSetting] = useState(false)
  const wasInLobbyWithSelf = useRef(false)

  useEffect(() => {
    const roomRef = ref(db, `undercoverRooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.exists() ? (snapshot.val() as UndercoverRoom) : null)
    })
    return () => unsubscribe()
  }, [roomId])

  useLayoutEffect(() => {
    if (!room) {
      if (wasInLobbyWithSelf.current) {
        wasInLobbyWithSelf.current = false
        onRemovedFromLobby?.()
      }
      return
    }
    if (room.state !== 'LOBBY') {
      wasInLobbyWithSelf.current = false
      return
    }
    const me = room.players?.[playerId]
    if (me) {
      wasInLobbyWithSelf.current = true
      return
    }
    if (wasInLobbyWithSelf.current) {
      wasInLobbyWithSelf.current = false
      onRemovedFromLobby?.()
    }
  }, [room, playerId, onRemovedFromLobby])

  useEffect(() => {
    if (!room) return
    if (room.state !== 'LOBBY') onEnterGame?.()
  }, [room, onEnterGame])

  const playerIds = useMemo(() => Object.keys(room?.players ?? {}).sort(), [room?.players])
  const isHost = room?.hostId === playerId
  const myReady = room?.players?.[playerId]?.ready ?? false
  const allReady = playerIds.length >= 4 && playerIds.length <= 12 && playerIds.every((id) => room?.players[id]?.ready)
  const recommendations = getRecommendedRoleCounts(Math.max(4, playerIds.length))
  const settings = room?.roleSettings ?? {
    undercoverCount: recommendations.recommendedUndercoverCount,
    blankCount: recommendations.recommendedBlankCount,
    recommendedUndercoverCount: recommendations.recommendedUndercoverCount,
    recommendedBlankCount: recommendations.recommendedBlankCount,
  }
  const civilianCount = Math.max(playerIds.length - settings.undercoverCount - settings.blankCount, 0)

  async function handleReady() {
    setError('')
    try {
      await setUndercoverPlayerReady(roomId, playerId, !myReady)
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  async function handleSetSettings(nextUndercover: number, nextBlank: number) {
    if (!isHost) return
    setError('')
    setSetting(true)
    try {
      await setUndercoverRoleSettings(roomId, playerId, nextUndercover, nextBlank)
    } catch (e) {
      setError(e instanceof Error ? e.message : '设置失败')
    } finally {
      setSetting(false)
    }
  }

  async function handleStart() {
    if (!isHost) return
    setError('')
    setStarting(true)
    try {
      await startUndercoverGame(roomId, playerId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '开始失败')
    } finally {
      setStarting(false)
    }
  }

  if (!room) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-5">
        <div className="flex gap-1.5">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto animate-page-enter">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] flex items-center gap-1 text-slate-400 font-medium text-sm transition-colors active:text-white"
        >
          返回
        </button>
        <p className="font-mono text-sm tracking-wider text-slate-300">{roomId}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="avalon-card p-4 inline-flex flex-col items-center self-start">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?game=undercover&room=${roomId}` : '')}`}
            alt="Scan to join undercover room"
            width={120}
            height={120}
            className="block rounded-lg"
          />
          <p className="text-[0.6875rem] text-slate-500 mt-2.5 tracking-wide">扫码加入卧底房间</p>
        </div>

        <div className="avalon-card p-4">
          <p className="section-label mb-2">人数与角色设置</p>
          <p className="text-sm text-slate-300">当前玩家：{playerIds.length}（需 4-12 人）</p>
          <p className="text-sm text-slate-400 mt-1">
            推荐：卧底 {settings.recommendedUndercoverCount}，白板 {settings.recommendedBlankCount}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
              <p className="text-xs text-slate-400 mb-2">卧底人数</p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={!isHost || setting}
                  onClick={() => handleSetSettings(settings.undercoverCount - 1, settings.blankCount)}
                  className="min-h-[36px] min-w-[36px] rounded-lg bg-white/[0.06] disabled:opacity-40"
                >
                  -
                </button>
                <span className="font-semibold">{settings.undercoverCount}</span>
                <button
                  type="button"
                  disabled={!isHost || setting}
                  onClick={() => handleSetSettings(settings.undercoverCount + 1, settings.blankCount)}
                  className="min-h-[36px] min-w-[36px] rounded-lg bg-white/[0.06] disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
              <p className="text-xs text-slate-400 mb-2">白板人数</p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={!isHost || setting}
                  onClick={() => handleSetSettings(settings.undercoverCount, settings.blankCount - 1)}
                  className="min-h-[36px] min-w-[36px] rounded-lg bg-white/[0.06] disabled:opacity-40"
                >
                  -
                </button>
                <span className="font-semibold">{settings.blankCount}</span>
                <button
                  type="button"
                  disabled={!isHost || setting}
                  onClick={() => handleSetSettings(settings.undercoverCount, settings.blankCount + 1)}
                  className="min-h-[36px] min-w-[36px] rounded-lg bg-white/[0.06] disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">平民人数：{civilianCount}</p>
        </div>

        <div className="avalon-card p-4">
          <p className="section-label mb-3">玩家列表</p>
          <div className="flex flex-col gap-2">
            {playerIds.map((id) => (
              <div
                key={id}
                className="min-h-[48px] flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.06] px-3"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-200">{room.players[id]?.name ?? id}</p>
                  {id === room.hostId && <span className="badge-host">Host</span>}
                </div>
                <span className={`text-xs ${room.players[id]?.ready ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {room.players[id]?.ready ? '已准备' : '未准备'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400/90">{error}</p>}

        <button
          type="button"
          onClick={handleReady}
          className={`w-full min-h-[48px] rounded-[0.875rem] px-4 py-3 font-semibold text-white ${
            myReady ? 'bg-white/[0.06] border border-white/[0.1]' : 'btn-primary'
          }`}
        >
          {myReady ? '取消准备' : '准备'}
        </button>

        {isHost && (
          <button
            type="button"
            onClick={handleStart}
            disabled={!allReady || starting}
            className="w-full min-h-[48px] btn-success text-white rounded-[0.875rem] px-4 py-3 font-semibold disabled:opacity-40"
          >
            {starting ? '开始中…' : allReady ? '开始游戏' : '等待 4-12 人且全员准备'}
          </button>
        )}
      </div>
    </div>
  )
}
