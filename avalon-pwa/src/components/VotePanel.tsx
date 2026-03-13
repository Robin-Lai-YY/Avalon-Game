import { useState } from 'react'

export type VotePanelProps = {
  /** Ordered team member ids (from room.team) */
  teamIds: string[]
  /** Map of player id to display name */
  players: Record<string, { name: string }>
  /** Current player's vote if already cast */
  myVote: 'approve' | 'reject' | null
  /** Called when user submits a vote */
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
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">提议队伍</h2>
        <ul className="list-none p-0 space-y-1">
          {teamIds.map((id) => (
            <li key={id} className="font-medium text-gray-800">· {players[id]?.name ?? id}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">投票</h3>
        {myVote != null ? (
          <p className="text-gray-600 font-medium">你已投：{myVote === 'approve' ? '赞成' : '反对'}</p>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleVote('approve')}
              disabled={submitting}
              className="flex-1 min-h-[48px] bg-green-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
            >
              赞成
            </button>
            <button
              type="button"
              onClick={() => handleVote('reject')}
              disabled={submitting}
              className="flex-1 min-h-[48px] bg-red-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
            >
              反对
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
