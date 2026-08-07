import { get, ref, remove, set, update } from 'firebase/database'
import { clearActiveGame, clearActiveGameIfOwned, setActiveGame } from './activeGames.ts'
import { ensureAnonymousAuth } from './auth.ts'
import { db } from './firebase.ts'
import { findPlayerIdByName, isPlayerOffline, normalizePlayerName } from './presence.ts'
import { getMissionTeamSize, isDoubleFailRound } from '../utils/missionRules.ts'
import { shuffle } from '../utils/shuffle.ts'

type PlayerNode = {
  name?: string
  ready?: boolean
  role?: string
  reconnectToken?: string
  uid?: string
  lastSeen?: number
  seatGeneration?: number
}

function findPlayerIdByUid(players: Record<string, PlayerNode>, uid: string): string | null {
  for (const [id, p] of Object.entries(players)) {
    if (p?.uid === uid) return id
  }
  return null
}

async function syncAvalonSeat(
  roomId: string,
  playerId: string,
  isHost: boolean,
  uid: string,
  existingUid?: string,
  roomState?: string
): Promise<void> {
  const patch: Record<string, string | number> = { lastSeen: Date.now() }
  if (!existingUid) patch.uid = uid
  await update(ref(db, `rooms/${roomId}/players/${playerId}`), patch)
  if (roomState === 'GAME_END') {
    await clearActiveGame('avalon', roomId, uid)
  } else {
    await setActiveGame('avalon', roomId, playerId, isHost, uid)
  }
}

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_ID_LENGTH = 6

function generateRoomId(): string {
  let id = ''
  const randomValues = new Uint8Array(ROOM_ID_LENGTH)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_CHARS[randomValues[i]! % ROOM_ID_CHARS.length]
  }
  return id
}

function generateHostId(): string {
  return crypto.randomUUID()
}

function generatePlayerId(): string {
  return crypto.randomUUID()
}

function generateReconnectToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const GOOD_ROLE_TEMPLATES: Record<number, string[]> = {
  5: ['MERLIN', 'PERCIVAL', 'SERVANT'],
  6: ['MERLIN', 'PERCIVAL', 'SERVANT', 'SERVANT'],
  7: ['MERLIN', 'PERCIVAL', 'SERVANT', 'SERVANT'],
  8: ['MERLIN', 'PERCIVAL', 'SERVANT', 'SERVANT', 'SERVANT'],
  9: ['MERLIN', 'PERCIVAL', 'SERVANT', 'SERVANT', 'SERVANT', 'SERVANT'],
  10: ['MERLIN', 'PERCIVAL', 'SERVANT', 'SERVANT', 'SERVANT', 'SERVANT'],
}

const EVIL_ROLE_TEMPLATES: Record<number, string[]> = {
  5: ['ASSASSIN', 'MORGANA'],
  6: ['ASSASSIN', 'MORGANA'],
  7: ['ASSASSIN', 'MORGANA', 'OBERON'],
  8: ['ASSASSIN', 'MORGANA', 'MINION'],
  9: ['ASSASSIN', 'MORGANA', 'MORDRED'],
  10: ['ASSASSIN', 'MORGANA', 'MORDRED', 'OBERON'],
}

/**
 * Good vs evil role lists for a player count (5–10). Matches Avalon_Roles.md.
 */
export function getRoleTemplates(playerCount: number): { good: string[]; evil: string[] } {
  if (playerCount < 5 || playerCount > 10) {
    throw new Error('Avalon supports 5 to 10 players')
  }
  const good = GOOD_ROLE_TEMPLATES[playerCount]
  const evil = EVIL_ROLE_TEMPLATES[playerCount]
  if (!good || !evil) throw new Error('Invalid player count')
  return { good: [...good], evil: [...evil] }
}

/**
 * Returns an array of role names for the given player count (5–10).
 */
export function generateRoles(playerCount: number): string[] {
  const { good, evil } = getRoleTemplates(playerCount)
  return [...good, ...evil]
}

/**
 * Creates a new room and writes initial state to Firebase.
 * Caller is the host and is added as the first player.
 */
