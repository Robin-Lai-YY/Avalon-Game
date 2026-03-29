import { useState } from 'react'

export type TeamVoteRecord = {
  round: number
  leaderIndex: number
  teamIds: string[]
  votes: Record<string, 'approve' | 'reject'>
  result: 'approved' | 'rejected'
}

export type MissionRecord = {
  round: number
  success: boolean
  successCount?: number
  failCount?: number
}

type VoteHistoryPanelProps = {
  teamVoteHistory: TeamVoteRecord[]
  missionHistory: MissionRecord[]
  players: Record<string, { name: string }>
  playerOrder: string[]
}

export function VoteHistoryPanel({
  teamVoteHistory,
  missionHistory,
  players,
  playerOrder,
}: VoteHistoryPanelProps) {
  const [open, setOpen] = useState(false)
  if (teamVoteHistory.length === 0 && missionHistory.length === 0) return null

  function name(id: string) {
    return players[id]?.name ?? id.slice(0, 8)
  }

  return (
    <div className="avalon-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[44px] px-5 py-3 text-left flex justify-between items-center transition-colors active:bg-white/[0.03]"
      >
        <span className="text-sm font-medium text-slate-300">投票与任务记录</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className={`text-slate-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 space-y-5 text-sm animate-slide-up border-t border-white/[0.04]">
          {teamVoteHistory.length > 0 && (
            <div>
              <h4 className="section-label mb-2.5">组队投票</h4>
              <div className="space-y-2.5">
                {teamVoteHistory.map((tv, i) => {
                  const leaderId = playerOrder[tv.leaderIndex]
                  const leaderName = leaderId ? name(leaderId) : '—'
                  const teamNames = tv.teamIds.map(name).join('、')
                  const voteLines = playerOrder
                    .filter((id) => tv.votes[id] != null)
                    .map((id) => `${name(id)} ${tv.votes[id] === 'approve' ? '赞成' : '反对'}`)
                  const approved = tv.result === 'approved'
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        approved ? 'border-emerald-500/10 bg-emerald-500/[0.03]' : 'border-red-500/10 bg-red-500/[0.03]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-slate-400 text-[0.8125rem]">
                          第{tv.round}轮 · {leaderName} → {teamNames}
                        </span>
                        <span className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${
                          approved ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                        }`}>
                          {approved ? '通过' : '否决'}
                        </span>
                      </div>
                      {voteLines.length > 0 && (
                        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                          {voteLines.join(' · ')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {missionHistory.length > 0 && (
            <div>
              <h4 className="section-label mb-2.5">任务结果</h4>
              <div className="space-y-2">
                {missionHistory.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                      m.success ? 'border-emerald-500/10 bg-emerald-500/[0.03]' : 'border-red-500/10 bg-red-500/[0.03]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                      m.success ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {m.round}
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${m.success ? 'text-emerald-300' : 'text-red-300'}`}>
                        {m.success ? '成功' : '失败'}
                      </span>
                      {typeof m.successCount === 'number' && typeof m.failCount === 'number' && (
                        <span className="text-slate-500 text-xs ml-2">
                          {m.successCount}成功 / {m.failCount}失败
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
