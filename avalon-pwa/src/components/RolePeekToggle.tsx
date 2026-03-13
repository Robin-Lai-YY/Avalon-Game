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
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="min-h-[44px] px-0 py-2 text-sm font-medium text-gray-600 active:text-gray-800"
      >
        {open ? '隐藏身份/视角' : '查看身份/视角'}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm animate-slide-up">
          <p className="font-semibold text-gray-800">身份：{myRole || '—'}</p>
          <p className="mt-2 font-semibold text-gray-700">可见玩家：</p>
          <ul className="list-none pl-0 mt-1 space-y-0.5">
            {visibleEntries.length > 0 ? (
              visibleEntries.map(({ id, name }) => <li key={id} className="text-gray-600">{name}</li>)
            ) : (
              <li className="text-gray-500">无</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
