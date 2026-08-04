import { get, ref, remove, runTransaction, set, update } from 'firebase/database'
import {
  buildHonorTokenBag,
  buildHouseDeck,
  buildNinjaDeck,
  DRAFT_DEAL_SIZE,
  HONOR_WIN_THRESHOLD,
} from '../data/ninjaCards'
import { shuffle } from '../utils/shuffle'
import { clearActiveGame, clearActiveGameIfOwned, setActiveGame } from './activeGames'
import { ensureAnonymousAuth } from './auth'
import { db } from './firebase'
import { findPlayerIdByName, isPlayerOffline, normalizePlayerName } from './presence'
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
import {
  addPublicHouseReveal,
  appendPublicNightEvent,
  clearPublicHouseRevealFor,
  pickRandomIds,
  playerDisplayName,
} from './ninjaNightLog'

function findPlayerIdByUid(players: Record<string, NinjaPlayer>, uid: string): string | null {
  for (const [id, p] of Object.entries(players)) {
    if (p?.uid === uid) return id
  }
  return null
}

async function syncNinjaSeat(
  roomId: string,
  playerId: string,
  isHost: boolean,
  uid: string,
  existingUid?: string
): Promise<void> {
  const patch: Record<string, string | number> = { lastSeen: Date.now() }
  if (!existingUid) patch.uid = uid
  await update(ref(db, `ninjaRooms/${roomId}/players/${playerId}`), patch)
  await setActiveGame('ninja', roomId, playerId, isHost, uid)
}

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
}

const NIGHT_PHASE_ORDER: NinjaRoom['state'][] = [
  'NIGHT_SPY',
  'NIGHT_MYSTIC',
  'NIGHT_TRICKSTER',
  'NIGHT_BLIND_ASSASSIN',
  'NIGHT_SHINOBI',
]

// ============================================================================
// Room lifecycle: create, join, reconnect, kick, leave, ready, start
// ============================================================================

export type JoinNinjaResult =
  | {
      needsReclaim: true
      candidatePlayerId: string
      candidateName: string
      offline: boolean
      state: string
      isHost: boolean
    }
  | {
      needsReclaim?: false
      playerId: string
      reconnectToken: string
      isHost: boolean
      state: string
      rejoined?: boolean
      seatGeneration: number
    }

export async function createNinjaRoom(
  hostName: string
): Promise<{ roomId: string; playerId: string; reconnectToken: string; seatGeneration: number }> {
  const user = await ensureAnonymousAuth()
  const trimmed = hostName.trim()
  if (!trimmed) throw new Error('请输入你的名字')
  const roomId = generateRoomId()
  const playerId = generatePlayerId()
  const reconnectToken = generateReconnectToken()
  const now = Date.now()
  const seatGeneration = 0

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
        uid: user.uid,
        lastSeen: now,
        seatGeneration,
        honorTokens: [],
        ...DEFAULT_PLAYER_FIELDS,
      },
    },
    seatOrder: [playerId],
    seatAssignments: { [playerId]: 0 },
    houseCardAssignments: {},
    publiclyRevealedHouses: {},
    publiclyRevealedHouseIds: [],
    mastermindRevealedAliveIds: [],
    tokenBag: [],
    ninjaDiscardPile: [],
    currentNight: null,
    publicNightLog: [],
    reveal: null,
    resultWinnerIds: null,
    serverTimeOffset: 0,
  }

  await set(ref(db, `ninjaRooms/${roomId}`), room)
  await setActiveGame('ninja', roomId, playerId, true, user.uid)
  return { roomId, playerId, reconnectToken, seatGeneration }
}

export async function joinNinjaRoom(
  roomId: string,
  name: string
): Promise<JoinNinjaResult> {
  const user = await ensureAnonymousAuth()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('请输入你的名字')

  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  const players = room.players ?? {}

  const existingId = findPlayerIdByUid(players, user.uid)
  if (existingId) {
    const seat = players[existingId]!
    const isHost = room.hostId === existingId
    await syncNinjaSeat(roomId, existingId, isHost, user.uid, seat.uid)
    return {
      playerId: existingId,
      reconnectToken: seat.reconnectToken,
      isHost,
      state: room.state,
      rejoined: true,
      seatGeneration: Number(seat.seatGeneration) || 0,
    }
  }

  if (!normalizePlayerName(trimmed)) throw new Error('请输入你的名字')

  const nameMatchId = findPlayerIdByName(players, trimmed)
  if (nameMatchId) {
    const seat = players[nameMatchId]!
    return {
      needsReclaim: true,
      candidatePlayerId: nameMatchId,
      candidateName: seat.name?.trim() || trimmed,
      offline: isPlayerOffline(seat.lastSeen),
      state: room.state,
      isHost: room.hostId === nameMatchId,
    }
  }

  if (room.state !== 'LOBBY') throw new Error('Game has already started')

  const currentCount = Object.keys(players).length
  const targetCount = room.targetPlayerCount ?? MAX_NINJA_SEATS
  if (currentCount >= targetCount) throw new Error(`房间已满（本局 ${targetCount} 人）`)

  const playerId = generatePlayerId()
  const reconnectToken = generateReconnectToken()
  const now = Date.now()
  const seatGeneration = 0
  await update(ref(db, `ninjaRooms/${roomId}/players/${playerId}`), {
    name: trimmed,
    ready: false,
    reconnectToken,
    uid: user.uid,
    lastSeen: now,
    seatGeneration,
    honorTokens: [],
    ...DEFAULT_PLAYER_FIELDS,
  } as NinjaPlayer)

  await setActiveGame('ninja', roomId, playerId, false, user.uid)
  return {
    playerId,
    reconnectToken,
    isHost: false,
    state: 'LOBBY',
    seatGeneration,
  }
}

