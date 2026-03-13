import { get, ref, set, update } from 'firebase/database'
import { db } from './firebase.ts'
import { getMissionTeamSize, isDoubleFailRound } from '../utils/missionRules.ts'
import { shuffle } from '../utils/shuffle.ts'

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

/**
 * Returns an array of role names for the given player count (5–10).
 * Matches Avalon_Roles.md: 5→Merlin,Percival,Servant + Assassin,Morgana; 6→+1 Servant; 7→+Oberon; 8→+2 Servant, Minion; 9→+2 Servant, Mordred; 10→+Mordred,Oberon.
 */
export function generateRoles(playerCount: number): string[] {
  if (playerCount < 5 || playerCount > 10) {
    throw new Error('Avalon supports 5 to 10 players')
  }
  const goodTemplates: Record<number, string[]> = {
    5: ['MERLIN', 'PERCIVAL', 'SERVANT'],
    6: ['MERLIN', 'PERCIVAL', 'SERVANT', 'SERVANT'],
    7: ['MERLIN', 'PERCIVAL', 'SERVANT', 'SERVANT'],
    8: ['MERLIN', 'PERCIVAL', 'SERVANT', 'SERVANT', 'SERVANT'],
    9: ['MERLIN', 'PERCIVAL', 'SERVANT', 'SERVANT', 'SERVANT', 'SERVANT'],
    10: ['MERLIN', 'PERCIVAL', 'SERVANT', 'SERVANT', 'SERVANT', 'SERVANT'],
  }
  const evilTemplates: Record<number, string[]> = {
    5: ['ASSASSIN', 'MORGANA'],
    6: ['ASSASSIN', 'MORGANA'],
    7: ['ASSASSIN', 'MORGANA', 'OBERON'],
    8: ['ASSASSIN', 'MORGANA', 'MINION'],
    9: ['ASSASSIN', 'MORGANA', 'MORDRED'],
    10: ['ASSASSIN', 'MORGANA', 'MORDRED', 'OBERON'],
  }
  const good = goodTemplates[playerCount]!
  const evil = evilTemplates[playerCount]!
  return [...good, ...evil]
}

/**
 * Creates a new room and writes initial state to Firebase.
 * Caller is the host and is added as the first player.
 * @returns { roomId, hostId }
 */
export async function createRoom(hostName: string): Promise<{ roomId: string; hostId: string }> {
  const roomId = generateRoomId()
  const hostId = generateHostId()

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
  })

  return { roomId, hostId }
}

/**
 * Joins an existing room as a new player. Room must exist and be in LOBBY.
 * @returns { playerId } so the client can identify themselves (e.g. for ready toggle).
 * @throws if room does not exist or state is not LOBBY.
 */
export async function joinRoom(
  roomId: string,
  name: string
): Promise<{ playerId: string }> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    throw new Error('Room not found')
  }
  const room = snapshot.val()
  if (room.state !== 'LOBBY') {
    throw new Error('Game has already started')
  }
  const playerId = generatePlayerId()
  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`)
  await set(playerRef, {
    name,
    ready: false,
    role: '',
  })
  return { playerId }
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
}> {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    throw new Error('Room not found')
  }
  const room = snapshot.val()
  const players = room.players ?? {}
  if (!players[playerId]) {
    throw new Error('You are not in this room')
  }
  return {
    roomId,
    playerId,
    isHost: room.hostId === playerId,
    state: room.state ?? 'LOBBY',
  }
}

/**
 * Toggles or sets a player's ready state in the lobby.
 * Only updates the `ready` field for that player.
 */
export async function setPlayerReady(
  roomId: string,
  playerId: string,
  ready: boolean
): Promise<void> {
  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`)
  await update(playerRef, { ready })
}

/**
 * Assigns shuffled roles to all players and sets state to ROLE_REVEAL.
 * Call when host starts the game from LOBBY. Room must have 5–10 players.
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
  const count = playerIds.length
  if (count < 5 || count > 10) {
    throw new Error('Need 5 to 10 players to start')
  }
  const notReady = playerIds.filter((id) => !players[id]?.ready)
  if (notReady.length > 0) {
    const names = notReady.map((id) => players[id]?.name ?? id).join('、')
    throw new Error(`请等待所有人准备。未准备：${names}`)
  }
  const shuffledRoles = shuffle(generateRoles(count))
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
  await update(roomRef, { state: 'TEAM_SELECTION', round: 1 })
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
    await update(roomRef, { state: 'MISSION_VOTING', teamVoteHistory, votes: {} })
  } else {
    const nextIndex = (leaderIndex + 1) % playerIds.length
    await update(roomRef, {
      state: 'TEAM_SELECTION',
      leaderIndex: nextIndex,
      team: {},
      votes: {},
      teamVoteHistory,
    })
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
