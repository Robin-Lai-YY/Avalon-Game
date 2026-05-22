import { get, ref, remove, runTransaction, set, update } from 'firebase/database'
import {
  buildHonorTokenBag,
  buildHouseDeck,
  buildNinjaDeck,
  DRAFT_DEAL_SIZE,
  HONOR_WIN_THRESHOLD,
} from '../data/ninjaCards'
import { shuffle } from '../utils/shuffle'
import { db } from './firebase'
import type {
  HonorToken,
  HouseCard,
  NinjaCard,
  NinjaCardKind,
  NinjaPlayer,
  NinjaPrivateRoundState,
  NinjaRoom,
  PendingAction,
  PendingActionStep,
  ReactiveResponseChoice,
  TricksterVariant,
} from '../types/ninja'

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_ID_LENGTH = 6
const ROOM_ID_PREFIX = 'N'

function generateRoomId(): string {
  let id = ROOM_ID_PREFIX
  const randomValues = new Uint8Array(ROOM_ID_LENGTH - 1)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < ROOM_ID_LENGTH - 1; i++) {
    id += ROOM_ID_CHARS[randomValues[i]! % ROOM_ID_CHARS.length]
  }
  return id
}

function generatePlayerId(): string {
  return crypto.randomUUID()
}

function generateReconnectToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function normalizeNameForDuplicateCheck(name: string): string {
  return name.trim().toLowerCase()
}

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return bytes[0]! % maxExclusive
}

const MAX_NINJA_SEATS = 11
const MIN_NINJA_PLAYERS = 4

function getSeatOrder(room: Pick<NinjaRoom, 'players'> & Partial<Pick<NinjaRoom, 'seatOrder'>>): string[] {
  const players = room.players ?? {}
  const existing = (room.seatOrder ?? []).filter((id) => !!players[id])
  const missing = Object.keys(players)
    .filter((id) => !existing.includes(id))
    .sort()
  return [...existing, ...missing]
}

function buildSeatOrderFromAssignments(
  players: Record<string, NinjaPlayer>,
  seatAssignments: Record<string, number> | undefined
): string[] {
  const assigned = Object.entries(seatAssignments ?? {})
    .filter(([id, seat]) => !!players[id] && Number.isInteger(seat))
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id)
  const missing = Object.keys(players)
    .filter((id) => !assigned.includes(id))
    .sort()
  return [...assigned, ...missing]
}

function maxOccupiedSeatIndex(
  players: Record<string, NinjaPlayer>,
  seatAssignments: Record<string, number> | undefined
): number {
  const seats = Object.entries(seatAssignments ?? {})
    .filter(([id]) => !!players[id])
    .map(([, seat]) => seat)
  return seats.length > 0 ? Math.max(...seats) : -1
}

function effectiveTargetPlayerCount(room: Pick<NinjaRoom, 'players'> & Partial<Pick<NinjaRoom, 'seatAssignments' | 'targetPlayerCount'>>): number {
  const players = room.players ?? {}
  return Math.min(
    MAX_NINJA_SEATS,
    Math.max(
      MIN_NINJA_PLAYERS,
      room.targetPlayerCount ?? MIN_NINJA_PLAYERS,
      Object.keys(players).length,
      maxOccupiedSeatIndex(players, room.seatAssignments) + 1
    )
  )
}

function getSeatedPlayerIds(room: Pick<NinjaRoom, 'players'> & Partial<Pick<NinjaRoom, 'seatOrder'>>): string[] {
  const players = room.players ?? {}
  if (!room.seatOrder) return Object.keys(players).sort()
  return room.seatOrder.filter((id) => !!players[id])
}

/** Build the seat ring from the authoritative clockwise seat order. */
function getSeatRing(room: Pick<NinjaRoom, 'players'> & Partial<Pick<NinjaRoom, 'seatOrder'>>) {
  const ids = getSeatedPlayerIds(room)
  const leftOf: Record<string, string> = {}
  const rightOf: Record<string, string> = {}
  for (let i = 0; i < ids.length; i++) {
    leftOf[ids[i]!] = ids[(i + 1) % ids.length]!
    rightOf[ids[i]!] = ids[(i - 1 + ids.length) % ids.length]!
  }
  return { ids, leftOf, rightOf }
}

const DEFAULT_PLAYER_FIELDS = {
  hand: [] as NinjaCard[],
  draftHand: [] as NinjaCard[],
  draftPick: null as string | null,
  nightChoices: {} as Record<string, 'play' | 'hold'>,
  hasAcknowledgedHouse: false,
  hasAcknowledgedReveal: false,
  canViewHouse: true,
  isAlive: true,
}

function buildBlankPrivateRound(): NinjaPrivateRoundState {
  return {
    spyReveals: [],
    mysticReveals: [],
    shinobiPeek: null,
    spiritMerchantViews: [],
    troublemakerPeek: null,
    shapeshifterPeeks: null,
  }
}

const NIGHT_PHASE_TO_KIND: Record<string, NinjaCardKind> = {
  NIGHT_SPY: 'spy',
  NIGHT_MYSTIC: 'mystic',
  NIGHT_TRICKSTER: 'trickster',
  NIGHT_BLIND_ASSASSIN: 'blind_assassin',
  NIGHT_SHINOBI: 'shinobi',
  NIGHT_MASTERMIND: 'mastermind',
}

const NIGHT_PHASE_ORDER: NinjaRoom['state'][] = [
  'NIGHT_SPY',
  'NIGHT_MYSTIC',
  'NIGHT_TRICKSTER',
  'NIGHT_BLIND_ASSASSIN',
  'NIGHT_SHINOBI',
  'NIGHT_MASTERMIND',
]

// ============================================================================
// Room lifecycle: create, join, reconnect, kick, leave, ready, start
// ============================================================================

export async function createNinjaRoom(
  hostName: string
): Promise<{ roomId: string; playerId: string; reconnectToken: string }> {
  const trimmed = hostName.trim()
  if (!trimmed) throw new Error('请输入你的名字')
  const roomId = generateRoomId()
  const playerId = generatePlayerId()
  const reconnectToken = generateReconnectToken()

  const room: NinjaRoom = {
    hostId: playerId,
    state: 'LOBBY',
    round: 0,
    targetPlayerCount: MIN_NINJA_PLAYERS,
    players: {
      [playerId]: {
        name: trimmed,
        ready: false,
        reconnectToken,
        honorTokens: [],
        ...DEFAULT_PLAYER_FIELDS,
      },
    },
    seatOrder: [playerId],
    seatAssignments: { [playerId]: 0 },
    houseCardAssignments: {},
    publiclyRevealedHouseIds: [],
    mastermindRevealedAliveIds: [],
    tokenBag: [],
    ninjaDiscardPile: [],
    currentNight: null,
    reveal: null,
    resultWinnerIds: null,
    serverTimeOffset: 0,
  }

  await set(ref(db, `ninjaRooms/${roomId}`), room)
  return { roomId, playerId, reconnectToken }
}

export async function joinNinjaRoom(
  roomId: string,
  name: string
): Promise<{ playerId: string; reconnectToken: string }> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('请输入你的名字')

  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  if (room.state !== 'LOBBY') throw new Error('Game has already started')

  const incoming = normalizeNameForDuplicateCheck(trimmed)
  const players = room.players ?? {}
  for (const p of Object.values(players)) {
    if (normalizeNameForDuplicateCheck(p.name) === incoming) {
      throw new Error('该昵称已被使用，请换一个名字')
    }
  }

  const currentCount = Object.keys(players).length
  const targetCount = room.targetPlayerCount ?? MAX_NINJA_SEATS
  if (currentCount >= targetCount) throw new Error(`房间已满（本局 ${targetCount} 人）`)

  const playerId = generatePlayerId()
  const reconnectToken = generateReconnectToken()
  await update(ref(db, `ninjaRooms/${roomId}/players/${playerId}`), {
    name: trimmed,
    ready: false,
    reconnectToken,
    honorTokens: [],
    ...DEFAULT_PLAYER_FIELDS,
  } as NinjaPlayer)

  return { playerId, reconnectToken }
}

export async function reconnectNinjaRoom(
  roomId: string,
  playerId: string
): Promise<{ roomId: string; playerId: string; isHost: boolean; state: string }> {
  const snapshot = await get(ref(db, `ninjaRooms/${roomId}`))
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  if (!room.players?.[playerId]) throw new Error('You are not in this room')
  return {
    roomId,
    playerId,
    isHost: room.hostId === playerId,
    state: room.state,
  }
}