export async function createRoom(
  hostName: string
): Promise<{ roomId: string; hostId: string; reconnectToken: string; seatGeneration: number }> {
  const user = await ensureAnonymousAuth()
  const roomId = generateRoomId()
  const hostId = generateHostId()
  const reconnectToken = generateReconnectToken()
  const now = Date.now()
  const seatGeneration = 0

  const roomRef = ref(db, `rooms/${roomId}`)
  await set(roomRef, {
    hostId,
    state: 'LOBBY',
    round: 0,
    leaderIndex: 0,
    players: {
      [hostId]: {
        name: hostName,
        ready: false,
        role: '',
        reconnectToken,
        uid: user.uid,
        lastSeen: now,
        seatGeneration,
      },
    },
    roles: {},
    team: {},
    votes: {},
    missionVotes: {},
    history: [],
    teamVoteHistory: [],
    score: { good: 0, evil: 0 },
    result: null,
    expectedPlayerCount: 5,
    consecutiveRejects: 0,
  })

  await setActiveGame('avalon', roomId, hostId, true, user.uid)
  return { roomId, hostId, reconnectToken, seatGeneration }
}

export type JoinRoomResult =
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

/**
 * Joins an existing room as a new player, or signals nickname reclaim when a same-name seat exists.
 */
export async function joinRoom(roomId: string, name: string): Promise<JoinRoomResult> {
  const user = await ensureAnonymousAuth()
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    throw new Error('Room not found')
  }
  const room = snapshot.val()
  const players = (room.players ?? {}) as Record<string, PlayerNode>

  const existingId = findPlayerIdByUid(players, user.uid)
  if (existingId) {
    const seat = players[existingId]!
    const isHost = room.hostId === existingId
    const state = (room.state as string) ?? 'LOBBY'
    await syncAvalonSeat(roomId, existingId, isHost, user.uid, seat.uid, state)
    return {
      playerId: existingId,
      reconnectToken: seat.reconnectToken ?? generateReconnectToken(),
      isHost,
      state,
      rejoined: true,
      seatGeneration: Number(seat.seatGeneration) || 0,
    }
  }

  const incoming = normalizePlayerName(name)
  if (incoming === '') {
    throw new Error('Enter your name')
  }

  const nameMatchId = findPlayerIdByName(players, name)
  if (nameMatchId) {
    const seat = players[nameMatchId]!
    return {
      needsReclaim: true,
      candidatePlayerId: nameMatchId,
      candidateName: seat.name?.trim() || name.trim(),
      offline: isPlayerOffline(seat.lastSeen),
      state: room.state ?? 'LOBBY',
      isHost: room.hostId === nameMatchId,
    }
  }

  if (room.state !== 'LOBBY') {
    throw new Error('Game has already started')
  }

  const playerId = generatePlayerId()
  const reconnectToken = generateReconnectToken()
  const now = Date.now()
  const seatGeneration = 0
  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`)
  await set(playerRef, {
    name: name.trim(),
    ready: false,
    role: '',
    reconnectToken,
    uid: user.uid,
    lastSeen: now,
    seatGeneration,
  })
  await setActiveGame('avalon', roomId, playerId, false, user.uid)
  return {
    playerId,
    reconnectToken,
    isHost: false,
    state: 'LOBBY',
    seatGeneration,
  }
}

/**
 * Claim an existing seat by matching display name (WeChat re-scan path).
 * When force is false and the seat still looks online, returns needsConfirm via throw message.
 */
export async function reclaimSeatByName(
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
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  const players = (room.players ?? {}) as Record<string, PlayerNode>
  const playerId = findPlayerIdByName(players, name)
  if (!playerId) throw new Error('未找到同名座位')
  const seat = players[playerId]!
  const offline = isPlayerOffline(seat.lastSeen)
  if (!force && !offline) {
    throw new Error('SEAT_ONLINE_CONFIRM')
  }
  const newToken = generateReconnectToken()
  const nextGen = (Number(seat.seatGeneration) || 0) + 1
  const now = Date.now()
  const isHost = room.hostId === playerId
  await update(ref(db, `rooms/${roomId}/players/${playerId}`), {
    uid: user.uid,
    reconnectToken: newToken,
    seatGeneration: nextGen,
    lastSeen: now,
  })
  const state = room.state ?? 'LOBBY'
  if (state === 'GAME_END') {
    await clearActiveGame('avalon', roomId, user.uid)
  } else {
    await setActiveGame('avalon', roomId, playerId, isHost, user.uid)
  }
  return {
    playerId,
    reconnectToken: newToken,
    isHost,
    state,
    seatGeneration: nextGen,
  }
}

/**
 * Remove self from lobby (e.g. user tapped Back). Prevents ghost players when re-joining with a new id.
 * If last player, deletes the room. If leaving player was host, assigns hostId to another player.
 */
export async function leaveLobby(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    await clearActiveGameIfOwned('avalon', roomId, playerId)
    return
  }
  const room = snapshot.val()
  if (room.state !== 'LOBBY') return
  const players = (room.players ?? {}) as Record<string, PlayerNode>
  if (!players[playerId]) {
    await clearActiveGameIfOwned('avalon', roomId, playerId)
    return
  }
  const leaverUid = players[playerId]?.uid
  const playerIds = Object.keys(players).sort()
  if (playerIds.length === 1) {
    await remove(roomRef)
    await clearActiveGame('avalon', roomId, leaverUid)
    return
  }
  const playerNodeRef = ref(db, `rooms/${roomId}/players/${playerId}`)
  await remove(playerNodeRef)
  if (room.hostId === playerId) {
    const remaining = playerIds.filter((id) => id !== playerId).sort()
    const newHostId = remaining[0]
    if (newHostId) {
      await update(roomRef, { hostId: newHostId })
    }
  }
  await clearActiveGame('avalon', roomId, leaverUid)
}

/**
 * Host removes another player from the lobby (e.g. ghost or AFK). LOBBY only.
 */
export async function kickPlayerFromLobby(
  roomId: string,
  hostPlayerId: string,
  targetPlayerId: string
): Promise<void> {
  if (hostPlayerId === targetPlayerId) {
    throw new Error('不能踢出自己')
  }
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  if (room.state !== 'LOBBY') throw new Error('只能在等待大厅踢人')
  if (room.hostId !== hostPlayerId) throw new Error('只有房主可以踢人')
  const players = (room.players ?? {}) as Record<string, PlayerNode>
  if (!players[targetPlayerId]) throw new Error('该玩家不在房间中')
  const targetUid = players[targetPlayerId]?.uid
  const playerRef = ref(db, `rooms/${roomId}/players/${targetPlayerId}`)
  await remove(playerRef)
  if (targetUid) {
    await clearActiveGame('avalon', roomId, targetUid)
  }
}

/**
 * Reconnect to a room as an existing player (e.g. after refresh). Room may be in any state.
 * @returns roomId, playerId, isHost, and current room state for restoring the correct view.
 */
export async function reconnectRoom(roomId: string, playerId: string): Promise<{
  roomId: string
  playerId: string
  isHost: boolean
  state: string
  reconnectToken?: string
  seatGeneration: number
}> {
  const user = await ensureAnonymousAuth()
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    throw new Error('Room not found')
  }
  const room = snapshot.val()
  const players = (room.players ?? {}) as Record<string, PlayerNode>
  if (!players[playerId]) {
    throw new Error('You are not in this room')
  }
  const isHost = room.hostId === playerId
  const state = room.state ?? 'LOBBY'
  const seatGeneration = Number(players[playerId]?.seatGeneration) || 0
  if (state === 'GAME_END') {
    await clearActiveGame('avalon', roomId, user.uid)
  } else {
    await syncAvalonSeat(roomId, playerId, isHost, user.uid, players[playerId]?.uid)
  }
  return {
    roomId,
    playerId,
    isHost,
    state,
    reconnectToken: players[playerId]?.reconnectToken,
    seatGeneration,
  }
}

/**
 * Reconnect by matching the current Auth uid to a player seat.
 */
export async function reconnectByUid(roomId: string): Promise<{
  roomId: string
  playerId: string
  isHost: boolean
  state: string
  reconnectToken?: string
  seatGeneration: number
}> {
  const user = await ensureAnonymousAuth()
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    throw new Error('Room not found')
  }
  const room = snapshot.val()
  const players = (room.players ?? {}) as Record<string, PlayerNode>
  const playerId = findPlayerIdByUid(players, user.uid)
  if (!playerId) {
    throw new Error('You are not in this room')
  }
  return reconnectRoom(roomId, playerId)
}

/**
 * Reconnect using a one-time token (works even without local playerId, e.g. after clearing cache or on another device).
 * Scans all players in the room for a matching reconnectToken.
 */
export async function reconnectByToken(roomId: string, token: string): Promise<{
  roomId: string
  playerId: string
  isHost: boolean
  state: string
  reconnectToken: string
  seatGeneration: number
}> {
  const user = await ensureAnonymousAuth()
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    throw new Error('Room not found')
  }
  const room = snapshot.val()
  const players = (room.players ?? {}) as Record<string, PlayerNode>
  let matchedId: string | null = null
  for (const [id, p] of Object.entries(players)) {
    if (p.reconnectToken === token) {
      matchedId = id
      break
    }
  }
  if (!matchedId) {
    throw new Error('Invalid or expired reconnect token')
  }
  const newToken = generateReconnectToken()
  const isHost = room.hostId === matchedId
  const state = room.state ?? 'LOBBY'
  const nextGen = (Number(players[matchedId]?.seatGeneration) || 0) + 1
  await update(ref(db, `rooms/${roomId}/players/${matchedId}`), {
    reconnectToken: newToken,
    uid: user.uid,
    lastSeen: Date.now(),
    seatGeneration: nextGen,
  })
  if (state === 'GAME_END') {
    await clearActiveGame('avalon', roomId, user.uid)
  } else {
    await setActiveGame('avalon', roomId, matchedId, isHost, user.uid)
  }
  return {
    roomId,
    playerId: matchedId,
    isHost,
    state,
    reconnectToken: newToken,
    seatGeneration: nextGen,
  }
}

/**
 * Toggles or sets a player's ready state in the lobby.
 * Verifies the player node exists with a name so RTDB cannot create a ghost `{ ready: true }` after a kick.
 */
export async function setPlayerReady(
  roomId: string,
  playerId: string,
  ready: boolean
): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('房间不存在')
  const room = snapshot.val()
  if (room.state !== 'LOBBY') throw new Error('游戏已开始')
  const player = room.players?.[playerId]
  if (!player || typeof player.name !== 'string' || !player.name.trim()) {
    throw new Error('你不在房间中或已被房主移出，请返回首页重新加入')
  }
  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`)
  await update(playerRef, { ready })
}

