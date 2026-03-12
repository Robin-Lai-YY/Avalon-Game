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
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Assassin Phase</h2>
        <p className="text-gray-600">Waiting for the Assassin ({assassinName}) to choose.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Assassin: {assassinName}</h2>
      <p className="text-lg">Choose Merlin</p>
      <ul className="list-none p-0 space-y-2">
        {targetIds.map((id) => (
          <li key={id}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="assassin-target"
                checked={selected === id}
                onChange={() => setSelected(id)}
                className="w-4 h-4"
              />
              {players[id]?.name ?? id}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selected || submitting}
        className="w-full bg-red-600 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        Confirm Kill
      </button>
    </div>
  )
}
