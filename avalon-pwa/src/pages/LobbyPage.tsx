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
      <div className="min-h-screen flex items-center justify-center p-4">
        <p>Loading room…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-md mx-auto animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-blue-600 underline mb-4"
      >
        Back
      </button>
      <p className="text-lg font-mono font-semibold mb-2" data-testid="room-code">
        Room Code: {roomId}
      </p>
      <div className="mb-4 p-2 bg-white rounded inline-block">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : '')}`}
          alt="Scan to join room"
          width={120}
          height={120}
          className="block"
        />
        <p className="text-xs text-gray-600 mt-1">Scan to join</p>
      </div>
      <h2 className="text-xl font-semibold mb-2">Players</h2>
      <div className="border-t border-b border-gray-300 py-2 mb-4">
        <PlayerList players={room.players ?? {}} />
      </div>
      <button
        type="button"
        onClick={handleReady}
        className={`w-full rounded px-4 py-2 mb-4 ${myReady ? 'bg-gray-500' : 'bg-blue-600'} text-white`}
      >
        {myReady ? 'Not ready' : 'Ready'}
      </button>
      {startError && <p className="text-red-600 text-sm mb-2">{startError}</p>}
      {isHost && (
        <>
          {!allReady && notReadyNames.length > 0 && (
            <p className="text-amber-700 text-sm mb-2">等待准备：{notReadyNames.join('、')}</p>
          )}
          <p className="text-sm text-gray-600 mb-1">Host only:</p>
          <button
            type="button"
            onClick={handleStartGame}
            disabled={starting || !allReady}
            className="w-full bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {starting ? 'Starting…' : allReady ? 'Start Game' : '等待所有人准备'}
          </button>
        </>
      )}
    </div>
  )
}