export async function reconnectNinjaByToken(
  roomId: string,
  token: string
): Promise<{ roomId: string; playerId: string; isHost: boolean; state: string; reconnectToken: string }> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  const players = room.players ?? {}
  let matchedId: string | null = null
  for (const [pid, player] of Object.entries(players)) {
    if (player.reconnectToken === token) {
      matchedId = pid
      break
    }
  }
  if (!matchedId) throw new Error('Invalid or expired reconnect token')
  const newToken = generateReconnectToken()
  await set(ref(db, `ninjaRooms/${roomId}/players/${matchedId}/reconnectToken`), newToken)
  return {
    roomId,
    playerId: matchedId,
    isHost: room.hostId === matchedId,
    state: room.state,
    reconnectToken: newToken,
  }
}

export async function kickPlayerFromNinjaLobby(
  roomId: string,
  hostPlayerId: string,
  targetPlayerId: string
): Promise<void> {
  if (hostPlayerId === targetPlayerId) throw new Error('不能踢出自己')
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  if (room.state !== 'LOBBY') throw new Error('只能在等待大厅踢人')
  if (room.hostId !== hostPlayerId) throw new Error('只有房主可以踢人')
  const players = room.players ?? {}
  if (!players[targetPlayerId]) throw new Error('该玩家不在房间中')
  const currentCount = Object.keys(players).length
  const targetCount = room.targetPlayerCount ?? MAX_NINJA_SEATS
  const remainingPlayers = Object.fromEntries(
    Object.entries(players).filter(([id]) => id !== targetPlayerId)
  ) as Record<string, NinjaPlayer>
  let nextSeatAssignments = { ...(room.seatAssignments ?? {}) }
  delete nextSeatAssignments[targetPlayerId]
  let nextTargetPlayerCount = targetCount

  // If the lobby was filled to the selected count, kicking someone should shrink
  // the planned game size too. Preserve clockwise order by compacting seats.
  if (currentCount >= targetCount) {
    nextTargetPlayerCount = Math.max(MIN_NINJA_PLAYERS, currentCount - 1)
    const compactOrder = buildSeatOrderFromAssignments(remainingPlayers, nextSeatAssignments)
    nextSeatAssignments = {}
    compactOrder.forEach((id, index) => {
      nextSeatAssignments[id] = index
    })
  }

  await update(roomRef, {
    [`players/${targetPlayerId}`]: null,
    targetPlayerCount: nextTargetPlayerCount,
    seatAssignments: nextSeatAssignments,
    seatOrder: buildSeatOrderFromAssignments(remainingPlayers, nextSeatAssignments),
  })
}

export async function leaveNinjaLobby(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) return
  const room = snapshot.val() as NinjaRoom
  if (room.state !== 'LOBBY') return
  const players = room.players ?? {}
  if (!players[playerId]) return
  const ids = getSeatOrder(room)
  if (ids.length === 1) {
    await remove(roomRef)
    return
  }
  const nextSeatAssignments = { ...(room.seatAssignments ?? {}) }
  delete nextSeatAssignments[playerId]
  const nextSeatOrder = buildSeatOrderFromAssignments(
    Object.fromEntries(Object.entries(players).filter(([id]) => id !== playerId)),
    nextSeatAssignments
  )
  if (room.hostId === playerId) {
    const nextHost = ids.find((id) => id !== playerId)
    await update(roomRef, {
      [`players/${playerId}`]: null,
      [`seatAssignments/${playerId}`]: null,
      seatOrder: nextSeatOrder,
      ...(nextHost ? { hostId: nextHost } : {}),
    })
    return
  }
  await update(roomRef, { [`players/${playerId}`]: null, [`seatAssignments/${playerId}`]: null, seatOrder: nextSeatOrder })
}

export async function sitNinjaSeat(roomId: string, playerId: string, seatIndex: number): Promise<void> {
  if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= MAX_NINJA_SEATS) {
    throw new Error('无效座位')
  }
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    if (room.state !== 'LOBBY') return raw
    const players = room.players ?? {}
    const player = players[playerId]
    if (!player) return raw
    if (player.ready) return raw
    const targetCount = effectiveTargetPlayerCount(room)
    if (seatIndex >= targetCount) return raw

    const seatAssignments = { ...(room.seatAssignments ?? {}) }
    const occupied = Object.entries(seatAssignments).find(
      ([id, seat]) => id !== playerId && seat === seatIndex && !!players[id]
    )
    if (occupied) return raw
    seatAssignments[playerId] = seatIndex
    const nextSeatOrder = buildSeatOrderFromAssignments(players, seatAssignments)
    return {
      ...room,
      seatAssignments,
      seatOrder: nextSeatOrder,
      players: {
        ...players,
        [playerId]: { ...player, ready: false },
      },
    } as NinjaRoom
  })
}

export async function setNinjaTargetPlayerCount(
  roomId: string,
  hostPlayerId: string,
  targetPlayerCount: number
): Promise<void> {
  if (!Number.isInteger(targetPlayerCount) || targetPlayerCount < MIN_NINJA_PLAYERS || targetPlayerCount > MAX_NINJA_SEATS) {
    throw new Error('忍者之夜支持 4-11 人')
  }
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    if (room.state !== 'LOBBY') return raw
    if (room.hostId !== hostPlayerId) return raw
    const players = room.players ?? {}
    if (Object.keys(players).length > targetPlayerCount) return raw
    const maxOccupiedSeat = maxOccupiedSeatIndex(players, room.seatAssignments)
    if (maxOccupiedSeat >= targetPlayerCount) return raw
    return { ...room, targetPlayerCount } as NinjaRoom
  })
}

export async function leaveNinjaSeat(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    if (room.state !== 'LOBBY') return raw
    const players = room.players ?? {}
    const player = players[playerId]
    if (!player || player.ready) return raw
    const seatAssignments = { ...(room.seatAssignments ?? {}) }
    delete seatAssignments[playerId]
    return {
      ...room,
      seatAssignments,
      seatOrder: buildSeatOrderFromAssignments(players, seatAssignments),
      players: {
        ...players,
        [playerId]: { ...player, ready: false },
      },
    } as NinjaRoom
  })
}

export async function setNinjaPlayerReady(
  roomId: string,
  playerId: string,
  ready: boolean
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('房间不存在')
  const room = snapshot.val() as NinjaRoom
  if (room.state !== 'LOBBY') throw new Error('游戏已开始')
  if (!room.players?.[playerId]) throw new Error('你不在房间中')
  if (!getSeatedPlayerIds(room).includes(playerId)) throw new Error('请先选择座位')
  await update(ref(db, `ninjaRooms/${roomId}/players/${playerId}`), { ready })
}

export async function startNinjaGame(roomId: string, hostPlayerId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  if (room.state !== 'LOBBY') throw new Error('Game already started')
  if (room.hostId !== hostPlayerId) throw new Error('只有房主可以开始')
  const players = room.players ?? {}
  const targetCount = effectiveTargetPlayerCount(room)
  const playerIds = buildSeatOrderFromAssignments(players, room.seatAssignments)
    .filter((id) => room.seatAssignments?.[id] !== undefined)
  if (targetCount < MIN_NINJA_PLAYERS || targetCount > MAX_NINJA_SEATS) throw new Error('忍者之夜支持 4-11 人')
  if (playerIds.length !== targetCount) throw new Error(`请等待 ${targetCount} 名玩家入座`)
  if (playerIds.length !== Object.keys(players).length) throw new Error('请所有玩家先选择座位')
  if (!playerIds.every((id) => players[id]?.ready === true)) {
    throw new Error('请等待所有玩家准备')
  }

  const tokenBag = shuffle(buildHonorTokenBag())
  await update(roomRef, { tokenBag, round: 0, targetPlayerCount: targetCount, seatOrder: playerIds })
  await startNinjaRound(roomId)
}

// ============================================================================
// Round lifecycle: deal house cards, deal draft, advance phases
// ============================================================================

/**
 * Begin a new round: clear per-round state, deal house cards, deal 3 ninja cards each.
 * Idempotent — only acts if state is LOBBY (first round) or REVEAL (subsequent rounds).
 */
