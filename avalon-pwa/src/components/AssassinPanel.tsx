import { useState } from 'react'

export type AssassinPanelProps = {
  /** Player id of the assassin (for display name) */
  assassinId: string
  /** All players: id -> name */
  players: Record<string, { name: string }>
  /** Player ids the assassin can choose (e.g. all except assassin) */
  targetIds: string[]
  /** Called with the selected target player id */
  onConfirm: (targetPlayerId: string) => Promise<void>
  /** Whether current user is the assassin (can choose) */
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
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">刺杀阶段</h2>
        <p className="text-gray-600">等待刺客（{assassinName}）选择梅林。</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-gray-200 bg-red-50 p-4">
        <h2 className="text-sm font-semibold text-gray-600">刺客：{assassinName}</h2>
        <p className="text-gray-700 mt-1">选择你认为的梅林</p>
      </div>
      <ul className="list-none p-0 space-y-0 rounded-xl border border-gray-200 overflow-hidden">
        {targetIds.map((id) => (
          <li key={id} className="tap-row border-b border-gray-100 last:border-0 bg-white">
            <label className="flex items-center gap-3 cursor-pointer w-full px-4">
              <input
                type="radio"
                name="assassin-target"
                checked={selected === id}
                onChange={() => setSelected(id)}
                className="w-6 h-6 flex-shrink-0"
              />
              <span className="font-medium text-gray-800">{players[id]?.name ?? id}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selected || submitting}
        className="w-full min-h-[48px] bg-red-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
      >
        确认刺杀
      </button>
    </div>
  )
}
