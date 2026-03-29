import { useState } from 'react'
import { getVisiblePlayerIds, isEvilRole } from '../services/gameEngine'
import { ROLE_LABEL_ZH } from '../utils/roleLabels'

export type RolePeekToggleProps = {
  room: { roles?: Record<string, string>; players?: Record<string, { name: string }> }
  playerId: string
}

export function RolePeekToggle({ room, playerId }: RolePeekToggleProps) {
  const [open, setOpen] = useState(false)
  const roles = room.roles ?? {}
  const players = room.players ?? {}
  const myRole = roles[playerId] ?? ''
  const visibleIds = myRole ? getVisiblePlayerIds(myRole, roles, playerId) : []
  const visibleEntries = visibleIds.map((id) => ({ id, name: players[id]?.name ?? id }))
  const evil = isEvilRole(myRole)
  const roleLabel = ROLE_LABEL_ZH[myRole] ?? myRole

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          open
            ? 'bg-white/[0.06] text-slate-200'
            : 'text-slate-400 active:text-slate-200'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-50">
            {open ? (
              <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            ) : (
              <>
                <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </>
            )}
          </svg>
          {open ? '隐藏身份' : '查看身份'}
        </span>
      </button>
      {open && (
        <div className="mt-2 rounded-xl avalon-card p-4 animate-scale-in">
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${evil ? 'bg-red-400' : 'bg-blue-400'} animate-glow-breathe`} />
            <span className={`font-semibold text-sm ${evil ? 'text-red-300' : 'text-blue-300'}`}>
              {roleLabel}
            </span>
            <span className="text-[0.6875rem] text-slate-500 font-mono">{myRole}</span>
          </div>
          <div>
            <p className="text-[0.6875rem] font-medium text-slate-500 mb-1.5">可见玩家</p>
            {visibleEntries.length > 0 ? (
              <ul className="list-none pl-0 space-y-1">
                {visibleEntries.map(({ id, name }) => (
                  <li key={id} className="text-slate-300 text-sm flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-slate-500" />
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-sm">无</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
