import type { HouseCard, NinjaRoom } from '../types/ninja'
import { HouseCardLabel } from './NinjaCardView'

type NinjaSeatTableProps = {
  room: NinjaRoom
  viewerPlayerId: string
  mode: 'lobby' | 'game'
  activePlayerId?: string | null
  targetableIds?: string[]
  selectedTargetIds?: string[]
  onSeatClick?: (seatIndex: number, playerId: string | null) => void
  onTargetClick?: (playerId: string) => void
}

function getOrderedIds(room: NinjaRoom): string[] {
  const players = room.players ?? {}
  const seated = (room.seatOrder ?? []).filter((id) => !!players[id])
  const missing = Object.keys(players)
    .filter((id) => !seated.includes(id))
    .sort()
  return [...seated, ...missing]
}

function tableSize(mode: 'lobby' | 'game', seatedCount: number): number {
  if (mode === 'game') return Math.max(seatedCount, 1)
  return Math.min(11, Math.max(4, seatedCount))
}

function houseSideTone(card: HouseCard | null): string {
  if (!card) return 'text-slate-400'
  if (card.side === 'crane') return 'text-rose-100'
  if (card.side === 'lotus') return 'text-sky-100'
  return 'text-fuchsia-100'
}

function honorTokenCount(room: NinjaRoom, playerId: string): number {
  return room.players?.[playerId]?.honorTokens?.length ?? 0
}

function seatDiameter(size: number): number {
  if (size <= 5) return 82
  if (size <= 7) return 74
  if (size <= 9) return 66
  return 60
}

