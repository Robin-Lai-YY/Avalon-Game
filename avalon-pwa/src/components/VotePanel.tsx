import { useState } from 'react'

export type VotePanelProps = {
  teamIds: string[]
  players: Record<string, { name: string }>
  myVote: 'approve' | 'reject' | null
  onVote: (vote: 'approve' | 'reject') => Promise<void>
}

export function VotePanel({
  teamIds,
  players,
  myVote,
  onVote,
}: VotePanelProps) {
  const [submitting, setSubmitting] = useState(false)
  async function handleVote(vote: 'approve' | 'reject') {
    if (myVote != null) return
    setSubmitting(true)
    try {
      await onVote(vote)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 animate-slide-up">
      {/* Proposed Team */}
      <div className="avalon-card p-5">
        <h2 className="section-label mb-3">提议队伍</h2>
        <div className="space-y-2">
          {teamIds.map((id) => (
            <div key={id} className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-300">
                  {(players[id]?.name ?? id).charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="font-medium text-slate-200 text-[0.9375rem]">{players[id]?.name ?? id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Vote Buttons */}
      <div>
        <h3 className="section-label mb-3 px-1">投票</h3>
        {myVote != null ? (
          <div className={`avalon-card p-4 text-center ${
            myVote === 'approve' ? 'avalon-card-glow-good' : 'avalon-card-glow-evil'
          }`}>
            <p className={`font-semibold text-sm ${myVote === 'approve' ? 'text-blue-300' : 'text-red-300'}`}>
              已投票：{myVote === 'approve' ? '赞成' : '反对'}
            </p>
            <p className="text-xs text-slate-500 mt-1">等待其他玩家投票</p>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleVote('approve')}
              disabled={submitting}
              className="flex-1 min-h-[52px] btn-good text-white rounded-[0.875rem] px-4 py-3 font-semibold disabled:opacity-50 text-[0.9375rem] transition-transform active:scale-[0.97]"
            >
              赞成
            </button>
            <button
              type="button"
              onClick={() => handleVote('reject')}
              disabled={submitting}
              className="flex-1 min-h-[52px] btn-evil text-white rounded-[0.875rem] px-4 py-3 font-semibold disabled:opacity-50 text-[0.9375rem] transition-transform active:scale-[0.97]"
            >
              反对
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