export async function reclaimNinjaSeatByName(
  roomId: string,
  name: string,
  options?: { force?: boolean }
): Promise<{
  playerId: string
  reconnectToken: string
  isHost: boolean
  state: string
  seatGeneration: number
}> {
  const force = options?.force === true
  const user = await ensureAnonymousAuth()
  const snapshot = await get(ref(db, `ninjaRooms/${roomId}`))
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  const players = room.players ?? {}
  const playerId = findPlayerIdByName(players, name)
  if (!playerId) throw new Error('未找到同名座位')
  const seat = players[playerId]!
  if (!force && !isPlayerOffline(seat.lastSeen)) {
    throw new Error('SEAT_ONLINE_CONFIRM')
  }
  const newToken = generateReconnectToken()
  const nextGen = (Number(seat.seatGeneration) || 0) + 1
  const isHost = room.hostId === playerId
  await update(ref(db, `ninjaRooms/${roomId}/players/${playerId}`), {
    uid: user.uid,
    reconnectToken: newToken,
    seatGeneration: nextGen,
    lastSeen: Date.now(),
  })
  if (room.state === 'GAME_END') {
    await clearActiveGame('ninja', roomId, user.uid)
  } else {
    await setActiveGame('ninja', roomId, playerId, isHost, user.uid)
  }
  return {
    playerId,
    reconnectToken: newToken,
    isHost,
    state: room.state,
    seatGeneration: nextGen,
  }
}

export async function reconnectNinjaRoom(
  roomId: string,
  playerId: string
): Promise<{
  roomId: string
  playerId: string
  isHost: boolean
  state: string
  reconnectToken?: string
  seatGeneration: number
}> {
  const user = await ensureAnonymousAuth()
  const snapshot = await get(ref(db, `ninjaRooms/${roomId}`))
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  if (!room.players?.[playerId]) throw new Error('You are not in this room')
  const isHost = room.hostId === playerId
  const seatGeneration = Number(room.players[playerId]?.seatGeneration) || 0
  if (room.state === 'GAME_END') {
    await clearActiveGame('ninja', roomId, user.uid)
  } else {
    await syncNinjaSeat(roomId, playerId, isHost, user.uid, room.players[playerId]?.uid)
  }
  return {
    roomId,
    playerId,
    isHost,
    state: room.state,
    reconnectToken: room.players[playerId]?.reconnectToken,
    seatGeneration,
  }
}

export async function reconnectNinjaByUid(
  roomId: string
): Promise<{
  roomId: string
  playerId: string
  isHost: boolean
  state: string
  reconnectToken?: string
  seatGeneration: number
}> {
  const user = await ensureAnonymousAuth()
  const snapshot = await get(ref(db, `ninjaRooms/${roomId}`))
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as NinjaRoom
  const playerId = findPlayerIdByUid(room.players ?? {}, user.uid)
  if (!playerId) throw new Error('You are not in this room')
  return reconnectNinjaRoom(roomId, playerId)
}

