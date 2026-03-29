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
      <div className="avalon-card p-5 text-center">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">本轮未出任务</h2>
        <p className="text-slate-400">等待任务成员投票。</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold text-slate-300">选择任务结果</h2>
      {myVote != null ? (
        <p className="text-slate-400 font-medium">你已投：{myVote === 'success' ? '成功' : '失败'}</p>
      ) : (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleVote('success')}
            disabled={submitting}
            className="flex-1 min-h-[48px] bg-emerald-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
          >
            成功
          </button>
          {canVoteFail ? (
            <button
              type="button"
              onClick={() => handleVote('fail')}
              disabled={submitting}
              className="flex-1 min-h-[48px] bg-red-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
            >
              失败
            </button>
          ) : (
            <p className="text-slate-500 text-sm self-center py-2">好人只能投成功</p>
          )}
        </div>
      )}
    </div>
  )
}