/**
 * Host sets how many players this game is for (5–10). Shown in lobby for role list.
 */
export async function setExpectedPlayerCount(
  roomId: string,
  hostPlayerId: string,
  count: number
): Promise<void> {
  if (count < 5 || count > 10) {
    throw new Error('人数需在 5～10 人')
  }
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  if (room.state !== 'LOBBY') throw new Error('只能在等待大厅修改人数')
  if (room.hostId !== hostPlayerId) throw new Error('只有房主可设置人数')
  await update(roomRef, { expectedPlayerCount: count })
}

/**
 * Assigns shuffled roles to all players and sets state to ROLE_REVEAL.
 * Player count must match room.expectedPlayerCount (or legacy: any 5–10 if unset).
 */
export async function startGame(roomId: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    throw new Error('Room not found')
  }
  const room = snapshot.val()
  if (room.state !== 'LOBBY') {
    throw new Error('Game already started')
  }
  const players = room.players ?? {}
  const playerIds = Object.keys(players).sort()
  for (const id of playerIds) {
    const n = players[id]?.name
    if (typeof n !== 'string' || !n.trim()) {
      throw new Error('玩家列表存在无效条目（如被踢后残留），请房主踢除该条目或让其重新加入')
    }
  }
  const count = playerIds.length
  const expectedRaw: unknown = room.expectedPlayerCount
  const expected =
    expectedRaw != null && String(expectedRaw).trim() !== '' ? Number(expectedRaw) : count
  if (expected < 5 || expected > 10) {
    throw new Error('本局人数设定无效，请房主重新选择 5～10 人')
  }
  if (count !== expected) {
    throw new Error(`本局需要 ${expected} 人，当前 ${count} 人，请补齐玩家或让房主调整人数`)
  }
  const notReady = playerIds.filter((id) => !players[id]?.ready)
  if (notReady.length > 0) {
    const names = notReady.map((id) => players[id]?.name ?? id).join('、')
    throw new Error(`请等待所有人准备。未准备：${names}`)
  }
  const shuffledRoles = shuffle(generateRoles(expected))
  const rolesObj: Record<string, string> = {}
  const updates: Record<string, unknown> = {
    state: 'ROLE_REVEAL',
    roles: rolesObj,
  }
  for (let i = 0; i < playerIds.length; i++) {
    const pid = playerIds[i]!
    const role = shuffledRoles[i]!
    rolesObj[pid] = role
    updates[`players/${pid}/role`] = role
  }
  await update(roomRef, updates)
}