export async function reconnectNinjaByToken(
  roomId: string,
  token: string
): Promise<{
  roomId: string
  playerId: string
  isHost: boolean
  state: string
  reconnectToken: string
  seatGeneration: number
}> {
  const user = await ensureAnonymousAuth()
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
  const isHost = room.hostId === matchedId
  const nextGen = (Number(players[matchedId]?.seatGeneration) || 0) + 1
  await update(ref(db, `ninjaRooms/${roomId}/players/${matchedId}`), {
    reconnectToken: newToken,
    uid: user.uid,
    lastSeen: Date.now(),
    seatGeneration: nextGen,
  })
  if (room.state === 'GAME_END') {
    await clearActiveGame('ninja', roomId, user.uid)
  } else {
    await setActiveGame('ninja', roomId, matchedId, isHost, user.uid)
  }
  return {
    roomId,
    playerId: matchedId,
    isHost,
    state: room.state,
    reconnectToken: newToken,
    seatGeneration: nextGen,
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
  const targetUid = players[targetPlayerId]?.uid
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
  if (targetUid) {
    await clearActiveGame('ninja', roomId, targetUid)
  }
}

export async function leaveNinjaLobby(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    await clearActiveGameIfOwned('ninja', roomId, playerId)
    return
  }
  const room = snapshot.val() as NinjaRoom
  if (room.state !== 'LOBBY') return
  const players = room.players ?? {}
  if (!players[playerId]) {
    await clearActiveGameIfOwned('ninja', roomId, playerId)
    return
  }
  const leaverUid = players[playerId]?.uid
  const ids = getSeatOrder(room)
  if (ids.length === 1) {
    await remove(roomRef)
    await clearActiveGame('ninja', roomId, leaverUid)
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
    await clearActiveGame('ninja', roomId, leaverUid)
    return
  }
  await update(roomRef, { [`players/${playerId}`]: null, [`seatAssignments/${playerId}`]: null, seatOrder: nextSeatOrder })
  await clearActiveGame('ninja', roomId, leaverUid)
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
      publiclyRevealedHouses: {},
      publiclyRevealedHouseIds: [],
      mastermindRevealedAliveIds: [],
      ninjaDiscardPile: [],
      currentNight: null,
      publicNightLog: [],
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

function listAlivePlayerIds(room: NinjaRoom): string[] {
  return getSeatOrder(room).filter((id) => room.players?.[id]?.isAlive)
}

function playerReadyForPhase(room: NinjaRoom, playerId: string, kind: NinjaCardKind): boolean {
  const p = room.players?.[playerId]
  if (!p?.isAlive) return true
  const matching = (p.hand ?? []).filter((c) => c.kind === kind)
  if (matching.length === 0) {
    return (room.currentNight?.phaseAckIds ?? []).includes(playerId)
  }
  return matching.every((c) => p.nightChoices?.[c.id] !== undefined)
}

function allAliveReadyForPhase(room: NinjaRoom, kind: NinjaCardKind): boolean {
  return listAlivePlayerIds(room).every((id) => playerReadyForPhase(room, id, kind))
}

function buildPhaseResolutionQueue(
  room: NinjaRoom,
  kind: NinjaCardKind
): { playerId: string; cardId: string; priority: number }[] {
  const queue: { playerId: string; cardId: string; priority: number }[] = []
  const seatOrder = getSeatOrder(room)
  for (const id of seatOrder) {
    const p = room.players?.[id]
    if (!p?.isAlive) continue
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
  return queue
}

function lockNightDeclarations(room: NinjaRoom, kind: NinjaCardKind): NinjaRoom {
  if (!room.currentNight) return room
  const queue = buildPhaseResolutionQueue(room, kind)
  const kindLabel =
    kind === 'spy'
      ? '密探'
      : kind === 'mystic'
        ? '隐士'
        : kind === 'trickster'
          ? '骗徒'
          : kind === 'blind_assassin'
            ? '盲眼刺客'
            : '上忍'
  let next = room
  if (queue.length === 0) {
    next = appendPublicNightEvent(next, {
      kind: 'phase_skip',
      text: `${kindLabel}阶段：无人出牌`,
    })
  } else {
    const names = queue
      .map((q) => {
        const card = room.players?.[q.playerId]?.hand?.find((c) => c.id === q.cardId)
        return `${playerDisplayName(room, q.playerId)} 打出 ${card?.name ?? kindLabel}`
      })
      .join('；')
    next = appendPublicNightEvent(next, {
      kind: 'phase_plays',
      text: `${kindLabel}阶段：${names}`,
    })
  }
  return {
    ...next,
    currentNight: {
      ...next.currentNight!,
      resolutionQueue: queue,
      resolutionIndex: queue.length === 0 ? queue.length : 0,
      declarationsLocked: true,
      phaseAckIds: listAlivePlayerIds(next),
    },
  } as NinjaRoom
}

/**
 * Set up `currentNight` for the current night state.
 * Empty phases still wait for all-alive acknowledgement (no instant skip).
 */
export async function primeNightPhaseIfNeeded(roomId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const kind = NIGHT_PHASE_TO_KIND[room.state]
    if (!kind) return raw
    if (room.currentNight && room.currentNight.kind === kind) return raw
    return {
      ...room,
      currentNight: {
        kind,
        resolutionQueue: [],
        resolutionIndex: -1,
        declarationsLocked: false,
        phaseAckIds: [],
        pendingAction: null,
        reactive: null,
      },
    } as NinjaRoom
  })
  const post = (await get(roomRef)).val() as NinjaRoom | null
  if (post?.state === 'REVEAL' && !post.reveal) {
    await finalizeRoundReveal(roomId)
  }
}

function nextStateAfter(state: NinjaRoom['state']): NinjaRoom['state'] {
  const idx = NIGHT_PHASE_ORDER.indexOf(state)
  if (idx === -1) return 'REVEAL'
  if (idx === NIGHT_PHASE_ORDER.length - 1) return 'REVEAL'
  return NIGHT_PHASE_ORDER[idx + 1]!
}

