import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import { setPlayerReady, startGame } from '../services/gameEngine'
import { PlayerList } from '../components/PlayerList'
import type { Player } from '../components/PlayerList'

type RoomData = {
  hostId: string
  state: string
  players: Record<string, Player>
}

type LobbyPageProps = {
  roomId: string
  playerId: string
  isHost: boolean
  onBack: () => void
  onEnterRoleReveal?: () => void
}

export function LobbyPage({ roomId, playerId, isHost, onBack, onEnterRoleReveal }: LobbyPageProps) {
  const [room, setRoom] = useState<RoomData | null>(null)
  const [startError, setStartError] = useState('')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.val())
    })
    return () => unsubscribe()
  }, [roomId])

  useEffect(() => {
    if (room?.state === 'ROLE_REVEAL') onEnterRoleReveal?.()
  }, [room?.state, onEnterRoleReveal])

  const players = room?.players ?? {}
  const playerIds = Object.keys(players).sort()
  const allReady = playerIds.length >= 5 && playerIds.every((id) => players[id]?.ready === true)
  const notReadyNames = playerIds.filter((id) => !players[id]?.ready).map((id) => players[id]?.name ?? id)
  const myReady = players[playerId]?.ready ?? false

  function handleReady() {
    setPlayerReady(roomId, playerId, !myReady).catch(() => {
      // Optionally show error toast
    })
  }

  async function handleStartGame() {
    if (!isHost) return
    setStartError('')
    setStarting(true)
    try {
      await startGame(roomId)
      // Task 15: navigate to Role Reveal page
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Failed to start game')
    } finally {
      setStarting(false)
    }
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <p className="text-gray-500">加载房间…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col p-5 max-w-md mx-auto animate-fade-in gap-6">
      <button
        type="button"
        onClick={onBack}
        className="self-start min-h-[44px] flex items-center text-blue-600 font-medium -ml-1"
      >
        ← 返回
      </button>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">房间码</p>
        <p className="text-xl font-mono font-bold" data-testid="room-code">{roomId}</p>
      </div>
      <div className="p-3 bg-white rounded-xl border border-gray-200 inline-block self-start">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : '')}`}
          alt="Scan to join room"
          width={120}
          height={120}
          className="block rounded-lg"
        />
        <p className="text-xs text-gray-500 mt-2">扫码加入</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 pb-2">玩家</h2>
        <div className="px-4 pb-4">
          <PlayerList players={room.players ?? {}} />
        </div>
      </div>
      <button
        type="button"
        onClick={handleReady}
        className={`w-full min-h-[48px] rounded-xl px-4 py-3 font-semibold ${myReady ? 'bg-gray-500' : 'bg-blue-600'} text-white active:opacity-90 transition-opacity`}
      >
        {myReady ? '取消准备' : '准备'}
      </button>
      {startError && <p className="text-red-600 text-sm">{startError}</p>}
      {isHost && (
        <>
          {!allReady && notReadyNames.length > 0 && (
            <p className="text-amber-700 text-sm">等待准备：{notReadyNames.join('、')}</p>
          )}
          <button
            type="button"
            onClick={handleStartGame}
            disabled={starting || !allReady}
            className="w-full min-h-[48px] bg-green-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
          >
            {starting ? '开始中…' : allReady ? '开始游戏' : '等待所有人准备'}
          </button>
        </>
      )}
    </div>
  )
}
