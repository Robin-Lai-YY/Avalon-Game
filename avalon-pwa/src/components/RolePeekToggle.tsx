import { useState } from 'react'
import { getVisiblePlayerIds } from '../services/gameEngine'

export type RolePeekToggleProps = {
  room: { roles?: Record<string, string>; players?: Record<string, { name: string }> }
  playerId: string
}

/** In-game peek: click to show role and visible players, click again to hide (avoid others seeing). */
export function RolePeekToggle({ room, playerId }: RolePeekToggleProps) {
  const [open, setOpen] = useState(false)
  const roles = room.roles ?? {}
  const players = room.players ?? {}
  const myRole = roles[playerId] ?? ''
  const visibleIds = myRole ? getVisiblePlayerIds(myRole, roles, playerId) : []
  const visibleEntries = visibleIds.map((id) => ({ id, name: players[id]?.name ?? id }))

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-gray-600 underline hover:text-gray-800"
      >
        {open ? '隐藏身份/视角' : '查看身份/视角'}
      </button>
      {open && (
        <div className="mt-2 rounded border border-gray-300 bg-gray-50 p-3 text-sm">
          <p className="font-semibold">身份：{myRole || '—'}</p>
          <p className="mt-1 font-semibold">可见玩家：</p>
          <ul className="list-none pl-0 mt-0">
            {visibleEntries.length > 0 ? (
              visibleEntries.map(({ id, name }) => <li key={id}>{name}</li>)
            ) : (
              <li className="text-gray-500">无</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