/** Auto-reveal Mastermind cards held by living players at end of night. */
function autoRevealMasterminds(room: NinjaRoom): NinjaRoom {
  let next = room
  const players = { ...next.players }
  let discard = [...(next.ninjaDiscardPile ?? [])]
  const revealed = [...(next.mastermindRevealedAliveIds ?? [])]
  for (const id of listAlivePlayerIds(next)) {
    const p = players[id]
    if (!p) continue
    const mm = (p.hand ?? []).find((c) => c.kind === 'mastermind')
    if (!mm) continue
    players[id] = { ...p, hand: (p.hand ?? []).filter((c) => c.id !== mm.id) }
    discard.push(mm)
    if (!revealed.includes(id)) revealed.push(id)
    next = appendPublicNightEvent(
      { ...next, players, ninjaDiscardPile: discard, mastermindRevealedAliveIds: revealed } as NinjaRoom,
      {
        kind: 'mastermind',
        actorId: id,
        cardLabel: '首脑',
        text: `${playerDisplayName(next, id)} · 首脑 · 自动公开`,
      }
    )
  }
  return {
    ...next,
    players,
    ninjaDiscardPile: discard,
    mastermindRevealedAliveIds: revealed,
  } as NinjaRoom
}

/** Used by transactions. Clears currentNight and advances state. Caller follows up to prime new phase. */
function advanceFromCurrentPhase(room: NinjaRoom): NinjaRoom {
  const nextState = nextStateAfter(room.state)
  let next = room
  if (nextState === 'REVEAL') {
    next = autoRevealMasterminds(next)
  }
  return {
    ...next,
    currentNight: null,
    state: nextState,
  } as NinjaRoom
}

/** Alive player with no matching phase cards confirms “本阶段无行动”. */
export async function ackNightPhase(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const kind = NIGHT_PHASE_TO_KIND[room.state]
    if (!kind || !room.currentNight || room.currentNight.declarationsLocked) return raw
    const me = room.players?.[playerId]
    if (!me?.isAlive) return raw
    const matching = (me.hand ?? []).filter((c) => c.kind === kind)
    if (matching.length > 0) return raw
    const phaseAckIds = [...new Set([...(room.currentNight.phaseAckIds ?? []), playerId])]
    let next = {
      ...room,
      currentNight: { ...room.currentNight, phaseAckIds },
    } as NinjaRoom
    if (allAliveReadyForPhase(next, kind)) {
      next = lockNightDeclarations(next, kind)
    }
    return next
  })
  await tryAdvanceResolution(roomId)
}

/**
 * Player declares whether to play or hold a specific card of the current phase's kind.
 * Locks when every alive player is ready (holders declared; others acked).
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

    let next = { ...room, players } as NinjaRoom
    if (allAliveReadyForPhase(next, kind)) {
      next = lockNightDeclarations(next, kind)
    }
    return next
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
    gravediggerPickedId: null,
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
    if (!card.variant || !KNOWN_TRICKSTER_VARIANTS.includes(card.variant)) return null

    if (card.variant === 'gravedigger') {
      const optionIds = pickRandomIds(
        discardPile.map((c) => c.id),
        2
      )
      return makePendingAction({
        ownerId,
        card,
        step: 'gravedigger_pick',
        overrides: { gravediggerOptionIds: optionIds },
      })
    }
    // Thief with no eligible targets: still self-reveal via applySelfResolving path (null pending).
    if (card.variant === 'thief' && room) {
      const eligible = getEligibleThiefTargetIds(room, ownerId)
      if (eligible.length === 0) return null
    }
    return makePendingAction({ ownerId, card, step: 'pick_target' })
  }
  return null
}

/**
 * Mastermind no longer resolves via declaration queue.
 * Thief with no steal targets still publicly reveals house.
 */
