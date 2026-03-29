import { useState } from 'react'

export type MissionPanelProps = {
  isOnMission: boolean
  myVote: 'success' | 'fail' | null
  canVoteFail: boolean
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
      <div className="avalon-card p-6 text-center animate-scale-in">
        <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-slate-500">
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 6v4M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className="section-label mb-1.5">本轮未出任务</h2>
        <p className="text-slate-400 text-sm">等待任务成员投票</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 animate-slide-up">
      <h2 className="section-label px-1">选择任务结果</h2>
      {myVote != null ? (
        <div className={`avalon-card p-4 text-center ${
          myVote === 'success' ? 'avalon-card-glow-good' : 'avalon-card-glow-evil'
        }`}>
          <p className={`font-semibold text-sm ${myVote === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
            已投票：{myVote === 'success' ? '成功' : '失败'}
          </p>
          <p className="text-xs text-slate-500 mt-1">等待其他任务成员</p>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleVote('success')}
            disabled={submitting}
            className="flex-1 min-h-[52px] btn-success text-white rounded-[0.875rem] px-4 py-3 font-semibold disabled:opacity-50 text-[0.9375rem] transition-transform active:scale-[0.97]"
          >
            成功
          </button>
          {canVoteFail ? (
            <button
              type="button"
              onClick={() => handleVote('fail')}
              disabled={submitting}
              className="flex-1 min-h-[52px] btn-evil text-white rounded-[0.875rem] px-4 py-3 font-semibold disabled:opacity-50 text-[0.9375rem] transition-transform active:scale-[0.97]"
            >
              失败
            </button>
          ) : (
            <div className="flex-1 min-h-[52px] rounded-[0.875rem] bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <p className="text-slate-500 text-xs">好人只能投成功</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