const EVIL_EXCEPT_OBERON = ['ASSASSIN', 'MORGANA', 'MORDRED', 'MINION']
const EVIL_EXCEPT_MORDRED = ['ASSASSIN', 'MORGANA', 'OBERON', 'MINION']

const EVIL_ROLES = ['ASSASSIN', 'MORGANA', 'MORDRED', 'OBERON', 'MINION']

/** Good can only vote Success; only evil can vote Fail. */
export function isEvilRole(role: string): boolean {
  return EVIL_ROLES.includes(role)
}

/**
 * Returns player ids that this role can see (by Avalon visibility rules).
 * Excludes excludePlayerId (the current player). Merlin: all evil except Mordred. Percival: Merlin and Morgana. Evil: each other except Oberon. Oberon/Servant: none.
 */
export function getVisiblePlayerIds(
  myRole: string,
  roles: Record<string, string>,
  excludePlayerId?: string
): string[] {
  const entries = Object.entries(roles).filter(([id]) => id !== excludePlayerId)
  let ids: string[]
  switch (myRole) {
    case 'MERLIN':
      ids = entries.filter(([, r]) => EVIL_EXCEPT_MORDRED.includes(r)).map(([id]) => id)
      break
    case 'PERCIVAL':
      ids = entries.filter(([, r]) => r === 'MERLIN' || r === 'MORGANA').map(([id]) => id)
      break
    case 'SERVANT':
    case 'OBERON':
      ids = []
      break
    case 'ASSASSIN':
    case 'MORGANA':
    case 'MORDRED':
    case 'MINION':
      ids = entries.filter(([, r]) => EVIL_EXCEPT_OBERON.includes(r)).map(([id]) => id)
      break
    default:
      ids = []
  }
  return ids
}

