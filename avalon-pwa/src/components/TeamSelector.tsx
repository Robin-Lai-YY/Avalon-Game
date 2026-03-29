import { useEffect, useState } from 'react'

export type TeamSelectorProps = {
  playerOrder: string[]
  players: Record<string, { name: string }>
  leaderIndex: number
  round: number
  teamSize: number
  onConfirm: (selectedIds: string[]) => void
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
    <div className="flex flex-col gap-5 animate-slide-up">
      {/* Round Info */}
      <div className="avalon-card p-5 avalon-card-glow-good">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-label mb-1">回合</p>
            <p className="text-xl font-bold text-white">第 {round} 轮</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
            <span className="text-lg font-bold text-blue-300">{round}</span>
          </div>
        </div>
        <div className="divider my-3" />
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-glow-breathe" />
          <span className="text-sm text-slate-300">队长：<span className="font-semibold text-white">{leaderName}</span></span>
        </div>
      </div>

      {/* Player Selection */}
      <div>
        <p className="section-label mb-3 px-1">
          选择任务队伍
          <span className="text-slate-500 ml-1.5 normal-case">（{selected.size}/{teamSize}）</span>
        </p>
        <div className="avalon-card overflow-hidden">
          {playerOrder.map((id, i) => {
            const isSelected = selected.has(id)
            const isDisabled = disabled || (!isSelected && selected.size >= teamSize)
            return (
              <label
                key={id}
                htmlFor={`team-${id}`}
                className={`tap-row px-4 cursor-pointer transition-colors duration-200 ${
                  i < playerOrder.length - 1 ? 'border-b border-white/[0.04]' : ''
                } ${isSelected ? 'bg-indigo-500/[0.06]' : 'active:bg-white/[0.03]'}`}
              >
                <input
                  type="checkbox"
                  id={`team-${id}`}
                  checked={isSelected}
                  onChange={() => toggle(id)}
                  disabled={isDisabled}
                  className="custom-checkbox"
                />
                <span className={`ml-3 font-medium text-[0.9375rem] transition-colors ${
                  isSelected ? 'text-white' : 'text-slate-300'
                }`}>
                  {players[id]?.name ?? id}
                </span>
                {id === leaderId && (
                  <span className="ml-auto text-[0.625rem] text-indigo-400/60 font-medium uppercase tracking-wide">队长</span>
                )}
              </label>
            )
          })}
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
