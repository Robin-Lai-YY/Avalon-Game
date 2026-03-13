import { useEffect, useState } from 'react'

export type TeamSelectorProps = {
  /** Ordered player ids (e.g. sorted). Leader is playerOrder[leaderIndex]. */
  playerOrder: string[]
  /** Map of player id to display name */
  players: Record<string, { name: string }>
  /** Index into playerOrder for the current leader */
  leaderIndex: number
  /** Current round (1-based, for display) */
  round: number
  /** Required number of players on the mission team */
  teamSize: number
  /** Called when user confirms the team; receives selected player ids */
  onConfirm: (selectedIds: string[]) => void
  /** If true, selection and confirm are disabled (e.g. not the leader) */
  disabled?: boolean
}

export function TeamSelector({
  playerOrder,
  players,
  leaderIndex,
  round,
  teamSize,
  onConfirm,
  disabled = false,
}: TeamSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const leaderId = playerOrder[leaderIndex]
  const leaderName = leaderId ? players[leaderId]?.name ?? leaderId : '—'

  useEffect(() => {
    if (disabled) setSelected(new Set())
  }, [disabled])

  function toggle(id: string) {
    if (disabled) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < teamSize) next.add(id)
      return next
    })
  }

  function handleConfirm() {
    if (selected.size !== teamSize || disabled) return
    onConfirm([...selected])
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">回合</p>
        <p className="text-xl font-bold text-gray-800">第 {round} 轮</p>
        <p className="text-sm text-gray-600 mt-1">队长：{leaderName}</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">选择任务队伍（选 {teamSize} 人）</p>
        <ul className="list-none p-0 space-y-0">
          {playerOrder.map((id) => (
            <li key={id} className="tap-row border-b border-gray-100 last:border-0">
              <label htmlFor={`team-${id}`} className="flex items-center gap-3 cursor-pointer w-full">
                <input
                  type="checkbox"
                  id={`team-${id}`}
                  checked={selected.has(id)}
                  onChange={() => toggle(id)}
                  disabled={disabled || (!selected.has(id) && selected.size >= teamSize)}
                  className="w-6 h-6 rounded border-gray-300 flex-shrink-0"
                />
                <span className="font-medium text-gray-800">{players[id]?.name ?? id}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={disabled || selected.size !== teamSize}
        className="w-full min-h-[48px] bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
      >
        确认队伍
      </button>
    </div>
  )
}
