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
        className="min-h-[44px] px-0 py-2 text-sm font-medium text-slate-400 active:text-slate-200"
      >
        {open ? '隐藏身份/视角' : '查看身份/视角'}
      </button>
      {open && (
        <div className="mt-2 rounded-xl avalon-card p-4 text-sm animate-slide-up">
          <p className="font-semibold text-slate-100">身份：{myRole || '—'}</p>
          <p className="mt-2 font-semibold text-slate-400">可见玩家：</p>
          <ul className="list-none pl-0 mt-1 space-y-0.5">
            {visibleEntries.length > 0 ? (
              visibleEntries.map(({ id, name }) => (
                <li key={id} className="text-slate-300">
                  {name}
                </li>
              ))
            ) : (
              <li className="text-slate-500">无</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