export function NinjaSeatTable({
  room,
  viewerPlayerId,
  mode,
  activePlayerId,
  targetableIds = [],
  selectedTargetIds = [],
  onSeatClick,
  onTargetClick,
}: NinjaSeatTableProps) {
  const players = room.players ?? {}
  const lobbyAssignments = room.seatAssignments ?? {}
  const orderedIds = mode === 'lobby' ? [] : getOrderedIds(room)
  const highestOccupiedSeat = Math.max(-1, ...Object.values(lobbyAssignments))
  const effectiveLobbySize = Math.min(
    11,
    Math.max(4, room.targetPlayerCount ?? 4, Object.keys(players).length, highestOccupiedSeat + 1)
  )
  const viewer = players[viewerPlayerId]
  const viewerCanMove = mode === 'lobby' && !!viewer && !viewer.ready
  const size = tableSize(mode, mode === 'lobby' ? effectiveLobbySize : orderedIds.length)
  const diameter = seatDiameter(size)
  const radius = mode === 'game' ? 41 : 40

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[430px] overflow-visible rounded-[2rem] border border-rose-300/10 bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.18),rgba(15,23,42,0.38)_37%,rgba(2,6,23,0.92)_72%)] p-3 shadow-2xl shadow-rose-950/30">
      <div className="absolute inset-4 rounded-[1.75rem] border border-white/[0.05]" />
      <div className="absolute inset-[18%] rounded-full border border-rose-300/15 bg-[radial-gradient(circle_at_center,rgba(251,113,133,0.18),rgba(15,23,42,0.62)_60%,rgba(2,6,23,0.12))] shadow-[inset_0_0_42px_rgba(244,63,94,0.16)]" />
      <div className="absolute left-1/2 top-1/2 flex h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rotate-45 items-center justify-center rounded-3xl border border-amber-200/20 bg-slate-950/75 text-center shadow-2xl shadow-black/40 backdrop-blur">
        <div className="-rotate-45">
          <p className="text-[0.625rem] uppercase tracking-[0.28em] text-rose-200/70">Shadow Table</p>
          <p className="mt-1 text-base font-black tracking-[0.24em] text-amber-50">忍者之夜</p>
          <p className="mt-1 text-[0.625rem] text-slate-400">
            {mode === 'lobby' ? '点击空位入座' : `第 ${room.round || 1} 回合`}
          </p>
        </div>
      </div>

      {Array.from({ length: size }).map((_, index) => {
        const id = mode === 'lobby'
          ? Object.entries(lobbyAssignments).find(([, seat]) => seat === index)?.[0] ?? null
          : orderedIds[index] ?? null
        const player = id ? players[id] : null
        const angle = -90 + (360 / size) * index
        const x = 50 + radius * Math.cos((angle * Math.PI) / 180)
        const y = 50 + radius * Math.sin((angle * Math.PI) / 180)
        const isMe = id === viewerPlayerId
        const isActive = id === activePlayerId
        const canTarget = !!id && targetableIds.includes(id)
        const isSelected = !!id && selectedTargetIds.includes(id)
        const revealed = !!id && (room.publiclyRevealedHouseIds ?? []).includes(id)
        const houseCard = id ? room.houseCardAssignments?.[id] ?? null : null
        const lobbySeatAllowed = mode === 'lobby' && !player && viewerCanMove
        const clickable = mode === 'lobby' ? lobbySeatAllowed && !!onSeatClick : canTarget && !!onTargetClick
        const tokenCount = id ? honorTokenCount(room, id) : 0
        const handCount = player?.hand?.length ?? 0
        const readyRing = mode === 'lobby' && player
          ? player.ready
            ? 'border-emerald-200/75 shadow-emerald-500/25 ring-2 ring-emerald-300/35'
            : 'border-slate-500/45 shadow-black/30'
          : ''

        return (
          <button
            key={`${index}-${id ?? 'empty'}`}
            type="button"
            disabled={!clickable}
            onClick={() => {
              if (mode === 'lobby') onSeatClick?.(index, id)
              else if (id && canTarget) onTargetClick?.(id)
            }}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border p-1 text-center shadow-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 ${
              player
                ? player.isAlive
                  ? 'border-white/[0.12] bg-slate-950/90 backdrop-blur-md hover:border-rose-200/30'
                  : 'border-red-200/25 bg-slate-950/70 opacity-65 backdrop-blur-md'
                : lobbySeatAllowed
                  ? 'border-dashed border-rose-200/30 bg-rose-400/[0.07] text-rose-100 hover:border-rose-100/60 hover:bg-rose-400/[0.12]'
                  : 'border-dashed border-white/[0.08] bg-white/[0.02] text-slate-600'
            } ${
              isMe ? 'border-indigo-200/60 ring-2 ring-indigo-300/45' : ''
            } ${
              isActive ? 'border-amber-200/70 shadow-amber-500/30 ring-2 ring-amber-300/60' : ''
            } ${
              canTarget ? 'cursor-pointer border-rose-200/80 bg-rose-950/70 shadow-rose-500/30 ring-2 ring-rose-300/50' : ''
            } ${
              isSelected ? 'ring-2 ring-emerald-300/80' : ''
            } ${readyRing} ${clickable ? 'cursor-pointer' : 'cursor-default'} disabled:opacity-100`}
            style={{ left: `${x}%`, top: `${y}%`, width: diameter, height: diameter }}
          >
            {player ? (
              <>
                <span className="absolute -right-1 -top-1 rounded-full border border-white/[0.12] bg-slate-950 px-1.5 py-0.5 text-[0.5625rem] text-slate-400">
                  {index + 1}
                </span>
                {room.hostId === id && (
                  <span className="absolute -left-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-amber-200/30 bg-amber-300/18 text-[0.625rem] font-black text-amber-100 shadow-lg shadow-amber-950/25">房</span>
                )}
                {mode === 'game' && (
                  <span className={`absolute left-1/2 top-full z-10 mt-1 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.5625rem] font-semibold ${
                    player.isAlive ? 'border-white/[0.1] bg-slate-950 text-slate-200' : 'border-red-200/20 bg-red-400/20 text-red-100'
                  }`}>
                    <span>手牌×{handCount}</span>
                    <span className="text-slate-500">·</span>
                    <span>{player.isAlive ? `标记×${tokenCount}` : '出局'}</span>
                  </span>
                )}
                {mode === 'lobby' && (
                  <span
                    className={`absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full border ${
                      player.ready
                        ? 'border-emerald-100/70 bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.75)]'
                        : 'border-slate-300/20 bg-slate-600'
                    }`}
                    aria-label={player.ready ? '已准备' : '未准备'}
                  />
                )}
                <div className="min-w-0 px-1">
                  <p className={`mx-auto truncate font-black leading-tight ${diameter <= 62 ? 'max-w-[44px] text-[0.625rem]' : 'max-w-[58px] text-xs'} ${player.isAlive ? 'text-slate-50' : 'text-slate-500 line-through'}`}>
                    {isMe ? '你' : player.name}
                  </p>
                  {mode === 'game' && revealed && (
                    <p className={`mt-0.5 truncate text-[0.5rem] ${houseSideTone(houseCard)}`}>
                      {houseCard ? <HouseCardLabel card={houseCard} /> : '已公开'}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="text-[0.625rem] font-bold">{lobbySeatAllowed ? '入座' : '空位'}</span>
                <span className="mt-0.5 text-[0.5625rem] opacity-60">Seat {index + 1}</span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
