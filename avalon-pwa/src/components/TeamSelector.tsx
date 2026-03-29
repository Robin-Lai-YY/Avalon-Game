import { useEffect, useState } from 'react'

export type TeamSelectorProps = {
  playerOrder: string[]
  players: Record<string, { name: string }>
  leaderIndex: number
  round: number
  teamSize: number
  onConfirm: (selectedIds: string[]) => void
  disabled?: boolean
  consecutiveRejects?: number
}

export function TeamSelector({
  playerOrder,
  players,
  leaderIndex,
  round,
  teamSize,
  onConfirm,
  disabled = false,
  consecutiveRejects = 0,
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
    <div className="flex flex-col gap-5 animate-slide-up">
      {/* Round Info */}
      <div className="avalon-card p-5 avalon-card-glow-good">
        <div>
          <p className="section-label mb-1">回合</p>
          <p className="text-xl font-bold text-white">第 {round} 轮</p>
        </div>
        <div className="divider my-3" />
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-glow-breathe" />
          <span className="text-sm text-slate-300">队长：<span className="font-semibold text-white">{leaderName}</span></span>
        </div>
        {/* Consecutive rejection tracker */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[0.6875rem] text-slate-500">连续否决：</span>
          <div className="flex gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded flex items-center justify-center text-[0.625rem] font-bold transition-all duration-300 ${
                  i < consecutiveRejects
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-white/[0.03] text-slate-600 border border-white/[0.06]'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          {consecutiveRejects >= 4 && (
            <span className="text-[0.6875rem] text-red-400/80 font-medium animate-glow-breathe ml-1">
              危险！
            </span>
          )}
        </div>
      </div>

      {/* Player Selection — same inset on all sides: card p-5 + row p-3.5 (symmetric) */}
      <div>
        <p className="section-label mb-3">
          选择任务队伍
          <span className="text-slate-500 ml-1.5 normal-case">（{selected.size}/{teamSize}）</span>
        </p>
        <div className="avalon-card p-5">
          <div className="flex flex-col gap-2">
            {playerOrder.map((id) => {
              const isSelected = selected.has(id)
              const isDisabled = disabled || (!isSelected && selected.size >= teamSize)
              return (
                <label
                  key={id}
                  htmlFor={`team-${id}`}
                  className={`flex min-h-[48px] items-center gap-3 rounded-xl p-3.5 cursor-pointer transition-colors duration-200 ${
                    isSelected ? 'bg-indigo-500/[0.1]' : 'bg-white/[0.02] active:bg-white/[0.05]'
                  }`}
                >
                  <input
                    type="checkbox"
                    id={`team-${id}`}
                    checked={isSelected}
                    onChange={() => toggle(id)}
                    disabled={isDisabled}
                    className="custom-checkbox"
                  />
                  <span className={`font-medium text-[0.9375rem] transition-colors min-w-0 ${
                    isSelected ? 'text-white' : 'text-slate-300'
                  }`}>
                    {players[id]?.name ?? id}
                  </span>
                  {id === leaderId && (
                    <span className="ml-auto shrink-0 pl-2 text-[0.625rem] text-indigo-400/70 font-medium uppercase tracking-wide">
                      队长
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {/* Confirm */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={disabled || selected.size !== teamSize}
        className="w-full min-h-[48px] btn-primary px-4 py-3 font-semibold disabled:opacity-40 text-[0.9375rem]"
      >
        确认队伍
      </button>
    </div>
  )
}