export async function startNinjaRound(roomId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const baseRoom = snapshot.val() as NinjaRoom
  if (baseRoom.state !== 'LOBBY' && baseRoom.state !== 'REVEAL') return

  const seatIds = getSeatedPlayerIds(baseRoom)
  const playerCount = seatIds.length
  const houseDeck = shuffle(buildHouseDeck(playerCount)) as HouseCard[]
  const ninjaDeck = shuffle(buildNinjaDeck()) as NinjaCard[]

  const houseAssignments: Record<string, HouseCard> = {}
  for (let i = 0; i < seatIds.length; i++) houseAssignments[seatIds[i]!] = houseDeck[i]!

  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    if (room.state !== 'LOBBY' && room.state !== 'REVEAL') return raw

    const dealtPlayers: Record<string, NinjaPlayer> = { ...room.players }
    let cursor = 0
    for (const id of seatIds) {
      const draftHand = ninjaDeck.slice(cursor, cursor + DRAFT_DEAL_SIZE)
      cursor += DRAFT_DEAL_SIZE
      dealtPlayers[id] = {
        ...dealtPlayers[id]!,
        ...DEFAULT_PLAYER_FIELDS,
        draftHand,
        hand: [],
      }
    }

    return {
      ...room,
      state: 'HOUSE_REVEAL',
      round: (room.round ?? 0) + 1,
      players: dealtPlayers,
      seatOrder: seatIds,
      houseCardAssignments: houseAssignments,
      publiclyRevealedHouseIds: [],
      mastermindRevealedAliveIds: [],
      ninjaDiscardPile: [],
      currentNight: null,
      reveal: null,
      resultWinnerIds: null,
    } as NinjaRoom
  })

  // Reset per-player private round state (only the new round's keys are kept).
  const privUpdates: Record<string, unknown> = {}
  for (const id of seatIds) {
    privUpdates[`${id}`] = { current: buildBlankPrivateRound() }
  }
  await set(ref(db, `ninjaRooms/${roomId}/privateState`), privUpdates)
}

export async function acknowledgeHouseReveal(
  roomId: string,
  playerId: string
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    if (room.state !== 'HOUSE_REVEAL') return raw
    if (!room.players?.[playerId]) return raw
    const players = { ...room.players }
    players[playerId] = { ...players[playerId]!, hasAcknowledgedHouse: true }
    const allAck = Object.values(players).every((p) => p.hasAcknowledgedHouse)
    return {
      ...room,
      players,
      state: allAck ? 'DRAFT_PICK_1' : 'HOUSE_REVEAL',
    } as NinjaRoom
  })
}

// ============================================================================
// Draft logic
// ============================================================================

export async function submitDraftPick(
  roomId: string,
  playerId: string,
  cardId: string
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    if (room.state !== 'DRAFT_PICK_1' && room.state !== 'DRAFT_PICK_2') return raw
    const me = room.players?.[playerId]
    if (!me) return raw
    if (!(me.draftHand ?? []).some((c) => c.id === cardId)) return raw
    const players = { ...room.players }
    players[playerId] = { ...me, draftPick: cardId }

    const everyonePicked = Object.values(players).every(
      (p) => typeof p.draftPick === 'string' && p.draftPick.length > 0
    )
    if (!everyonePicked) {
      return { ...room, players } as NinjaRoom
    }

    const ring = getSeatRing({ ...room, players })
    if (room.state === 'DRAFT_PICK_1') {
      const passingBuckets: Record<string, NinjaCard[]> = {}
      for (const id of ring.ids) passingBuckets[id] = []
      for (const id of ring.ids) {
        const p = players[id]!
        const kept = (p.draftHand ?? []).find((c) => c.id === p.draftPick)!
        const remaining = (p.draftHand ?? []).filter((c) => c.id !== p.draftPick)
        const newHand = [...(p.hand ?? []), kept]
        passingBuckets[ring.leftOf[id]!]!.push(...remaining)
        players[id] = { ...p, hand: newHand, draftHand: [], draftPick: null }
      }
      for (const id of ring.ids) {
        players[id] = { ...players[id]!, draftHand: passingBuckets[id]! }
      }
      return { ...room, players, state: 'DRAFT_PICK_2' } as NinjaRoom
    }

    // DRAFT_PICK_2: keep one, discard the other
    const newDiscard: NinjaCard[] = [...(room.ninjaDiscardPile ?? [])]
    for (const id of ring.ids) {
      const p = players[id]!
      const kept = (p.draftHand ?? []).find((c) => c.id === p.draftPick)!
      const discarded = (p.draftHand ?? []).filter((c) => c.id !== p.draftPick)
      newDiscard.push(...discarded)
      players[id] = {
        ...p,
        hand: [...(p.hand ?? []), kept],
        draftHand: [],
        draftPick: null,
      }
    }
    return {
      ...room,
      players,
      ninjaDiscardPile: newDiscard,
      state: 'NIGHT_SPY',
    } as NinjaRoom
  })

  // After advancing to NIGHT_SPY, prime the night phase declarations.
  await primeNightPhaseIfNeeded(roomId)
}

// ============================================================================
// Night phase: declarations + resolution
// ============================================================================

/**
 * Set up `currentNight` for the current state. If no alive player has a card of
 * this kind, automatically advance to the next phase. Loops until it lands on a
 * phase with eligible players (or hits REVEAL).
 */
export async function primeNightPhaseIfNeeded(roomId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  for (let safety = 0; safety < 8; safety++) {
    let advanced = false
    await runTransaction(roomRef, (raw) => {
      if (!raw) return raw
      const room = raw as NinjaRoom
      const kind = NIGHT_PHASE_TO_KIND[room.state]
      if (!kind) return raw
      if (!room.currentNight || room.currentNight.kind !== kind) {
        return {
          ...room,
          currentNight: {
            kind,
            resolutionQueue: [],
            resolutionIndex: -1,
            declarationsLocked: false,
            pendingAction: null,
            reactive: null,
          },
        } as NinjaRoom
      }
      if (room.currentNight.declarationsLocked) return raw
      const eligible = listEligiblePlayers(room, kind)
      if (eligible.length > 0) return raw
      advanced = true
      return advanceFromCurrentPhase(room)
    })
    if (!advanced) break
  }
  // After priming, run reveal flow if we landed on REVEAL.
  const post = (await get(roomRef)).val() as NinjaRoom | null
  if (post?.state === 'REVEAL' && !post.reveal) {
    await finalizeRoundReveal(roomId)
  }
}

function listEligiblePlayers(room: NinjaRoom, kind: NinjaCardKind): string[] {
  const players = room.players ?? {}
  const result: string[] = []
  for (const [id, p] of Object.entries(players)) {
    if (!p.isAlive) continue
    if ((p.hand ?? []).some((c) => c.kind === kind)) result.push(id)
  }
  return result
}

function nextStateAfter(state: NinjaRoom['state']): NinjaRoom['state'] {
  const idx = NIGHT_PHASE_ORDER.indexOf(state)
  if (idx === -1) return 'REVEAL'
  if (idx === NIGHT_PHASE_ORDER.length - 1) return 'REVEAL'
  return NIGHT_PHASE_ORDER[idx + 1]!
}

/** Used by transactions. Clears currentNight and advances state. Caller follows up to prime new phase. */
function advanceFromCurrentPhase(room: NinjaRoom): NinjaRoom {
  const next = nextStateAfter(room.state)
  return {
    ...room,
    currentNight: null,
    state: next,
  } as NinjaRoom
}

/**
 * Player declares whether to play or hold a specific card of the current phase's kind.
 * Once everyone eligible has declared all of their matching cards, the queue is built.
 */