function applySelfResolvingCard(
  room: NinjaRoom,
  ownerId: string,
  card: NinjaCard
): NinjaRoom {
  if (card.kind === 'trickster' && card.variant === 'thief') {
    let next = addPublicHouseReveal(clearPending(room), ownerId)
    next = appendPublicNightEvent(next, {
      kind: 'public_reveal',
      actorId: ownerId,
      cardLabel: '盗贼',
      text: `${playerDisplayName(next, ownerId)} · 盗贼 · 公开身份，无人可偷`,
    })
    return discardPlayedCard(advanceQueueIndex(next), ownerId, card.id)
  }
  if (card.kind === 'mastermind') {
    const owner = room.players?.[ownerId]
    const revealed = [...(room.mastermindRevealedAliveIds ?? [])]
    if (owner?.isAlive && !revealed.includes(ownerId)) revealed.push(ownerId)
    let next = {
      ...clearPending(room),
      mastermindRevealedAliveIds: revealed,
    } as NinjaRoom
    next = appendPublicNightEvent(next, {
      kind: 'mastermind',
      actorId: ownerId,
      cardLabel: '首脑',
      text: `${playerDisplayName(next, ownerId)} · 首脑 · 公开`,
    })
    return discardPlayedCard(advanceQueueIndex(next), ownerId, card.id)
  }
  return discardPlayedCard(advanceQueueIndex(room), ownerId, card.id)
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
    // Shapeshifter may pick self; Shinobi may pick self; Blind Assassin cannot.
    const allowSelf =
      (card.kind === 'trickster' && card.variant === 'shapeshifter') || card.kind === 'shinobi'
    if (!allowSelf && targetId === playerId) return raw

    if (pa.kind === 'spy') {
      const houseCard = room.houseCardAssignments?.[targetId]
      if (!houseCard) return raw
      privateUpdate = {
        ownerId: playerId,
        patch: { addSpy: { targetId, card: houseCard } },
      }
      let next = discardPlayedCard(advanceQueueIndex(clearPending(room)), playerId, pa.cardId)
      next = appendPublicNightEvent(next, {
        kind: 'peek',
        actorId: playerId,
        cardLabel: card.name,
        targetIds: [targetId],
        text: `${playerDisplayName(next, playerId)} · ${card.name} · 查看了 ${playerDisplayName(next, targetId)}`,
      })
      return next
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
      let next = discardPlayedCard(advanceQueueIndex(clearPending(room)), playerId, pa.cardId)
      next = appendPublicNightEvent(next, {
        kind: 'peek',
        actorId: playerId,
        cardLabel: card.name,
        targetIds: [targetId],
        text: `${playerDisplayName(next, playerId)} · ${card.name} · 查看了 ${playerDisplayName(next, targetId)}`,
      })
      return next
    }

    if (pa.kind === 'blind_assassin') {
      let next = clearPending(room)
      next = appendPublicNightEvent(next, {
        kind: 'kill',
        actorId: playerId,
        cardLabel: card.name,
        targetIds: [targetId],
        text: `${playerDisplayName(next, playerId)} · ${card.name} · 暗杀 ${playerDisplayName(next, targetId)}`,
      })
      return openReactiveWindow(next, playerId, targetId, 'blind_assassin', pa.cardId)
    }

    if (pa.kind === 'shinobi') {
      const houseCard = room.houseCardAssignments?.[targetId]
      if (!houseCard) return raw
      privateUpdate = {
        ownerId: playerId,
        patch: { setShinobiPeek: { targetId, card: houseCard } },
      }
      let next = {
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
      next = appendPublicNightEvent(next, {
        kind: 'peek',
        actorId: playerId,
        cardLabel: card.name,
        targetIds: [targetId],
        text: `${playerDisplayName(next, playerId)} · ${card.name} · 查看了 ${
          targetId === playerId ? '自己' : playerDisplayName(next, targetId)
        }`,
      })
      return next
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
    let next = clearPending(room)
    next = appendPublicNightEvent(next, {
      kind: 'kill',
      actorId: playerId,
      cardLabel: '上忍',
      targetIds: [targetId],
      text: `${playerDisplayName(next, playerId)} · 上忍 · 暗杀 ${
        targetId === playerId ? '自己' : playerDisplayName(next, targetId)
      }`,
    })
    return openReactiveWindow(next, playerId, targetId, 'shinobi', pa.cardId)
  })
  await tryAdvanceResolution(roomId)
}

function addPubliclyRevealed(room: NinjaRoom, playerId: string): NinjaRoom {
  return addPublicHouseReveal(room, playerId)
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
    const owner = room.players?.[ownerId]
    if (!owner) return room
    const myTokenCount = (owner.honorTokens ?? []).length
    const target = room.players?.[targetId]
    if (!target) return room
    const targetTokens = target.honorTokens ?? []
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
    let next = addPubliclyRevealed({ ...clearPending(room), players } as NinjaRoom, ownerId)
    next = appendPublicNightEvent(next, {
      kind: 'steal',
      actorId: ownerId,
      cardLabel: '盗贼',
      targetIds: [targetId],
      text: `${playerDisplayName(next, ownerId)} · 盗贼 · 公开身份并偷取 ${playerDisplayName(next, targetId)} 的荣誉标记`,
    })
    return discardPlayedCard(advanceQueueIndex(next), ownerId, card.id)
  }

  if (variant === 'troublemaker') {
    let next = {
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
    next = appendPublicNightEvent(next, {
      kind: 'peek',
      actorId: ownerId,
      cardLabel: '麻烦制造者',
      targetIds: [targetId],
      text: `${playerDisplayName(next, ownerId)} · 麻烦制造者 · 查看了 ${playerDisplayName(next, targetId)}`,
    })
    return next
  }

  if (variant === 'judgement') {
    const target = room.players?.[targetId]
    if (!target) return room
    const players = { ...room.players, [targetId]: { ...target, isAlive: false } }
    let next = addPubliclyRevealed({ ...clearPending(room), players } as NinjaRoom, ownerId)
    next = appendPublicNightEvent(next, {
      kind: 'kill',
      actorId: ownerId,
      cardLabel: '审判',
      targetIds: [targetId],
      text: `${playerDisplayName(next, ownerId)} · 审判 · 公开身份并击杀 ${playerDisplayName(next, targetId)}`,
    })
    return discardPlayedCard(advanceQueueIndex(next), ownerId, card.id)
  }

  if (variant === 'spirit_merchant') {
    return {
      ...room,
      currentNight: {
        ...room.currentNight!,
        pendingAction: makePendingAction({
          ownerId,
          card,
          step: 'spirit_merchant_view',
          overrides: { spiritMerchantTargetId: targetId },
        }),
      },
    } as NinjaRoom
  }

  return discardPlayedCard(advanceQueueIndex(clearPending(room)), ownerId, card.id)
}

