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
        className="w-full min-h-[44px] px-4 py-3 text-left text-sm font-medium text-slate-200 flex justify-between items-center active:bg-slate-800/80 transition-colors"
      >
        <span>投票与任务记录</span>
        <span className="text-slate-500 text-xs">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 text-sm animate-slide-up border-t border-slate-700/50">
          {teamVoteHistory.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-300 mb-1">组队投票</h4>
              <ul className="space-y-2 list-none p-0">
                {teamVoteHistory.map((tv, i) => {
                  const leaderId = playerOrder[tv.leaderIndex]
                  const leaderName = leaderId ? name(leaderId) : '—'
                  const teamNames = tv.teamIds.map(name).join('、')
                  const voteLines = playerOrder
                    .filter((id) => tv.votes[id] != null)
                    .map((id) => `${name(id)} ${tv.votes[id] === 'approve' ? '赞成' : '反对'}`)
                  return (
                    <li key={i} className="border-l-2 border-slate-600 pl-2 py-0.5">
                      <span className="text-slate-400">
                        第{tv.round}轮 · 队长 {leaderName} 提议：{teamNames}
                      </span>
                      <span className={tv.result === 'approved' ? ' text-emerald-400' : ' text-red-400'}>
                        {' '}
                        {tv.result === 'approved' ? '通过' : '否决'}
                      </span>
                      {voteLines.length > 0 && (
                        <div className="text-slate-500 mt-0.5">
                          {voteLines.join(' · ')}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {missionHistory.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-300 mb-1">任务结果与票形</h4>
              <ul className="space-y-1 list-none p-0">
                {missionHistory.map((m, i) => (
                  <li key={i} className="border-l-2 border-slate-600 pl-2 py-0.5">
                    <span className="text-slate-400">第{m.round}轮任务：</span>
                    <span className={m.success ? ' text-emerald-400 font-medium' : ' text-red-400 font-medium'}>
                      {m.success ? '成功' : '失败'}
                    </span>
                    {typeof m.successCount === 'number' && typeof m.failCount === 'number' && (
                      <span className="text-slate-500 ml-1">
                        （票形 {m.successCount} 成功 / {m.failCount} 失败）
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