export async function submitNightDeclaration(
  roomId: string,
  playerId: string,
  cardId: string,
  choice: 'play' | 'hold'
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const kind = NIGHT_PHASE_TO_KIND[room.state]
    if (!kind) return raw
    const me = room.players?.[playerId]
    if (!me || !me.isAlive) return raw
    if (!room.currentNight || room.currentNight.declarationsLocked) return raw
    const card = (me.hand ?? []).find((c) => c.id === cardId)
    if (!card || card.kind !== kind) return raw
    const players = { ...room.players }
    const nightChoices = { ...(me.nightChoices ?? {}), [cardId]: choice }
    players[playerId] = { ...me, nightChoices }

    // Are all eligible players done declaring all of their matching cards?
    const eligible = listEligiblePlayers({ ...room, players }, kind)
    const allDone = eligible.every((id) => {
      const p = players[id]!
      const myCards = (p.hand ?? []).filter((c) => c.kind === kind)
      return myCards.every((c) => p.nightChoices?.[c.id] !== undefined)
    })
    if (!allDone) {
      return { ...room, players } as NinjaRoom
    }

    // Build the resolution queue from played cards, sorted by priority then seat order.
    const queue: { playerId: string; cardId: string; priority: number }[] = []
    const seatOrder = getSeatOrder({ ...room, players })
    for (const id of seatOrder) {
      const p = players[id]!
      for (const c of p.hand ?? []) {
        if (c.kind !== kind) continue
        if (p.nightChoices?.[c.id] === 'play') {
          queue.push({ playerId: id, cardId: c.id, priority: c.priority })
        }
      }
    }
    queue.sort((a, b) =>
      a.priority !== b.priority
        ? a.priority - b.priority
        : seatOrder.indexOf(a.playerId) - seatOrder.indexOf(b.playerId)
    )

    return {
      ...room,
      players,
      currentNight: {
        ...room.currentNight,
        resolutionQueue: queue,
        resolutionIndex: queue.length === 0 ? queue.length : 0,
        declarationsLocked: true,
      },
    } as NinjaRoom
  })

  await tryAdvanceResolution(roomId)
}

/**
 * Drives the night-phase resolution loop forward. Called after declarations lock,
 * after each pending action is resolved, and after each reactive window closes.
 */
export async function tryAdvanceResolution(roomId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  // Loop a few times to chain auto-advancing actions (e.g. spy → spy → next phase).
  // Each iteration is a single transaction; non-trivial side effects (like
  // entering a pending action or reactive window) stop the loop.
  for (let safety = 0; safety < 25; safety++) {
    let advanced = false
    let needsPrime = false
    await runTransaction(roomRef, (raw) => {
      if (!raw) return raw
      const room = raw as NinjaRoom
      const kind = NIGHT_PHASE_TO_KIND[room.state]
      if (!kind || !room.currentNight) return raw
      if (!room.currentNight.declarationsLocked) return raw
      if (room.currentNight.pendingAction) return raw
      if (room.currentNight.reactive) return raw

      const queue = room.currentNight.resolutionQueue ?? []
      const idx = room.currentNight.resolutionIndex ?? 0
      if (idx >= queue.length) {
        advanced = true
        needsPrime = true
        return advanceFromCurrentPhase(room)
      }

      const head = queue[idx]!
      const player = room.players?.[head.playerId]
      if (!player || !player.isAlive) return advanceQueueIndex(room)
      const card = (player.hand ?? []).find((c) => c.id === head.cardId)
      if (!card) return advanceQueueIndex(room)

      const pending = buildPendingAction(head.playerId, card, room.ninjaDiscardPile ?? [], room)
      if (pending) {
        return {
          ...room,
          currentNight: { ...room.currentNight, pendingAction: pending },
        } as NinjaRoom
      }

      // Self-resolving cards (Mastermind reveals) draw a token and discard the card.
      return applySelfResolvingCard(room, head.playerId, card)
    })
    if (needsPrime) {
      await primeNightPhaseIfNeeded(roomId)
      // After advancing past mastermind, run reveal flow
      const post = (await get(roomRef)).val() as NinjaRoom | null
      if (post?.state === 'REVEAL') {
        await finalizeRoundReveal(roomId)
      }
      continue
    }
    if (!advanced) break
  }
}

function advanceQueueIndex(room: NinjaRoom): NinjaRoom {
  if (!room.currentNight) return room
  return {
    ...room,
    currentNight: {
      ...room.currentNight,
      resolutionIndex: (room.currentNight.resolutionIndex ?? 0) + 1,
    },
  } as NinjaRoom
}

/**
 * Canonical PendingAction shape — every literal we ever write to Firebase must
 * carry every optional field as an explicit value (string / array / null) so
 * Firebase's "no undefined" rule never trips and so reads after RTDB strips
 * empty values still produce predictable defaults.
 */
function makePendingAction(args: {
  ownerId: string
  card: NinjaCard
  step: PendingActionStep
  overrides?: Partial<PendingAction>
}): PendingAction {
  const { ownerId, card, step, overrides } = args
  return {
    playerId: ownerId,
    cardId: card.id,
    kind: card.kind,
    variant: card.variant ?? null,
    step,
    shinobiTargetId: null,
    mysticTargetId: null,
    spiritMerchantTargetId: null,
    gravediggerOptionIds: null,
    troublemakerTargetId: null,
    shapeshifterAId: null,
    shapeshifterBId: null,
    ...overrides,
  }
}

const KNOWN_TRICKSTER_VARIANTS: TricksterVariant[] = [
  'gravedigger',
  'shapeshifter',
  'spirit_merchant',
  'thief',
  'troublemaker',
  'judgement',
]

function buildPendingAction(
  ownerId: string,
  card: NinjaCard,
  discardPile: NinjaCard[],
  room?: NinjaRoom
): PendingAction | null {
  if (card.kind === 'spy') return makePendingAction({ ownerId, card, step: 'pick_target' })
  if (card.kind === 'mystic') return makePendingAction({ ownerId, card, step: 'pick_target' })
  if (card.kind === 'blind_assassin') return makePendingAction({ ownerId, card, step: 'pick_target' })
  if (card.kind === 'shinobi') return makePendingAction({ ownerId, card, step: 'pick_target' })
  if (card.kind === 'trickster') {
    // Defensive: an unknown variant (e.g. legacy data from a pre-rename round)
    // should never produce a pending — the card just gets silently discarded
    // by applySelfResolvingCard so play doesn't get stuck on a click that
    // has no engine handler.
    if (!card.variant || !KNOWN_TRICKSTER_VARIANTS.includes(card.variant)) return null

    if (card.variant === 'gravedigger') {
      const shuffled = [...discardPile].sort(() => Math.random() - 0.5)
      const optionIds = shuffled.slice(0, 2).map((c) => c.id)
      return makePendingAction({
        ownerId,
        card,
        step: 'gravedigger_pick',
        overrides: { gravediggerOptionIds: optionIds },
      })
    }
    if (card.variant === 'thief' && room) {
      const eligible = getEligibleThiefTargetIds(room, ownerId)
      if (eligible.length === 0) return null
    }
    return makePendingAction({ ownerId, card, step: 'pick_target' })
  }
  return null
}

/**
 * Mastermind: revealed at end of night. If the owner is still alive, remember
 * the owner so scoring can force that owner's house to win. If the owner is
 * Ronin, normal house-token distribution is skipped and the Ronin survival
 * bonus is awarded as usual.
 */
function applySelfResolvingCard(
  room: NinjaRoom,
  ownerId: string,
  card: NinjaCard
): NinjaRoom {
  if (card.kind !== 'mastermind') return discardPlayedCard(advanceQueueIndex(room), ownerId, card.id)
  const owner = room.players?.[ownerId]
  const aliveIds = room.mastermindRevealedAliveIds ?? []
  const nextAliveIds =
    owner && owner.isAlive && !aliveIds.includes(ownerId) ? [...aliveIds, ownerId] : aliveIds
  return discardPlayedCard(
    advanceQueueIndex({
      ...room,
      mastermindRevealedAliveIds: nextAliveIds,
    } as NinjaRoom),
    ownerId,
    card.id
  )
}

/** Move the played card from the player's hand to the discard pile. */
function discardPlayedCard(room: NinjaRoom, ownerId: string, cardId: string): NinjaRoom {
  const owner = room.players?.[ownerId]
  if (!owner) return room
  const card = (owner.hand ?? []).find((c) => c.id === cardId)
  if (!card) return room
  const hand = (owner.hand ?? []).filter((c) => c.id !== cardId)
  const players = { ...room.players, [ownerId]: { ...owner, hand } }
  const discard = [...(room.ninjaDiscardPile ?? []), card]
  return { ...room, players, ninjaDiscardPile: discard } as NinjaRoom
}

// ============================================================================
// Pending action submissions: target/decision input from the active player
// ============================================================================