/** Spirit Merchant step 1: view house or one token (private), then move to swap step. */
export async function submitSpiritMerchantView(
  roomId: string,
  playerId: string,
  viewKind: 'token' | 'house'
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  let privateUpdate: { ownerId: string; patch: Record<string, unknown> } | null = null
  let targetIdForLog: string | null = null
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const pa = room.currentNight?.pendingAction
    if (!pa || pa.step !== 'spirit_merchant_view' || pa.playerId !== playerId) return raw
    const targetId = pa.spiritMerchantTargetId
    if (!targetId) return raw
    const owner = room.players?.[playerId]
    const target = room.players?.[targetId]
    if (!owner || !target) return raw
    targetIdForLog = targetId

    let viewedToken: HonorToken | null = null
    let viewedHouse: HouseCard | null = null
    if (viewKind === 'token') {
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

    const card = (owner.hand ?? []).find((c) => c.id === pa.cardId)
    if (!card) return raw
    let next = {
      ...room,
      currentNight: {
        ...room.currentNight!,
        pendingAction: makePendingAction({
          ownerId: playerId,
          card,
          step: 'spirit_merchant_swap',
          overrides: { spiritMerchantTargetId: targetId },
        }),
      },
    } as NinjaRoom
    next = appendPublicNightEvent(next, {
      kind: 'spirit_merchant',
      actorId: playerId,
      cardLabel: '灵商',
      targetIds: [targetId],
      text: `${playerDisplayName(next, playerId)} · 灵商 · 查看了 ${playerDisplayName(next, targetId)} 的${
        viewKind === 'house' ? '流派' : '荣誉标记'
      }`,
    })
    return next
  })
  if (privateUpdate) await applyPrivateUpdate(roomId, privateUpdate)
  void targetIdForLog
}

/** Spirit Merchant step 2: optional 1-for-1 token swap (requires own token). */
export async function submitSpiritMerchantSwap(
  roomId: string,
  playerId: string,
  swap: { giveOwnTokenId: string; takeTargetTokenId: string } | null
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
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

    let players = { ...room.players }
    let didSwap = false
    if (swap) {
      const give = (owner.honorTokens ?? []).find((t) => t.id === swap.giveOwnTokenId)
      const take = (target.honorTokens ?? []).find((t) => t.id === swap.takeTargetTokenId)
      if (give && take) {
        didSwap = true
        players[playerId] = {
          ...owner,
          honorTokens: [...(owner.honorTokens ?? []).filter((t) => t.id !== give.id), take],
        }
        players[targetId] = {
          ...target,
          honorTokens: [...(target.honorTokens ?? []).filter((t) => t.id !== take.id), give],
        }
      }
    }

    let next = { ...clearPending(room), players } as NinjaRoom
    if (didSwap) {
      next = appendPublicNightEvent(next, {
        kind: 'spirit_merchant',
        actorId: playerId,
        cardLabel: '灵商',
        targetIds: [targetId],
        text: `${playerDisplayName(next, playerId)} · 灵商 · 与 ${playerDisplayName(next, targetId)} 交换了荣誉标记`,
      })
    }
    return discardPlayedCard(advanceQueueIndex(next), playerId, pa.cardId)
  })
  await tryAdvanceResolution(roomId)
}

/** @deprecated Use submitSpiritMerchantView + submitSpiritMerchantSwap. */
export async function submitSpiritMerchantChoice(
  roomId: string,
  playerId: string,
  payload: {
    viewKind: 'token' | 'house'
    swap: { giveOwnTokenId: string; takeTargetTokenId: string } | null
  }
): Promise<void> {
  await submitSpiritMerchantView(roomId, playerId, payload.viewKind)
  await submitSpiritMerchantSwap(roomId, playerId, payload.swap)
}

/** Gravedigger: must pick one option when available → then decide play-now or keep. */
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
    const optionIds = pa.gravediggerOptionIds ?? []
    const card = (owner.hand ?? []).find((c) => c.id === pa.cardId)
    if (!card) return raw

    // Empty discard options: just finish the gravedigger.
    if (optionIds.length === 0) {
      let next = clearPending(room)
      next = appendPublicNightEvent(next, {
        kind: 'gravedigger',
        actorId: playerId,
        cardLabel: '盗墓者',
        text: `${playerDisplayName(next, playerId)} · 盗墓者 · 弃牌堆为空`,
      })
      return discardPlayedCard(advanceQueueIndex(next), playerId, pa.cardId)
    }

    if (!pickedCardId || !optionIds.includes(pickedCardId)) return raw
    const discard = room.ninjaDiscardPile ?? []
    if (!discard.some((c) => c.id === pickedCardId)) return raw

    return {
      ...room,
      currentNight: {
        ...room.currentNight!,
        pendingAction: makePendingAction({
          ownerId: playerId,
          card,
          step: 'gravedigger_decide',
          overrides: {
            gravediggerOptionIds: optionIds,
            gravediggerPickedId: pickedCardId,
          },
        }),
      },
    } as NinjaRoom
  })
}

