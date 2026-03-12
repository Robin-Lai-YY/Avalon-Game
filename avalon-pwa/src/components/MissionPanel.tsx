import { useState } from 'react'

export type MissionPanelProps = {
  /** Whether the current player is on the mission (can vote) */
  isOnMission: boolean
  /** Current player's mission vote if already cast */
  myVote: 'success' | 'fail' | null
  /** If false, only Success is allowed (good players). If true, both Success and Fail (evil). */
  canVoteFail: boolean
  /** Called when mission member submits their vote */
  onVote: (vote: 'success' | 'fail') => Promise<void>
}

export function MissionPanel({
  isOnMission,
  myVote,
  canVoteFail,
  onVote,
}: MissionPanelProps) {
  const [submitting, setSubmitting] = useState(false)

  async function handleVote(vote: 'success' | 'fail') {
    if (!isOnMission || myVote != null) return
    setSubmitting(true)
    try {
      await onVote(vote)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOnMission) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Mission Members Only</h2>
        <p className="text-gray-600">You are not on this mission. Wait for mission members to vote.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Mission Members Only</h2>
      <p className="text-lg">Choose Mission Result</p>
      {myVote != null ? (
        <p className="text-gray-600">You voted: {myVote === 'success' ? 'Success' : 'Fail'}</p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleVote('success')}
            disabled={submitting}
            className="flex-1 bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            Success
          </button>
          {canVoteFail ? (
            <button
              type="button"
              onClick={() => handleVote('fail')}
              disabled={submitting}
              className="flex-1 bg-red-600 text-white rounded px-4 py-2 disabled:opacity-50"
            >
              Fail
            </button>
          ) : (
            <p className="text-gray-500 text-sm self-center">Good can only vote Success</p>
          )}
        </div>
      )}
    </div>
  )
}