/** Generic target submission. Validated per-card. */
export async function submitTarget(
  roomId: string,
  playerId: string,
  targetId: string
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  // We split the work: the transaction performs the public state change.
  // Private info (spy/mystic/shinobi peek) is written after the transaction commits.
  let privateUpdate: { ownerId: string; patch: Record<string, unknown> } | null = null
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    if (!room.currentNight?.pendingAction) return raw
    const pa = room.currentNight.pendingAction
    if (pa.playerId !== playerId) return raw
    if (pa.step !== 'pick_target') return raw
    const target = room.players?.[targetId]
    if (!target || !target.isAlive) return raw
    const owner = room.players?.[playerId]
    if (!owner) return raw
    const card = (owner.hand ?? []).find((c) => c.id === pa.cardId)
    if (!card) return raw
    // Shapeshifter is allowed to pick any player including self (per official rules);
    // every other targeted card requires a different player.
    const allowSelf = card.kind === 'trickster' && card.variant === 'shapeshifter'
    if (!allowSelf && targetId === playerId) return raw

    if (pa.kind === 'spy') {
      const houseCard = room.houseCardAssignments?.[targetId]
      if (!houseCard) return raw
      privateUpdate = {
        ownerId: playerId,
        patch: { addSpy: { targetId, card: houseCard } },
      }
      return discardPlayedCard(advanceQueueIndex(clearPending(room)), playerId, pa.cardId)
    }

    if (pa.kind === 'mystic') {
      const houseCard = room.houseCardAssignments?.[targetId]
      if (!houseCard) return raw
      const targetHand = target.hand ?? []
      const peekedNinja =
        targetHand.length > 0 ? targetHand[randomInt(targetHand.length)]! : null
      privateUpdate = {
        ownerId: playerId,
        patch: {
          addMystic: {
            targetId,
            card: houseCard,
            ninjaCardKind: peekedNinja?.kind ?? null,
            ninjaCardVariant: peekedNinja?.variant ?? null,
          },
        },
      }
      return discardPlayedCard(advanceQueueIndex(clearPending(room)), playerId, pa.cardId)
    }

    if (pa.kind === 'blind_assassin') {
      // Open a reactive window: kill resolves only after window closes.
      return openReactiveWindow(
        clearPending(room),
        playerId,
        targetId,
        'blind_assassin',
        pa.cardId
      )
    }

    if (pa.kind === 'shinobi') {
      const houseCard = room.houseCardAssignments?.[targetId]
      if (!houseCard) return raw
      privateUpdate = {
        ownerId: playerId,
        patch: { setShinobiPeek: { targetId, card: houseCard } },
      }
      return {
        ...room,
        currentNight: {
          ...room.currentNight,
          pendingAction: makePendingAction({
            ownerId: playerId,
            card,
            step: 'shinobi_decide',
            overrides: { shinobiTargetId: targetId },
          }),
        },
      } as NinjaRoom
    }

    if (pa.kind === 'trickster') {
      return applyTricksterTargetSelection(room, playerId, targetId, card)
    }

    return raw
  })

  if (privateUpdate) await applyPrivateUpdate(roomId, privateUpdate)
  // If the trickster pick transitioned into a "decide" step that needs a private
  // peek, write it now (out-of-transaction) before the player sees the panel.
  await primeTroublemakerPeek(roomId)
  await tryAdvanceResolution(roomId)
}

function clearPending(room: NinjaRoom): NinjaRoom {
  if (!room.currentNight) return room
  return {
    ...room,
    currentNight: { ...room.currentNight, pendingAction: null },
  } as NinjaRoom
}

/** Shinobi: after seeing the peeked house, decide to kill (true) or pass (false). */
export async function submitShinobiDecision(
  roomId: string,
  playerId: string,
  kill: boolean
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const pa = room.currentNight?.pendingAction
    if (!pa || pa.step !== 'shinobi_decide' || pa.playerId !== playerId) return raw
    if (!pa.shinobiTargetId) return raw
    const targetId = pa.shinobiTargetId
    if (!kill) {
      return discardPlayedCard(advanceQueueIndex(clearPending(room)), playerId, pa.cardId)
    }
    return openReactiveWindow(
      clearPending(room),
      playerId,
      targetId,
      'shinobi',
      pa.cardId
    )
  })
  await tryAdvanceResolution(roomId)
}

// ============================================================================
// Trickster variants
// ============================================================================

function addPubliclyRevealed(room: NinjaRoom, playerId: string): NinjaRoom {
  const cur = room.publiclyRevealedHouseIds ?? []
  if (cur.includes(playerId)) return room
  return { ...room, publiclyRevealedHouseIds: [...cur, playerId] } as NinjaRoom
}

/**
 * Returns ids of players the Thief is allowed to target — i.e. those whose
 * `honorTokens` array is strictly larger than the thief's. Empty when no one
 * has more tokens than the thief.
 */
export function getEligibleThiefTargetIds(room: NinjaRoom, thiefId: string): string[] {
  const players = room.players ?? {}
  const my = (players[thiefId]?.honorTokens ?? []).length
  return Object.entries(players)
    .filter(([id, p]) => id !== thiefId && p.isAlive && (p.honorTokens ?? []).length > my)
    .map(([id]) => id)
}

function applyTricksterTargetSelection(
  room: NinjaRoom,
  ownerId: string,
  targetId: string,
  card: NinjaCard
): NinjaRoom {
  const variant = card.variant

  if (variant === 'shapeshifter') {
    // Step 1 of 3: owner has picked the first player A. Move to pick B.
    return {
      ...room,
      currentNight: {
        ...room.currentNight!,
        pendingAction: makePendingAction({
          ownerId,
          card,
          step: 'shapeshifter_pick_b',
          overrides: { shapeshifterAId: targetId },
        }),
      },
    } as NinjaRoom
  }

  if (variant === 'thief') {
    // Reveal own house publicly.
    const owner = room.players?.[ownerId]
    if (!owner) return room
    const myTokenCount = (owner.honorTokens ?? []).length
    const target = room.players?.[targetId]
    if (!target) return room
    const targetTokens = target.honorTokens ?? []
    // Engine-side validation: target must have strictly more tokens than thief.
    if (targetTokens.length <= myTokenCount) return room

    const stolen = targetTokens[randomInt(targetTokens.length)]!
    const players = { ...room.players }
    players[targetId] = {
      ...target,
      honorTokens: targetTokens.filter((t) => t.id !== stolen.id),
    }
    players[ownerId] = {
      ...owner,
      honorTokens: [...(owner.honorTokens ?? []), stolen],
    }
    return discardPlayedCard(
      advanceQueueIndex(addPubliclyRevealed({ ...clearPending(room), players } as NinjaRoom, ownerId)),
      ownerId,
      card.id
    )
  }

  if (variant === 'troublemaker') {
    return {
      ...room,
      currentNight: {
        ...room.currentNight!,
        pendingAction: makePendingAction({
          ownerId,
          card,
          step: 'troublemaker_decide',
          overrides: { troublemakerTargetId: targetId },
        }),
      },
    } as NinjaRoom
  }

  if (variant === 'judgement') {
    // Reveal own house, then kill target. Mirror Monk and Martyr cannot respond.
    const target = room.players?.[targetId]
    if (!target) return room
    const players = { ...room.players, [targetId]: { ...target, isAlive: false } }
    return discardPlayedCard(
      advanceQueueIndex(addPubliclyRevealed({ ...clearPending(room), players } as NinjaRoom, ownerId)),
      ownerId,
      card.id
    )
  }

  if (variant === 'spirit_merchant') {
    return {
      ...room,
      currentNight: {
        ...room.currentNight!,
        pendingAction: makePendingAction({
          ownerId,
          card,
          step: 'spirit_merchant_swap',
          overrides: { spiritMerchantTargetId: targetId },
        }),
      },
    } as NinjaRoom
  }

  // Defensive: an unknown trickster variant (e.g. legacy data from a pre-rename
  // round) reaches here only if pick_target was somehow built for it. Discard
  // the card cleanly so play can keep moving instead of leaving the player
  // stuck on an unresponsive target picker.
  return discardPlayedCard(advanceQueueIndex(clearPending(room)), ownerId, card.id)
}

/**
 * Spirit Merchant: owner has already picked target. Now picks a viewing mode and
 * optionally a token to give away in exchange. For simplicity, the engine reveals
 * the data privately and lets the UI submit a "swap or skip" choice.
 *
 * payload.viewToken: pick a target token (random index) to view; null to view house instead.
 * payload.giveOwnTokenId: id of one of owner's tokens to give to target (null = no swap).
 * payload.takeTargetTokenId: id of target's token to take (must exist if giveOwnTokenId set).
 */