/** Gravedigger step 2: keep in hand or play immediately (may skip phases). */
export async function submitGravediggerDecision(
  roomId: string,
  playerId: string,
  playNow: boolean
): Promise<void> {
  const roomRef = ref(db, `ninjaRooms/${roomId}`)
  await runTransaction(roomRef, (raw) => {
    if (!raw) return raw
    const room = raw as NinjaRoom
    const pa = room.currentNight?.pendingAction
    if (!pa || pa.step !== 'gravedigger_decide' || pa.playerId !== playerId) return raw
    const pickedId = pa.gravediggerPickedId
    if (!pickedId) return raw
    const owner = room.players?.[playerId]
    if (!owner) return raw

    let discard = [...(room.ninjaDiscardPile ?? [])]
    const idx = discard.findIndex((c) => c.id === pickedId)
    if (idx === -1) return raw
    const taken = discard[idx]!
    discard = discard.filter((_, i) => i !== idx)

    const players = { ...room.players }
    players[playerId] = {
      ...owner,
      hand: [...(owner.hand ?? []), taken],
    }

    let next = {
      ...clearPending(room),
      players,
      ninjaDiscardPile: discard,
    } as NinjaRoom

    // Discard the Gravedigger itself and advance its queue slot.
    next = discardPlayedCard(advanceQueueIndex(next), playerId, pa.cardId)

    if (!playNow) {
      next = appendPublicNightEvent(next, {
        kind: 'gravedigger',
        actorId: playerId,
        cardLabel: '盗墓者',
        text: `${playerDisplayName(next, playerId)} · 盗墓者 · 取走 1 张并留下`,
      })
      return next
    }

    // Play immediately: set pending for the dug card (already in hand).
    const dugPending = buildPendingAction(playerId, taken, next.ninjaDiscardPile ?? [], next)
    next = appendPublicNightEvent(next, {
      kind: 'gravedigger',
      actorId: playerId,
      cardLabel: '盗墓者',
      text: `${playerDisplayName(next, playerId)} · 盗墓者 · 取走并立即打出「${taken.name}」`,
    })
    if (dugPending) {
      return {
        ...next,
        currentNight: next.currentNight
          ? { ...next.currentNight, pendingAction: dugPending }
          : next.currentNight,
      } as NinjaRoom
    }
    // Self-resolving dug card (e.g. empty-target thief)
    return applySelfResolvingCard(next, playerId, taken)
  })
  await primeTroublemakerPeek(roomId)
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
    if (reveal) {
      next = addPubliclyRevealed(next, targetId)
      next = appendPublicNightEvent(next, {
        kind: 'public_reveal',
        actorId: playerId,
        cardLabel: '麻烦制造者',
        targetIds: [targetId],
        text: `${playerDisplayName(next, playerId)} · 麻烦制造者 · 当众揭示 ${playerDisplayName(next, targetId)} 的流派`,
      })
    }
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
    let next = {
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
    next = appendPublicNightEvent(next, {
      kind: 'peek',
      actorId: playerId,
      cardLabel: '变形者',
      targetIds: [aId, bId],
      text: `${playerDisplayName(next, playerId)} · 变形者 · 查看了 ${playerDisplayName(next, aId)}、${playerDisplayName(next, bId)}`,
    })
    return next
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
      next = clearPublicHouseRevealFor(next, aId, bId)
      next = appendPublicNightEvent(next, {
        kind: 'swap_lock',
        actorId: playerId,
        cardLabel: '变形者',
        targetIds: [aId, bId],
        text: `${playerDisplayName(next, aId)}、${playerDisplayName(next, bId)} 的流派被交换（内容保密）；二人不可再自由查看自己的牌`,
      })
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

function drawHonorTokenFromBag(room: NinjaRoom, playerId: string): NinjaRoom {
  const bag = [...(room.tokenBag ?? [])]
  if (bag.length === 0) return room
  const token = bag.shift()!
  const player = room.players?.[playerId]
  if (!player) return room
  return {
    ...room,
    tokenBag: bag,
    players: {
      ...room.players,
      [playerId]: {
        ...player,
        honorTokens: [...(player.honorTokens ?? []), token],
      },
    },
  } as NinjaRoom
}

function openReactiveWindow(
  room: NinjaRoom,
  attackerId: string,
  victimId: string,
  source: 'blind_assassin' | 'shinobi',
  triggerCardId: string
): NinjaRoom {
  if (!room.currentNight) return room
  const players = room.players ?? {}
  const victim = players[victimId]
  const eligibleMonkIds: string[] = []
  const eligibleMartyrIds: string[] = []
  if (victim?.isAlive && (victim.hand ?? []).some((c) => c.kind === 'mirror_monk')) {
    eligibleMonkIds.push(victimId)
  }
  if (victim?.isAlive && (victim.hand ?? []).some((c) => c.kind === 'martyr')) {
    eligibleMartyrIds.push(victimId)
  }

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
        currentResponderId: victimId,
        eligibleMonkIds,
        eligibleMartyrIds,
        pendingMartyrIds: [],
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
    if (reactive.currentResponderId !== playerId) return raw
    if (reactive.victimId !== playerId) return raw

    const monkIds = reactive.eligibleMonkIds ?? []
    const martyrIds = reactive.eligibleMartyrIds ?? []
    const responses = { ...(reactive.responses ?? {}), [playerId]: response }

    if (reactive.step === 'monk') {
      if (!monkIds.includes(playerId)) return raw
      if (response !== 'monk' && response !== 'pass') return raw
      if (response === 'monk') {
        return resolveReactiveWindow({
          ...room,
          currentNight: {
            ...room.currentNight!,
            reactive: { ...reactive, responses },
          },
        } as NinjaRoom)
      }
      if (martyrIds.includes(playerId)) {
        return {
          ...room,
          currentNight: {
            ...room.currentNight!,
            reactive: {
              ...reactive,
              step: 'martyr',
              currentResponderId: playerId,
              responses,
            },
          },
        } as NinjaRoom
      }
      return resolveReactiveWindow({
        ...room,
        currentNight: {
          ...room.currentNight!,
          reactive: { ...reactive, responses },
        },
      } as NinjaRoom)
    }

    if (reactive.step === 'martyr') {
      if (!martyrIds.includes(playerId)) return raw
      if (response !== 'martyr' && response !== 'pass') return raw
      return resolveReactiveWindow({
        ...room,
        currentNight: {
          ...room.currentNight!,
          reactive: { ...reactive, responses },
        },
      } as NinjaRoom)
    }

    return raw
  })
  await tryAdvanceResolution(roomId)
}

