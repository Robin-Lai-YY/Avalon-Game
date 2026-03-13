import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import { VoteHistoryPanel } from '../components/VoteHistoryPanel'

type ResultPageProps = {
  roomId: string
  onPlayAgain: () => void
}

type RoomResult = {
  result?: 'good' | 'evil'
  history?: Array<{ round: number; success: boolean; successCount?: number; failCount?: number }>
  teamVoteHistory?: Array<{
    round: number
    leaderIndex: number
    teamIds: string[]
    votes: Record<string, 'approve' | 'reject'>
    result: 'approved' | 'rejected'
  }>
  players?: Record<string, { name: string }>
  score?: { good: number; evil: number }
}

export function ResultPage({ roomId, onPlayAgain }: ResultPageProps) {
  const [room, setRoom] = useState<RoomResult | null>(null)

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.val())
    })
    return () => unsubscribe()
  }, [roomId])

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p>Loading…</p>
      </div>
    )
  }

  const winner = room.result === 'good' ? 'GOOD' : 'EVIL'
  const history = room.history ?? []
  const score = room.score ?? { good: 0, evil: 0 }
  const players = room.players ?? {}
  const playerOrder = Object.keys(players).sort()

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-md mx-auto gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-center">GAME OVER</h1>
      <p className={`text-xl font-bold text-center ${room.result === 'good' ? 'text-green-600' : 'text-red-600'}`}>
        {winner} TEAM WINS
      </p>
      <div className="border-t border-b border-gray-300 py-2">
        <p className="font-semibold">Final Score</p>
        <p>Good: {score.good}</p>
        <p>Evil: {score.evil}</p>
      </div>
      <VoteHistoryPanel
        teamVoteHistory={room.teamVoteHistory ?? []}
        missionHistory={history.map((h) => ({
          round: h.round,
          success: h.success,
          successCount: h.successCount,
          failCount: h.failCount,
        }))}
        players={players}
        playerOrder={playerOrder}
      />
      <div>
        <h2 className="text-lg font-semibold mb-2">Round History</h2>
        <ul className="list-none p-0 space-y-1">
          {history.map((h, i) => (
            <li key={i}>
              Round {h.round}: {h.success ? '✔ Success' : '✗ Fail'}
              {typeof h.successCount === 'number' && typeof h.failCount === 'number' && (
                <span className="text-gray-500 text-sm ml-1">
                  （{h.successCount} 成功 / {h.failCount} 失败）
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onPlayAgain}
        className="w-full bg-blue-600 text-white rounded px-4 py-2 mt-4"
      >
        Play Again
      </button>
    </div>
  )
}