export async function submitSpiritMerchantChoice(
  roomId: string,
  playerId: string,
  payload: {
    viewKind: 'token' | 'house'
    swap: { giveOwnTokenId: string; takeTargetTokenId: string } | null
  }
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  let privateUpdate: { ownerId: string; patch: Record<string, unknown> } | null = null
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const pa = room.currentNight?.pendingAction
    if (!pa || pa.step !== 'spirit_merchant_swap' || pa.playerId !== playerId) return raw
    const targetId = pa.spiritMerchantTargetId
    if (!targetId) return raw
    const owner = room.players?.[playerId]
    const target = room.players?.[targetId]
    if (!owner || !target) return raw

    let viewedToken: HonorToken | null = null
    let viewedHouse: HouseCard | null = null
    if (payload.viewKind === 'token') {
      const tokens = target.honorTokens ?? []
      if (tokens.length > 0) viewedToken = tokens[randomInt(tokens.length)]!
    } else {
      viewedHouse = room.houseCardAssignments?.[targetId] ?? null
    }
    privateUpdate = {
      ownerId: playerId,
      patch: {
        addSpiritMerchant: {
          targetId,
          tokenValue: viewedToken?.value ?? null,
          card: viewedHouse,
        },
      },
    }

    let players = { ...room.players }
    if (payload.swap) {
      const give = (owner.honorTokens ?? []).find((t) => t.id === payload.swap!.giveOwnTokenId)
      const take = (target.honorTokens ?? []).find((t) => t.id === payload.swap!.takeTargetTokenId)
      if (give && take) {
        players[playerId] = {
          ...owner,
          honorTokens: [
            ...(owner.honorTokens ?? []).filter((t) => t.id !== give.id),
            take,
          ],
        }
        players[targetId] = {
          ...target,
          honorTokens: [
            ...(target.honorTokens ?? []).filter((t) => t.id !== take.id),
            give,
          ],
        }
      }
    }

    return discardPlayedCard(
      advanceQueueIndex({ ...clearPending(room), players } as NinjaRoom),
      playerId,
      pa.cardId
    )
  })

  if (privateUpdate) await applyPrivateUpdate(roomId, privateUpdate)
  await tryAdvanceResolution(roomId)
}

/** Gravedigger: owner picks one card from the current discard pile (cardIdOrNone). */
export async function submitGravediggerPick(
  roomId: string,
  playerId: string,
  pickedCardId: string | null
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const pa = room.currentNight?.pendingAction
    if (!pa || pa.step !== 'gravedigger_pick' || pa.playerId !== playerId) return raw
    const owner = room.players?.[playerId]
    if (!owner) return raw

    let players = { ...room.players }
    let discard = [...(room.ninjaDiscardPile ?? [])]
    const optionIds = pa.gravediggerOptionIds ?? []
    if (pickedCardId) {
      // Must be one of the two cards that the system revealed.
      if (!optionIds.includes(pickedCardId)) return raw
      const idx = discard.findIndex((c) => c.id === pickedCardId)
      if (idx === -1) return raw
      const taken = discard[idx]!
      discard = discard.filter((_, i) => i !== idx)
      players[playerId] = {
        ...owner,
        hand: [...(owner.hand ?? []), taken],
      }
    }

    return discardPlayedCard(
      advanceQueueIndex({
        ...clearPending(room),
        players,
        ninjaDiscardPile: discard,
      } as NinjaRoom),
      playerId,
      pa.cardId
    )
  })
  await tryAdvanceResolution(roomId)
}

/**
 * Troublemaker — called immediately after the owner picks a target. Writes the
 * target's house card to the owner's private state so the owner can decide
 * whether to publicly reveal it.
 */
async function primeTroublemakerPeek(roomId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snap = await get(roomRef)
  if (!snap.exists()) return
  const room = snap.val() as NinjaRoom
  const pa = room.currentNight?.pendingAction
  if (!pa || pa.step !== 'troublemaker_decide') return
  const targetId = pa.troublemakerTargetId
  if (!targetId) return
  const houseCard = room.houseCardAssignments?.[targetId]
  if (!houseCard) return
  await applyPrivateUpdate(roomId, {
    ownerId: pa.playerId,
    patch: { setTroublemakerPeek: { targetId, card: houseCard } },
  })
}

/** Troublemaker step 2: choose to publicly reveal target's house, or keep it secret. */
export async function submitTroublemakerDecision(
  roomId: string,
  playerId: string,
  reveal: boolean
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const pa = room.currentNight?.pendingAction
    if (!pa || pa.step !== 'troublemaker_decide' || pa.playerId !== playerId) return raw
    const targetId = pa.troublemakerTargetId
    if (!targetId) return raw
    let next = clearPending(room)
    if (reveal) next = addPubliclyRevealed(next, targetId)
    return discardPlayedCard(advanceQueueIndex(next), playerId, pa.cardId)
  })
  await applyPrivateUpdate(roomId, {
    ownerId: playerId,
    patch: { setTroublemakerPeek: null },
  })
  await tryAdvanceResolution(roomId)
}

/** Shapeshifter step 2: pick the second player B (must differ from A). */
export async function submitShapeshifterB(
  roomId: string,
  playerId: string,
  bId: string
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const pa = room.currentNight?.pendingAction
    if (!pa || pa.step !== 'shapeshifter_pick_b' || pa.playerId !== playerId) return raw
    const aId = pa.shapeshifterAId
    if (!aId || aId === bId) return raw
    const target = room.players?.[bId]
    if (!target || !target.isAlive) return raw
    const owner = room.players?.[playerId]
    if (!owner) return raw
    const card = (owner.hand ?? []).find((c) => c.id === pa.cardId)
    if (!card) return raw
    return {
      ...room,
      currentNight: {
        ...room.currentNight!,
        pendingAction: makePendingAction({
          ownerId: playerId,
          card,
          step: 'shapeshifter_decide',
          overrides: { shapeshifterAId: aId, shapeshifterBId: bId },
        }),
      },
    } as NinjaRoom
  })
  // Write both peeks to owner's private state.
  const post = (await get(roomRef)).val() as NinjaRoom | null
  if (post?.currentNight?.pendingAction?.step === 'shapeshifter_decide') {
    const pa = post.currentNight.pendingAction
    const aId = pa.shapeshifterAId
    const newBId = pa.shapeshifterBId
    if (aId && newBId) {
      const aCard = post.houseCardAssignments?.[aId]
      const bCard = post.houseCardAssignments?.[newBId]
      if (aCard && bCard) {
        await applyPrivateUpdate(roomId, {
          ownerId: playerId,
          patch: { setShapeshifterPeeks: { aId, aCard, bId: newBId, bCard } },
        })
      }
    }
  }
}

/** Shapeshifter step 3: choose to swap A and B's house cards, or keep them. */
export async function submitShapeshifterDecision(
  roomId: string,
  playerId: string,
  swap: boolean
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const pa = room.currentNight?.pendingAction
    if (!pa || pa.step !== 'shapeshifter_decide' || pa.playerId !== playerId) return raw
    const aId = pa.shapeshifterAId
    const bId = pa.shapeshifterBId
    if (!aId || !bId) return raw

    let next = clearPending(room)
    if (swap) {
      const aHouse = room.houseCardAssignments?.[aId]
      const bHouse = room.houseCardAssignments?.[bId]
      if (!aHouse || !bHouse) return raw
      const players = { ...room.players }
      players[aId] = { ...players[aId]!, canViewHouse: false }
      players[bId] = { ...players[bId]!, canViewHouse: false }
      next = {
        ...next,
        players,
        houseCardAssignments: {
          ...room.houseCardAssignments,
          [aId]: bHouse,
          [bId]: aHouse,
        },
      } as NinjaRoom
    }
    return discardPlayedCard(advanceQueueIndex(next), playerId, pa.cardId)
  })
  await applyPrivateUpdate(roomId, {
    ownerId: playerId,
    patch: { setShapeshifterPeeks: null },
  })
  await tryAdvanceResolution(roomId)
}

// ============================================================================
// Reactive decisions (Mirror Monk / Martyr) handling
// ============================================================================

