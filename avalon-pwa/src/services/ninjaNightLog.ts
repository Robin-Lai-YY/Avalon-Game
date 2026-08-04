import type {
  HouseCard,
  NinjaPublicNightEvent,
  NinjaPublicNightEventKind,
  NinjaRoom,
} from '../types/ninja'

export function playerDisplayName(room: NinjaRoom, playerId: string): string {
  return room.players?.[playerId]?.name ?? playerId
}

export function appendPublicNightEvent(
  room: NinjaRoom,
  partial: {
    kind: NinjaPublicNightEventKind
    text: string
    actorId?: string | null
    cardLabel?: string | null
    targetIds?: string[] | null
  }
): NinjaRoom {
  const event: NinjaPublicNightEvent = {
    id: `e${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    round: room.round || 1,
    kind: partial.kind,
    actorId: partial.actorId ?? null,
    cardLabel: partial.cardLabel ?? null,
    targetIds: partial.targetIds ?? null,
    text: partial.text,
  }
  return {
    ...room,
    publicNightLog: [...(room.publicNightLog ?? []), event],
  } as NinjaRoom
}

export function clearPublicNightLog(room: NinjaRoom): NinjaRoom {
  return { ...room, publicNightLog: [] } as NinjaRoom
}

export function addPublicHouseReveal(room: NinjaRoom, playerId: string): NinjaRoom {
  const house = room.houseCardAssignments?.[playerId]
  if (!house) return room
  const houses = { ...(room.publiclyRevealedHouses ?? {}), [playerId]: house }
  return {
    ...room,
    publiclyRevealedHouses: houses,
    publiclyRevealedHouseIds: Object.keys(houses),
  } as NinjaRoom
}

export function clearPublicHouseRevealFor(room: NinjaRoom, ...playerIds: string[]): NinjaRoom {
  const houses = { ...(room.publiclyRevealedHouses ?? {}) }
  for (const id of playerIds) delete houses[id]
  return {
    ...room,
    publiclyRevealedHouses: houses,
    publiclyRevealedHouseIds: Object.keys(houses),
  } as NinjaRoom
}

export function houseCardShortLabel(card: HouseCard): string {
  if (card.side === 'ronin') return '浪人'
  return `${card.side === 'crane' ? '鹤' : '莲'}${card.rank}`
}

/** Stable pick of up to `n` ids from a list (crypto shuffle copy). */
export function pickRandomIds(ids: string[], n: number): string[] {
  if (ids.length === 0 || n <= 0) return []
  const copy = [...ids]
  for (let i = copy.length - 1; i > 0; i--) {
    const bytes = new Uint32Array(1)
    crypto.getRandomValues(bytes)
    const j = bytes[0]! % (i + 1)
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy.slice(0, Math.min(n, copy.length))
}
