import { useState } from 'react'

export type AssassinPanelProps = {
  assassinId: string
  players: Record<string, { name: string }>
  targetIds: string[]
  onConfirm: (targetPlayerId: string) => Promise<void>
  isAssassin: boolean
}

export function AssassinPanel({
  assassinId,
  players,
  targetIds,
  onConfirm,
  isAssassin,
}: AssassinPanelProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const assassinName = players[assassinId]?.name ?? assassinId

  async function handleConfirm() {
    if (!selected || !isAssassin) return
    setSubmitting(true)
    try {
      await onConfirm(selected)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAssassin) {
    return (
      <div className="avalon-card p-6 text-center animate-scale-in avalon-card-glow-evil">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/15 flex items-center justify-center mx-auto mb-3">
          <span className="text-red-400 text-lg">⚔</span>
        </div>
        <h2 className="section-label mb-1.5 text-red-400/80">刺杀阶段</h2>
        <p className="text-slate-400 text-sm">等待刺客（{assassinName}）选择梅林</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 animate-slide-up">
      {/* Assassin Header */}
      <div className="rounded-xl p-5 bg-gradient-to-b from-red-950/30 to-transparent avalon-card-glow-evil border border-red-500/15">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/20 flex items-center justify-center">
            <span className="text-red-400">⚔</span>
          </div>
          <div>
            <h2 className="font-semibold text-red-300 text-sm">刺客：{assassinName}</h2>
            <p className="text-slate-400 text-xs mt-0.5">选择你认为的梅林</p>
          </div>
        </div>
      </div>

      {/* Target List */}
      <div className="avalon-card overflow-hidden">
        {targetIds.map((id, i) => (
          <label
            key={id}
            className={`tap-row px-4 cursor-pointer transition-colors duration-200 ${
              i < targetIds.length - 1 ? 'border-b border-white/[0.04]' : ''
            } ${selected === id ? 'bg-red-500/[0.06]' : 'active:bg-white/[0.03]'}`}
          >
            <input
              type="radio"
              name="assassin-target"
              checked={selected === id}
              onChange={() => setSelected(id)}
              className="custom-radio"
            />
            <span className={`ml-3 font-medium text-[0.9375rem] transition-colors ${
              selected === id ? 'text-white' : 'text-slate-300'
            }`}>
              {players[id]?.name ?? id}
            </span>
          </label>
        ))}
      </div>

      {/* Confirm */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selected || submitting}
        className="w-full min-h-[48px] btn-evil text-white rounded-[0.875rem] px-4 py-3 font-semibold disabled:opacity-40 text-[0.9375rem] transition-transform active:scale-[0.98]"
      >
        确认刺杀
      </button>
    </div>
  )
}
