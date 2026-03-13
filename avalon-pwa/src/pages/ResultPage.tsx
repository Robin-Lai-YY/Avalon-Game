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
      <div className="min-h-screen flex items-center justify-center p-5">
        <p className="text-gray-500">加载中…</p>
      </div>
    )
  }

  const isGoodWin = room.result === 'good'
  const history = room.history ?? []
  const score = room.score ?? { good: 0, evil: 0 }
  const players = room.players ?? {}
  const playerOrder = Object.keys(players).sort()

  return (
    <div className="min-h-screen flex flex-col p-5 max-w-md mx-auto gap-6 animate-fade-in">
      <h1 className="text-xl font-bold text-center text-gray-600 pt-2">游戏结束</h1>
      <div
        className={`rounded-2xl p-6 text-center animate-result-reveal ${
          isGoodWin ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'
        }`}
      >
        <p className={`text-2xl font-bold ${isGoodWin ? 'text-green-700' : 'text-red-700'}`}>
          {isGoodWin ? '好人赢了' : '坏人赢了'}
        </p>
        <p className={`mt-1 text-base ${isGoodWin ? 'text-green-600' : 'text-red-600'}`}>
          {isGoodWin ? 'Good wins' : 'Evil wins'}
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">最终比分</h2>
        <div className="flex justify-between text-lg">
          <span className="text-green-700 font-medium">好人 {score.good}</span>
          <span className="text-red-700 font-medium">坏人 {score.evil}</span>
        </div>
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
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">回合记录</h2>
        <ul className="list-none p-0 space-y-2">
          {history.map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 border-b border-gray-100 last:border-0">
              <span className="text-gray-700 font-medium">第 {h.round} 轮</span>
              <span className={h.success ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {h.success ? '✔ 成功' : '✗ 失败'}
              </span>
              {typeof h.successCount === 'number' && typeof h.failCount === 'number' && (
                <span className="text-gray-400 text-sm">（{h.successCount} 成功 / {h.failCount} 失败）</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onPlayAgain}
        className="w-full min-h-[48px] bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold active:opacity-90 transition-opacity"
      >
        再玩一局
      </button>
    </div>
  )
}