/**
 * Advances room from ROLE_REVEAL to TEAM_SELECTION.
 * Idempotent: if already in TEAM_SELECTION or later, no-op so other players can still "Continue" into the game view.
 */
export async function advanceToTeamSelection(roomId: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  if (room.state !== 'ROLE_REVEAL') return
  await update(roomRef, { state: 'TEAM_SELECTION', round: 1, consecutiveRejects: 0 })
}

/**
 * Rotates the leader to the next player (by sorted player id order).
 * leaderIndex = (leaderIndex + 1) % players.length
 * Call after a rejected team vote (Task 20).
 */
export async function rotateLeader(roomId: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  const players = room.players ?? {}
  const playerIds = Object.keys(players).sort()
  if (playerIds.length === 0) throw new Error('No players')
  const currentIndex = Number(room.leaderIndex) || 0
  const nextIndex = (currentIndex + 1) % playerIds.length
  await update(roomRef, { leaderIndex: nextIndex })
}

/**
 * Saves the leader's selected team and advances to TEAM_VOTING.
 * Room must be in TEAM_SELECTION. Only the current leader may call this (verified server-side).
 */
export async function saveTeam(
  roomId: string,
  callerPlayerId: string,
  selectedPlayerIds: string[]
): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  if (room.state !== 'TEAM_SELECTION') {
    throw new Error('Not in team selection')
  }
  const players = room.players ?? {}
  const playerIds = Object.keys(players).sort()
  const leaderIndex = Number(room.leaderIndex) ?? 0
  const leaderId = playerIds[leaderIndex]
  if (leaderId !== callerPlayerId) {
    throw new Error('Only the leader can submit the team')
  }
  const playerCount = playerIds.length
  const round = Number(room.round) ?? 1
  const requiredSize = getMissionTeamSize(round, playerCount)
  if (selectedPlayerIds.length !== requiredSize) {
    throw new Error(`Team must have ${requiredSize} players`)
  }
  for (const id of selectedPlayerIds) {
    if (!players[id]) throw new Error(`Unknown player: ${id}`)
  }
  await update(roomRef, {
    team: selectedPlayerIds,
    state: 'TEAM_VOTING',
    votes: {},
    missionVotes: {},
  })
}

/**
 * Submits a player's vote (approve or reject) for the proposed team.
 * Room must be in TEAM_VOTING. Overwrites any previous vote from this player.
 */
export async function submitVote(
  roomId: string,
  playerId: string,
  vote: 'approve' | 'reject'
): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  if (room.state !== 'TEAM_VOTING') throw new Error('Not in team voting')
  const voteRef = ref(db, `rooms/${roomId}/votes/${playerId}`)
  await set(voteRef, vote)
}

