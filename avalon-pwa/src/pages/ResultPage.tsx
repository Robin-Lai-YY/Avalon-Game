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
  resultReason?: string
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
      <div className="min-h-dvh flex items-center justify-center p-5">
        <div className="flex gap-1.5">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      </div>
    )
  }

  const isGoodWin = room.result === 'good'
  const history = room.history ?? []
  const score = room.score ?? { good: 0, evil: 0 }
  const players = room.players ?? {}
  const playerOrder = Object.keys(players).sort()

  return (
    <div className="min-h-dvh flex flex-col px-5 pt-6 pb-10 max-w-md mx-auto animate-page-enter">
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
        <span
          className={`absolute top-0 bottom-0 w-[46%] ${
            isGoodWin
              ? 'bg-gradient-to-r from-transparent via-blue-300/14 to-transparent animate-screen-sweep-good'
              : 'bg-gradient-to-l from-transparent via-red-300/14 to-transparent animate-screen-sweep-evil'
          }`}
        />
      </div>
      {/* Victory Header */}
      <div className="text-center mb-6">
        <p className="section-label mb-3">游戏结束</p>
        <div
          className={`relative overflow-hidden rounded-2xl p-8 animate-result-reveal ${
            isGoodWin
              ? 'bg-gradient-to-b from-blue-950/40 to-transparent border border-blue-500/20 avalon-card-glow-good'
              : 'bg-gradient-to-b from-red-950/40 to-transparent border border-red-500/20 avalon-card-glow-evil animate-impact-shake'
          }`}
          style={{ backdropFilter: 'blur(16px)' }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
            <span
              className={`absolute inset-3 rounded-2xl border ${
                isGoodWin ? 'border-blue-300/30 animate-burst-good' : 'border-red-300/30 animate-burst-evil'
              }`}
            />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                className={`absolute w-1.5 h-1.5 rounded-full ${
                  isGoodWin ? 'bg-blue-300/80 animate-spark-float' : 'bg-red-300/80 animate-ember-fall'
                }`}
                style={{
                  left: `${10 + i * 12}%`,
                  bottom: isGoodWin ? '20%' : undefined,
                  top: isGoodWin ? undefined : '18%',
                  animationDelay: `${i * 90}ms`,
                }}
              />
            ))}
          </div>
          <div className={`text-5xl mb-3 ${isGoodWin ? 'animate-win-glow-good' : 'animate-win-glow-evil'}`}>
            {isGoodWin ? '⚔' : '🗡'}
          </div>
          <h1 className={`text-2xl font-bold ${isGoodWin ? 'text-blue-300' : 'text-red-300'}`}>
            {isGoodWin ? '正义获胜' : '邪恶获胜'}
          </h1>
          <p className={`mt-1.5 text-sm ${isGoodWin ? 'text-blue-400/50' : 'text-red-400/50'}`}>
            {room.resultReason === 'five_rejects'
              ? '连续 5 次否决组队，坏人自动获胜'
              : isGoodWin ? 'Good Wins' : 'Evil Wins'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 stagger-children">
        {/* Final Score */}
        <div className="avalon-card p-5">
          <h2 className="section-label mb-3">最终比分</h2>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-3xl font-bold text-blue-300">{score.good}</p>
              <p className="text-xs text-slate-500 mt-1">蓝方</p>
            </div>
            <div className="w-px h-10 bg-white/[0.06]" />
            <div className="text-center flex-1">
              <p className="text-3xl font-bold text-red-300">{score.evil}</p>
              <p className="text-xs text-slate-500 mt-1">红方</p>
            </div>
          </div>
        </div>

        {/* Vote History */}
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

        {/* Round History */}
        <div className="avalon-card p-5">
          <h2 className="section-label mb-4">回合记录</h2>
          <div className="space-y-3">
            {history.map((h, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  h.success
                    ? 'bg-emerald-500/[0.06] border border-emerald-500/10'
                    : 'bg-red-500/[0.06] border border-red-500/10'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  h.success ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                }`}>
                  {h.round}
                </div>
                <div className="flex-1">
                  <span className={`text-sm font-semibold ${h.success ? 'text-emerald-300' : 'text-red-300'}`}>
                    {h.success ? '任务成功' : '任务失败'}
                  </span>
                  {typeof h.successCount === 'number' && typeof h.failCount === 'number' && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {h.successCount} 成功 / {h.failCount} 失败
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Play Again */}
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full min-h-[48px] btn-primary px-4 py-3 font-semibold text-[0.9375rem]"
        >
          再玩一局
        </button>
      </div>
    </div>
  )
}
