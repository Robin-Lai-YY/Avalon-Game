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
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Team Proposed</h2>
      <ul className="list-none p-0 space-y-1">
        {teamIds.map((id) => (
          <li key={id}>{players[id]?.name ?? id}</li>
        ))}
      </ul>
      <h3 className="text-lg font-semibold mt-4">Vote</h3>
      {myVote != null ? (
        <p className="text-gray-600">You voted: {myVote === 'approve' ? 'Approve' : 'Reject'}</p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleVote('approve')}
            disabled={submitting}
            className="flex-1 bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => handleVote('reject')}
            disabled={submitting}
            className="flex-1 bg-red-600 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
