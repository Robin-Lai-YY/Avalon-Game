import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import {
  kickPlayerFromNinjaLobby,
  setNinjaPlayerReady,
  startNinjaGame,
} from '../services/ninjaEngine'
import type { NinjaRoom } from '../types/ninja'
import { PlayerList } from '../components/PlayerList'

type NinjaLobbyPageProps = {
  roomId: string
  playerId: string
  onBack: () => void
  onRemovedFromLobby?: () => void
  onEnterGame?: () => void
}

export function NinjaLobbyPage({
  roomId,
  playerId,
  onBack,
  onRemovedFromLobby,
  onEnterGame,
}: NinjaLobbyPageProps) {
  const [room, setRoom] = useState<NinjaRoom | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [kickError, setKickError] = useState('')
  const [kickingId, setKickingId] = useState<string | null>(null)
  const wasInLobbyWithSelf = useRef(false)

  useEffect(() => {
    const roomRef = ref(db, `ninjaRooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.exists() ? (snapshot.val() as NinjaRoom) : null)
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
  const allReady =
    playerIds.length >= 4 &&
    playerIds.length <= 11 &&
    playerIds.every((id) => room?.players[id]?.ready)
  const isOdd = playerIds.length % 2 === 1
  const perHouse = Math.floor(playerIds.length / 2)

  async function handleReady() {
    setError('')
    try {
      await setNinjaPlayerReady(roomId, playerId, !myReady)
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  async function handleKick(targetId: string) {
    if (!isHost) return
    setKickError('')
    setKickingId(targetId)
    try {
      await kickPlayerFromNinjaLobby(roomId, playerId, targetId)
    } catch (e) {
      setKickError(e instanceof Error ? e.message : '踢人失败')
    } finally {
      setKickingId(null)
    }
  }

  async function handleStart() {
    if (!isHost) return
    setError('')
    setStarting(true)
    try {
      await startNinjaGame(roomId, playerId)
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
            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?game=ninja&room=${roomId}` : '')}`}
            alt="Scan to join ninja room"
            width={120}
            height={120}
            className="block rounded-lg"
          />
          <p className="text-[0.6875rem] text-slate-500 mt-2.5 tracking-wide">扫码加入忍者房间</p>
        </div>

        <div className="avalon-card p-4">
          <p className="section-label mb-2">人数与流派分配</p>
          <p className="text-sm text-slate-300">当前玩家：{playerIds.length}（需 4-11 人）</p>
          <p className="text-sm text-slate-400 mt-1">
            本局：鹤之流派 / 莲之流派各 {perHouse} 张{isOdd ? '，加 1 张浪人' : ''}
          </p>
        </div>

        <div className="avalon-card overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <h2 className="section-label">玩家列表</h2>
            <span className="text-[0.6875rem] text-slate-500">{playerIds.length} 人</span>
          </div>
          <div className="px-5 pb-4">
            {isHost && (
              <p className="text-[0.6875rem] text-slate-500 mb-2.5">房主可将占坑或离线的玩家踢出</p>
            )}
            {kickError && <p className="text-red-400/90 text-sm mb-2">{kickError}</p>}
            <PlayerList
              players={Object.fromEntries(
                playerIds.map((id) => {
                  const p = room.players[id]!
                  return [
                    id,
                    {
                      name: p.name,
                      ready: p.ready,
                      role: '',
                    },
                  ]
                })
              )}
              hostId={room.hostId}
              canKick={isHost}
              viewerPlayerId={playerId}
              onKick={handleKick}
              kickingId={kickingId}
            />
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
            {starting ? '开始中…' : allReady ? '开始游戏' : '等待 4-11 人且全员准备'}
          </button>
        )}
      </div>
    </div>
  )
}