/**
 * Counts votes and transitions: if approve > reject → MISSION_VOTING; else rotate leader and TEAM_SELECTION.
 * Idempotent: no-op if state is not TEAM_VOTING or not all players have voted.
 */
export async function resolveTeamVote(roomId: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) return
  const room = snapshot.val()
  if (room.state !== 'TEAM_VOTING') return
  const players = room.players ?? {}
  const playerIds = Object.keys(players).sort()
  const votes = room.votes ?? {}
  const voteCount = Object.keys(votes).length
  if (voteCount < playerIds.length) return

  let approve = 0
  let reject = 0
  for (const id of playerIds) {
    const v = votes[id]
    if (v === 'approve') approve++
    else if (v === 'reject') reject++
  }
  const round = Number(room.round) ?? 1
  const leaderIndex = Number(room.leaderIndex) ?? 0
  const team = room.team
  const teamIds: string[] = Array.isArray(team)
    ? team
    : team && typeof team === 'object'
      ? Object.keys(team)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => (team as Record<string, string>)[k])
          .filter(Boolean)
      : []
  const teamVoteHistory = [...(room.teamVoteHistory ?? [])]
  teamVoteHistory.push({
    round,
    leaderIndex,
    teamIds: [...teamIds],
    votes: { ...votes },
    result: approve > reject ? 'approved' : 'rejected',
  })
  if (approve > reject) {
    await update(roomRef, { state: 'MISSION_VOTING', teamVoteHistory, votes: {}, consecutiveRejects: 0 })
  } else {
    const prevRejects = Number(room.consecutiveRejects) || 0
    const newRejects = prevRejects + 1

    if (newRejects >= 5) {
      await update(roomRef, {
        state: 'GAME_END',
        result: 'evil',
        resultReason: 'five_rejects',
        teamVoteHistory,
        votes: {},
        consecutiveRejects: newRejects,
      })
    } else {
      const nextIndex = (leaderIndex + 1) % playerIds.length
      await update(roomRef, {
        state: 'TEAM_SELECTION',
        leaderIndex: nextIndex,
        team: {},
        votes: {},
        teamVoteHistory,
        consecutiveRejects: newRejects,
      })
    }
  }
}

/**
 * Submits a mission member's vote (success or fail). Room must be in MISSION_VOTING; player must be on the team.
 */
export async function submitMissionVote(
  roomId: string,
  playerId: string,
  vote: 'success' | 'fail'
): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  if (room.state !== 'MISSION_VOTING') throw new Error('Not in mission voting')
  const team = room.team
  const teamIds = Array.isArray(team) ? team : team && typeof team === 'object' ? Object.keys(team).sort((a, b) => Number(a) - Number(b)).map((k) => (team as Record<string, string>)[k]) : []
  if (!teamIds.includes(playerId)) throw new Error('You are not on this mission')
  const roles = room.roles ?? {}
  const myRole = roles[playerId] ?? ''
  if (vote === 'fail' && !isEvilRole(myRole)) throw new Error('Good players can only vote Success')
  const voteRef = ref(db, `rooms/${roomId}/missionVotes/${playerId}`)
  await set(voteRef, vote)
}

/**
 * Resolves mission: applies double-fail rule for round 4 with 7+ players, updates score, appends history.
 * If good wins 3 → ASSASSINATION. Else if round < 5 → ROUND_RESULT then next round TEAM_SELECTION; else game continues to round 5 or we need to handle 5 rounds.
 * Idempotent when not all mission members have voted.
 */
