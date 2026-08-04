import { isPlayerOffline } from '../services/presence'

export type Player = {
  name: string
  ready: boolean
  role: string
  lastSeen?: number
}

type PlayerListProps = {
  players: Record<string, Player>
  hostId?: string
  canKick?: boolean
  viewerPlayerId?: string
  onKick?: (targetPlayerId: string) => void
  kickingId?: string | null
  /** When true, show offline badge based on lastSeen. */
  showPresence?: boolean
}

export function PlayerList({
  players,
  hostId,
  canKick = false,
  viewerPlayerId,
  onKick,
  kickingId = null,
  showPresence = true,
}: PlayerListProps) {
  const ids = Object.keys(players ?? {}).sort()
  return (
    <ul className="list-none p-0 space-y-1 stagger-children">
      {ids.map((id) => {
        const p = players[id]!
        const isSelf = viewerPlayerId != null && id === viewerPlayerId
        const showKickBtn = canKick && onKick && viewerPlayerId != null && id !== viewerPlayerId
        const offline = showPresence && !isSelf && isPlayerOffline(p.lastSeen)
        return (
          <li
            key={id}
            className={`flex items-center justify-between gap-2 min-h-[48px] px-3 py-2 rounded-xl transition-colors duration-200 ${
              isSelf ? 'bg-white/[0.03]' : ''
            }`}
          >
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  p.ready
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'bg-white/[0.04] text-slate-400 border border-white/[0.08]'
                } transition-all duration-300 ${offline ? 'opacity-50' : ''}`}
              >
                {p.ready ? '✓' : p.name.charAt(0).toUpperCase()}
              </div>
              <span
                className={`font-medium truncate text-[0.9375rem] ${
                  offline ? 'text-slate-500' : 'text-slate-200'
                }`}
              >
                {p.name}
              </span>
              {hostId != null && id === hostId && <span className="badge-host">房主</span>}
              {isSelf && <span className="text-[0.6875rem] text-slate-500">（我）</span>}
              {offline && (
                <span className="text-[0.6875rem] rounded-md border border-slate-500/30 bg-slate-500/10 px-1.5 py-0.5 text-slate-400">
                  离线
                </span>
              )}
            </div>
            {showKickBtn && (
              <button
                type="button"
                onClick={() => onKick(id)}
                disabled={kickingId != null}
                className="shrink-0 min-h-[36px] px-3 rounded-lg text-xs font-medium bg-red-500/[0.08] text-red-400/80 border border-red-500/15 active:bg-red-500/15 disabled:opacity-50 transition-colors"
              >
                {kickingId === id ? '…' : '踢出'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