function openReactiveWindow(
  room: NinjaRoom,
  attackerId: string,
  victimId: string,
  source: 'blind_assassin' | 'shinobi',
  triggerCardId: string
): NinjaRoom {
  if (!room.currentNight) return room
  const players = room.players ?? {}
  const eligibleMonkIds: string[] = []
  const victim = players[victimId]
  if (victim?.isAlive && (victim.hand ?? []).some((c) => c.kind === 'mirror_monk')) {
    eligibleMonkIds.push(victimId)
  }
  const seatOrder = getSeatOrder(room)
  const eligibleMartyrIds = seatOrder.filter((pid) => {
    const p = players[pid]
    if (!p?.isAlive) return false
    if (pid === victimId) return false
    return (p.hand ?? []).some((c) => c.kind === 'martyr')
  })

  if (eligibleMonkIds.length === 0 && eligibleMartyrIds.length === 0) {
    return resolveReactiveWindow({
      ...room,
      currentNight: {
        ...room.currentNight,
        reactive: {
          attackerId,
          victimId,
          source,
          triggerCardId,
          step: 'martyr',
          currentResponderId: victimId,
          eligibleMonkIds: [],
          eligibleMartyrIds: [],
          pendingMartyrIds: [],
          responses: {},
        },
      },
    } as NinjaRoom)
  }

  const step = eligibleMonkIds.length > 0 ? 'monk' : 'martyr'
  const currentResponderId = step === 'monk' ? victimId : eligibleMartyrIds[0]!

  return {
    ...room,
    currentNight: {
      ...room.currentNight,
      reactive: {
        attackerId,
        victimId,
        source,
        triggerCardId,
        step,
        currentResponderId,
        eligibleMonkIds,
        eligibleMartyrIds,
        pendingMartyrIds: eligibleMartyrIds,
        responses: {},
      },
    },
  } as NinjaRoom
}

export async function submitReactiveResponse(
  roomId: string,
  playerId: string,
  response: ReactiveResponseChoice
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const reactive = room.currentNight?.reactive
    if (!reactive) return raw
    if (room.currentNight!.pendingAction) return raw
    const monkIds = reactive.eligibleMonkIds ?? []
    const martyrIds = reactive.eligibleMartyrIds ?? []
    const pendingMartyrIds = reactive.pendingMartyrIds ?? []
    if (reactive.currentResponderId !== playerId) return raw

    if (reactive.step === 'monk') {
      const isEligible = monkIds.includes(playerId)
      if (!isEligible) return raw
      if (response !== 'monk' && response !== 'pass') return raw
      const responses = { ...(reactive.responses ?? {}), [playerId]: response }
      if (response === 'monk') {
        return resolveReactiveWindow({
          ...room,
          currentNight: {
            ...room.currentNight!,
            reactive: { ...reactive, eligibleMonkIds: monkIds, eligibleMartyrIds: martyrIds, pendingMartyrIds, responses },
          },
        } as NinjaRoom)
      }
      if (pendingMartyrIds.length > 0) {
        return {
          ...room,
          currentNight: {
            ...room.currentNight!,
            reactive: {
              ...reactive,
              step: 'martyr',
              currentResponderId: pendingMartyrIds[0]!,
              eligibleMonkIds: monkIds,
              eligibleMartyrIds: martyrIds,
              pendingMartyrIds,
              responses,
            },
          },
        } as NinjaRoom
      }
      return resolveReactiveWindow({
        ...room,
        currentNight: {
          ...room.currentNight!,
          reactive: { ...reactive, eligibleMonkIds: monkIds, eligibleMartyrIds: martyrIds, pendingMartyrIds: [], responses },
        },
      } as NinjaRoom)
    }

    const isEligible = martyrIds.includes(playerId)
    if (!isEligible) return raw
    if (response !== 'martyr' && response !== 'pass') return raw
    const responses = { ...(reactive.responses ?? {}), [playerId]: response }
    if (response === 'martyr') {
      return resolveReactiveWindow({
        ...room,
        currentNight: {
          ...room.currentNight!,
          reactive: { ...reactive, eligibleMonkIds: monkIds, eligibleMartyrIds: martyrIds, pendingMartyrIds, responses },
        },
      } as NinjaRoom)
    }
    const remaining = pendingMartyrIds.filter((id) => id !== playerId)
    if (remaining.length > 0) {
      return {
        ...room,
        currentNight: {
          ...room.currentNight!,
          reactive: {
            ...reactive,
            currentResponderId: remaining[0]!,
            eligibleMonkIds: monkIds,
            eligibleMartyrIds: martyrIds,
            pendingMartyrIds: remaining,
            responses,
          },
        },
      } as NinjaRoom
    }
    return resolveReactiveWindow({
      ...room,
      currentNight: {
        ...room.currentNight!,
        reactive: { ...reactive, eligibleMonkIds: monkIds, eligibleMartyrIds: martyrIds, pendingMartyrIds: [], responses },
      },
    } as NinjaRoom)
  })
  await tryAdvanceResolution(roomId)
}

/**
 * Apply the reactive window's outcome:
 *  - Mirror Monk wins (highest priority) → kill the attacker, victim survives
 *  - Else Martyr wins → kill the martyr, victim survives
 *  - Else default → kill the original victim
 * In all cases, played reactive cards are moved from hand to discard.
 */
function resolveReactiveWindow(room: NinjaRoom): NinjaRoom {
  if (!room.currentNight?.reactive) return room
  const reactive = room.currentNight.reactive
  // RTDB drops empty arrays/objects on roundtrip — coerce them back to safe defaults.
  const eligibleMonkIds = reactive.eligibleMonkIds ?? []
  const eligibleMartyrIds = reactive.eligibleMartyrIds ?? []
  const responses = reactive.responses ?? {}
  let players = { ...room.players }
  let discard = [...(room.ninjaDiscardPile ?? [])]

  const monkPlayerId = eligibleMonkIds.find((id) => responses[id] === 'monk')
  const martyrPlayerId = eligibleMartyrIds.find((id) => responses[id] === 'martyr')

  let killTargetId: string = reactive.victimId

  if (monkPlayerId) {
    // Monk: discard the mirror_monk card, kill attacker.
    const p = players[monkPlayerId]!
    const monkCard = (p.hand ?? []).find((c) => c.kind === 'mirror_monk')
    if (monkCard) {
      players[monkPlayerId] = {
        ...p,
        hand: (p.hand ?? []).filter((c) => c.id !== monkCard.id),
      }
      discard.push(monkCard)
    }
    killTargetId = reactive.attackerId
  } else if (martyrPlayerId) {
    const p = players[martyrPlayerId]!
    const martyrCard = (p.hand ?? []).find((c) => c.kind === 'martyr')
    if (martyrCard) {
      players[martyrPlayerId] = {
        ...p,
        hand: (p.hand ?? []).filter((c) => c.id !== martyrCard.id),
      }
      discard.push(martyrCard)
    }
    killTargetId = martyrPlayerId
  }

  const victim = players[killTargetId]
  if (victim) {
    players[killTargetId] = { ...victim, isAlive: false }
  }

  // Discard the trigger card (the assassin/shinobi that opened the window).
  const owner = players[reactive.attackerId]
  if (owner) {
    const triggerCard = (owner.hand ?? []).find((c) => c.id === reactive.triggerCardId)
    if (triggerCard) {
      players[reactive.attackerId] = {
        ...owner,
        hand: (owner.hand ?? []).filter((c) => c.id !== triggerCard.id),
      }
      discard.push(triggerCard)
    }
  }

  return advanceQueueIndex({
    ...room,
    players,
    ninjaDiscardPile: discard,
    currentNight: { ...room.currentNight, reactive: null },
  } as NinjaRoom)
}

// ============================================================================
// Private state writer (out-of-transaction follow-up)
// ============================================================================

async function applyPrivateUpdate(
  roomId: string,
  upd: { ownerId: string; patch: Record<string, unknown> }
): Promise<void> {
  const baseRef = ref(db, `ninjaRooms/${roomId}/privateState/${upd.ownerId}/current`)
  const snap = await get(baseRef)
  const cur: NinjaPrivateRoundState = snap.exists()
    ? (snap.val() as NinjaPrivateRoundState)
    : buildBlankPrivateRound()
  const next: NinjaPrivateRoundState = {
    spyReveals: cur.spyReveals ?? [],
    mysticReveals: cur.mysticReveals ?? [],
    shinobiPeek: cur.shinobiPeek ?? null,
    spiritMerchantViews: cur.spiritMerchantViews ?? [],
    troublemakerPeek: cur.troublemakerPeek ?? null,
    shapeshifterPeeks: cur.shapeshifterPeeks ?? null,
  }
  if (upd.patch.addSpy) {
    next.spyReveals = [...next.spyReveals, upd.patch.addSpy as { targetId: string; card: HouseCard }]
  }
  if (upd.patch.addMystic) {
    next.mysticReveals = [
      ...next.mysticReveals,
      upd.patch.addMystic as (typeof next.mysticReveals)[number],
    ]
  }
  if (upd.patch.setShinobiPeek) {
    next.shinobiPeek = upd.patch.setShinobiPeek as { targetId: string; card: HouseCard }
  }
  if (upd.patch.addSpiritMerchant) {
    next.spiritMerchantViews = [
      ...next.spiritMerchantViews,
      upd.patch.addSpiritMerchant as (typeof next.spiritMerchantViews)[number],
    ]
  }
  if (upd.patch.setTroublemakerPeek !== undefined) {
    next.troublemakerPeek = upd.patch.setTroublemakerPeek as
      | { targetId: string; card: HouseCard }
      | null
  }
  if (upd.patch.setShapeshifterPeeks !== undefined) {
    next.shapeshifterPeeks = upd.patch.setShapeshifterPeeks as
      | { aId: string; aCard: HouseCard; bId: string; bCard: HouseCard }
      | null
  }
  await set(baseRef, next)
}