export async function resolveMissionResult(roomId: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) return
  const room = snapshot.val()
  if (room.state !== 'MISSION_VOTING') return
  const team = room.team
  const teamIds: string[] = Array.isArray(team) ? team : team && typeof team === 'object' ? Object.keys(team).sort((a, b) => Number(a) - Number(b)).map((k) => (team as Record<string, string>)[k]) : []
  const missionVotes = room.missionVotes ?? {}
  if (Object.keys(missionVotes).length < teamIds.length) return

  let failCount = 0
  for (const id of teamIds) {
    if (missionVotes[id] === 'fail') failCount++
  }
  const players = room.players ?? {}
  const playerCount = Object.keys(players).length
  const round = Number(room.round) ?? 1
  const missionFailed = isDoubleFailRound(round, playerCount) ? failCount >= 2 : failCount >= 1
  const score = { ...(room.score ?? { good: 0, evil: 0 }) }
  if (missionFailed) score.evil = (score.evil ?? 0) + 1
  else score.good = (score.good ?? 0) + 1

  const successCount = teamIds.length - failCount
  const history = [...(room.history ?? [])]
  history.push({
    round,
    success: !missionFailed,
    successCount,
    failCount,
  })

  const goodWins = score.good ?? 0
  const evilWins = score.evil ?? 0
  const updates: Record<string, unknown> = { score, history, missionVotes: {} }

  if (evilWins >= 3) {
    updates.state = 'GAME_END'
    updates.result = 'evil'
  } else if (goodWins >= 3) {
    updates.state = 'ASSASSINATION'
  } else {
    updates.state = 'ROUND_RESULT'
    updates.missionSuccess = !missionFailed
    updates.roundResultAck = {}
  }
  await update(roomRef, updates)
}

/**
 * Advances from ROUND_RESULT to next round (TEAM_SELECTION). Rotates leader.
 * Idempotent: no-op if state is not ROUND_RESULT (e.g. already advanced).
 */
export async function advanceFromRoundResult(roomId: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  if (room.state !== 'ROUND_RESULT') return
  const round = Number(room.round) ?? 1
  const nextRound = round + 1
  if (nextRound > 5) throw new Error('Game has no more rounds')
  const players = room.players ?? {}
  const playerIds = Object.keys(players).sort()
  const currentLeader = Number(room.leaderIndex) || 0
  const nextLeader = (currentLeader + 1) % playerIds.length
  await update(roomRef, {
    state: 'TEAM_SELECTION',
    round: nextRound,
    leaderIndex: nextLeader,
    team: {},
    votes: {},
    roundResultAck: {},
    consecutiveRejects: 0,
  })
}

/**
 * Records that this player has acknowledged the round result. When all players have acked, advances to next round.
 * Call this when the user taps "继续" on ROUND_RESULT screen.
 */
export async function ackRoundResult(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const ackRef = ref(db, `rooms/${roomId}/roundResultAck/${playerId}`)
  await set(ackRef, true)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) return
  const room = snapshot.val()
  if (room.state !== 'ROUND_RESULT') return
  const players = room.players ?? {}
  const playerIds = Object.keys(players).sort()
  const acks = room.roundResultAck ?? {}
  const ackCount = playerIds.filter((id) => acks[id] === true).length
  if (ackCount >= playerIds.length) {
    await advanceFromRoundResult(roomId)
  }
}

/**
 * Assassin chooses a target (guess Merlin). Only the player with role ASSASSIN can call.
 * If target is Merlin → evil wins (result: 'evil'), else good wins (result: 'good'). State → GAME_END.
 */
export async function submitAssassinChoice(
  roomId: string,
  assassinPlayerId: string,
  targetPlayerId: string
): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  if (room.state !== 'ASSASSINATION') throw new Error('Not in assassination phase')
  const roles = room.roles ?? {}
  if (roles[assassinPlayerId] !== 'ASSASSIN') throw new Error('Only the Assassin can choose')
  const targetRole = roles[targetPlayerId]
  const evilWins = targetRole === 'MERLIN'
  await update(roomRef, {
    state: 'GAME_END',
    result: evilWins ? 'evil' : 'good',
  })
}

/**
 * Host-only emergency action: end current game and return everyone to lobby.
 * Keeps current players but clears in-game progress so a new game can start.
 */
export async function abortToLobby(roomId: string, actorPlayerId: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val()
  if (room.hostId !== actorPlayerId) throw new Error('只有房主可以结束本局')
  const players = room.players ?? {}
  const playerIds = Object.keys(players).sort()
  const resetReady: Record<string, unknown> = {}
  for (const id of playerIds) {
    resetReady[`players/${id}/ready`] = false
    resetReady[`players/${id}/role`] = ''
  }
  await update(roomRef, {
    state: 'LOBBY',
    round: 0,
    leaderIndex: 0,
    roles: {},
    team: {},
    votes: {},
    missionVotes: {},
    missionSuccess: null,
    history: [],
    teamVoteHistory: [],
    roundResultAck: {},
    score: { good: 0, evil: 0 },
    result: null,
    resultReason: null,
    consecutiveRejects: 0,
    ...resetReady,
  })
}