function resolveReactiveWindow(room: NinjaRoom): NinjaRoom {
  if (!room.currentNight?.reactive) return room
  const reactive = room.currentNight.reactive
  const responses = reactive.responses ?? {}
  let players = { ...room.players }
  let discard = [...(room.ninjaDiscardPile ?? [])]
  let next = room

  const victimId = reactive.victimId
  const attackerId = reactive.attackerId
  const monkPlayed = responses[victimId] === 'monk'
  const martyrPlayed = responses[victimId] === 'martyr'

  let killTargetId: string | null = victimId

  if (monkPlayed) {
    const p = players[victimId]
    const monkCard = (p?.hand ?? []).find((c) => c.kind === 'mirror_monk')
    if (monkCard && p) {
      players[victimId] = { ...p, hand: (p.hand ?? []).filter((c) => c.id !== monkCard.id) }
      discard.push(monkCard)
    }
    killTargetId = attackerId
    next = appendPublicNightEvent(
      { ...next, players, ninjaDiscardPile: discard } as NinjaRoom,
      {
        kind: 'reactive',
        actorId: victimId,
        cardLabel: '还施僧',
        targetIds: [attackerId],
        text: `${playerDisplayName(next, victimId)} · 还施僧 · 反弹，${playerDisplayName(next, attackerId)} 出局`,
      }
    )
    players = { ...next.players }
    discard = [...(next.ninjaDiscardPile ?? [])]
  } else if (martyrPlayed) {
    const p = players[victimId]
    const martyrCard = (p?.hand ?? []).find((c) => c.kind === 'martyr')
    if (martyrCard && p) {
      players[victimId] = { ...p, hand: (p.hand ?? []).filter((c) => c.id !== martyrCard.id) }
      discard.push(martyrCard)
    }
    killTargetId = null
    next = { ...next, players, ninjaDiscardPile: discard } as NinjaRoom
    next = drawHonorTokenFromBag(next, victimId)
    next = appendPublicNightEvent(next, {
      kind: 'reactive',
      actorId: victimId,
      cardLabel: '殉道者',
      text: `${playerDisplayName(next, victimId)} · 殉道者 · 保命并获得荣誉标记`,
    })
    players = { ...next.players }
    discard = [...(next.ninjaDiscardPile ?? [])]
  }

  if (killTargetId) {
    const victim = players[killTargetId]
    if (victim) players[killTargetId] = { ...victim, isAlive: false }
    if (!monkPlayed) {
      next = appendPublicNightEvent(
        { ...next, players, ninjaDiscardPile: discard } as NinjaRoom,
        {
          kind: 'kill',
          targetIds: [killTargetId],
          text: `${playerDisplayName(next, killTargetId)} 出局`,
        }
      )
      players = { ...next.players }
      discard = [...(next.ninjaDiscardPile ?? [])]
    } else {
      next = { ...next, players, ninjaDiscardPile: discard } as NinjaRoom
    }
  } else {
    next = { ...next, players, ninjaDiscardPile: discard } as NinjaRoom
  }

  const attacker = next.players?.[attackerId]
  const trigger = (attacker?.hand ?? []).find((c) => c.id === reactive.triggerCardId)
  if (attacker && trigger) {
    next = {
      ...next,
      players: {
        ...next.players,
        [attackerId]: { ...attacker, hand: (attacker.hand ?? []).filter((c) => c.id !== trigger.id) },
      },
      ninjaDiscardPile: [...(next.ninjaDiscardPile ?? []), trigger],
    } as NinjaRoom
  }

  return advanceQueueIndex({
    ...next,
    currentNight: { ...next.currentNight!, reactive: null },
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
    publiclyRevealedHouses: {},
    publiclyRevealedHouseIds: [],
    mastermindRevealedAliveIds: [],
    tokenBag: [],
    ninjaDiscardPile: [],
    currentNight: null,
    publicNightLog: [],
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