// ============================================================================
// Reveal & scoring
// ============================================================================

export async function finalizeRoundReveal(roomId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    if (room.state !== 'REVEAL') return raw
    if (room.reveal) return raw

    const players = { ...room.players }
    const aliveIds = Object.keys(players).filter((id) => players[id]?.isAlive)
    const houseAssignments = room.houseCardAssignments ?? {}

    // Compute winning house by best (lowest) surviving rank, with rank-vector tiebreak.
    const craneSurv: number[] = []
    const lotusSurv: number[] = []
    let roninAlive = false
    for (const id of aliveIds) {
      const card = houseAssignments[id]
      if (!card) continue
      if (card.side === 'crane') craneSurv.push(card.rank)
      else if (card.side === 'lotus') lotusSurv.push(card.rank)
      else if (card.side === 'ronin') roninAlive = true
    }
    craneSurv.sort((a, b) => a - b)
    lotusSurv.sort((a, b) => a - b)

    let winner: 'crane' | 'lotus' | 'tie' | 'none'
    if (craneSurv.length === 0 && lotusSurv.length === 0) {
      winner = 'none'
    } else if (craneSurv.length > 0 && lotusSurv.length === 0) {
      winner = 'crane'
    } else if (lotusSurv.length > 0 && craneSurv.length === 0) {
      winner = 'lotus'
    } else {
      winner = 'tie'
      for (let i = 0; i < Math.max(craneSurv.length, lotusSurv.length); i++) {
        const c = craneSurv[i]
        const l = lotusSurv[i]
        if (c === undefined && l === undefined) break
        if (c === undefined) {
          winner = 'lotus'
          break
        }
        if (l === undefined) {
          winner = 'crane'
          break
        }
        if (c < l) {
          winner = 'crane'
          break
        }
        if (l < c) {
          winner = 'lotus'
          break
        }
      }
    }
    const masterRevealedIds = room.mastermindRevealedAliveIds ?? []
    const mastermindCard = masterRevealedIds.length > 0
      ? houseAssignments[masterRevealedIds[0]!]
      : null
    const mastermindBlocked = mastermindCard?.side === 'ronin'
    if (mastermindCard?.side === 'crane' || mastermindCard?.side === 'lotus') {
      winner = mastermindCard.side
    }
    const perfectTie =
      !masterRevealedIds.length &&
      winner === 'tie' &&
      craneSurv.length === lotusSurv.length

    // Distribute tokens
    const bag = [...(room.tokenBag ?? [])]
    const tokensDrawn: Record<string, HonorToken[]> = {}

    function drawOne(): HonorToken | null {
      return bag.length > 0 ? bag.shift()! : null
    }

    function awardOne(id: string) {
      const t = drawOne()
      if (!t) return
      tokensDrawn[id] = [...(tokensDrawn[id] ?? []), t]
      players[id] = {
        ...players[id]!,
        honorTokens: [...(players[id]!.honorTokens ?? []), t],
      }
    }

    if (mastermindBlocked) {
      // Ronin Mastermind has no Crane/Lotus house to make victorious, so normal
      // house-token distribution is skipped. The Ronin survival bonus below
      // still awards the Ronin exactly one token (per FAQ).
    } else if (perfectTie) {
      for (const id of aliveIds) awardOne(id)
    } else if (winner === 'crane' || winner === 'lotus') {
      for (const [id] of Object.entries(players)) {
        const card = houseAssignments[id]
        if (!card || card.side !== winner) continue
        awardOne(id)
      }
    }

    // Ronin alive at end gets one token regardless of any other rule.
    if (roninAlive) {
      const roninId = Object.keys(houseAssignments).find(
        (id) => houseAssignments[id]?.side === 'ronin' && players[id]?.isAlive
      )
      if (roninId) awardOne(roninId)
    }

    // Game-end check
    const winners: string[] = []
    let topScore = -1
    for (const [id, p] of Object.entries(players)) {
      const score = (p.honorTokens ?? []).reduce((s, t) => s + t.value, 0)
      if (score >= HONOR_WIN_THRESHOLD) {
        if (score > topScore) {
          winners.length = 0
          winners.push(id)
          topScore = score
        } else if (score === topScore) {
          winners.push(id)
        }
      }
    }

    return {
      ...room,
      players,
      tokenBag: bag,
      reveal: {
        winningHouse: winner,
        aliveIds,
        tokensDrawn,
        masterRevealedIds,
        roninWasAlive: roninAlive,
        perfectTie,
        mastermindBlocked,
      },
      resultWinnerIds: winners.length > 0 ? winners : null,
      state: winners.length > 0 ? 'GAME_END' : 'REVEAL',
    } as NinjaRoom
  })
}

/**
 * Each player calls this once they've reviewed the round's reveal summary.
 * When all players have acknowledged, the next round starts automatically.
 */
export async function acknowledgeNinjaReveal(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  let allAcknowledged = false
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    if (room.state !== 'REVEAL') return raw
    if (room.resultWinnerIds && room.resultWinnerIds.length > 0) return raw
    if (!room.players?.[playerId]) return raw
    const players = { ...room.players }
    players[playerId] = { ...players[playerId]!, hasAcknowledgedReveal: true }
    allAcknowledged = Object.values(players).every((p) => p.hasAcknowledgedReveal === true)
    return { ...room, players } as NinjaRoom
  })
  if (allAcknowledged) {
    await startNinjaRound(roomId)
  }
}

/** Host-triggered transition from REVEAL to next round, bypassing player acknowledgements (use when someone is AFK). */
export async function startNextNinjaRound(roomId: string, hostPlayerId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  if (room.hostId !== hostPlayerId) throw new Error('只有房主可以强制开始下一回合')
  if (room.state !== 'REVEAL') return
  if (room.resultWinnerIds && room.resultWinnerIds.length > 0) return
  await startNinjaRound(roomId)
}

/** Restart from GAME_END or any state back to LOBBY. */
export async function restartNinjaToLobby(roomId: string, hostPlayerId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  if (room.hostId !== hostPlayerId) throw new Error('只有房主可以再来一局')

  const playerIds = getSeatOrder(room)
  const updates: Record<string, unknown> = {
    state: 'LOBBY',
    round: 0,
    targetPlayerCount: room.targetPlayerCount ?? Math.max(MIN_NINJA_PLAYERS, getSeatedPlayerIds(room).length),
    seatOrder: getSeatedPlayerIds(room),
    seatAssignments: room.seatAssignments ?? {},
    houseCardAssignments: {},
    publiclyRevealedHouseIds: [],
    mastermindRevealedAliveIds: [],
    tokenBag: [],
    ninjaDiscardPile: [],
    currentNight: null,
    reveal: null,
    resultWinnerIds: null,
  }
  for (const id of playerIds) {
    updates[`players/${id}/ready`] = false
    updates[`players/${id}/hand`] = []
    updates[`players/${id}/draftHand`] = []
    updates[`players/${id}/draftPick`] = null
    updates[`players/${id}/nightChoices`] = {}
    updates[`players/${id}/hasAcknowledgedHouse`] = false
    updates[`players/${id}/hasAcknowledgedReveal`] = false
    updates[`players/${id}/canViewHouse`] = true
    updates[`players/${id}/isAlive`] = true
    updates[`players/${id}/honorTokens`] = []
  }
  await update(roomRef, updates)
  await remove(ref(db, `ninjaRooms/${roomId}/privateState`))
}
