export type Player = {
  name: string
  ready: boolean
  role: string
}

type PlayerListProps = {
  players: Record<string, Player>
  /** When set with hostId, shows 房主 badge next to that player */
  hostId?: string
  /** Viewer is host: show kick for other players */
  canKick?: boolean
  viewerPlayerId?: string
  onKick?: (targetPlayerId: string) => void
  kickingId?: string | null
}

export function PlayerList({
  players,
  hostId,
  canKick = false,
  viewerPlayerId,
  onKick,
  kickingId = null,
}: PlayerListProps) {
  const ids = Object.keys(players ?? {}).sort()
  return (
    <ul className="list-none p-0 space-y-2">
      {ids.map((id) => {
        const p = players[id]!
        const isSelf = viewerPlayerId != null && id === viewerPlayerId
        const showKickBtn = canKick && onKick && viewerPlayerId != null && id !== viewerPlayerId
        return (
          <li key={id} className="flex items-center justify-between gap-2 min-h-[44px]">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-medium text-gray-800 truncate">{p.name}</span>
              {hostId != null && id === hostId && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">房主</span>
              )}
              {isSelf && (
                <span className="text-xs text-gray-500">（我）</span>
              )}
              {p.ready && <span aria-hidden className="text-green-600">✔</span>}
            </div>
            {showKickBtn && (
              <button
                type="button"
                onClick={() => onKick(id)}
                disabled={kickingId != null}
                className="shrink-0 min-h-[40px] px-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 active:bg-red-100 disabled:opacity-50"
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
