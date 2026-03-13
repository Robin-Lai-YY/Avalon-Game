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
    <div className="flex flex-col gap-4">
      <p className="text-lg font-semibold">Round: {round}</p>
      <p className="text-lg font-semibold">Leader: {leaderName}</p>
      <p className="text-lg">Select Team ({teamSize})</p>
      <ul className="list-none p-0 space-y-2">
        {playerOrder.map((id) => (
          <li key={id} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`team-${id}`}
              checked={selected.has(id)}
              onChange={() => toggle(id)}
              disabled={disabled || (!selected.has(id) && selected.size >= teamSize)}
              className="w-4 h-4"
            />
            <label htmlFor={`team-${id}`} className="cursor-pointer select-none">
              {players[id]?.name ?? id}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={disabled || selected.size !== teamSize}
        className="w-full bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        Confirm Team
      </button>
    </div>
  )
}
