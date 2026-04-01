import { get, ref, remove, runTransaction, set, update } from 'firebase/database'
import { UNDERCOVER_WORD_PAIRS } from '../data/undercoverWords'
import { shuffle } from '../utils/shuffle'
import { db } from './firebase'
import type {
  UndercoverPlayer,
  UndercoverRole,
  UndercoverRoleSettings,
  UndercoverRoom,
  UndercoverRoundResolution,
  UndercoverWinner,
} from '../types/undercover'

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_ID_LENGTH = 6
const ROOM_ID_PREFIX = 'U'

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

export function getRecommendedRoleCounts(playerCount: number): {
  recommendedUndercoverCount: number
  recommendedBlankCount: number
} {
  return {
    recommendedUndercoverCount: playerCount >= 8 ? 2 : 1,
    recommendedBlankCount: playerCount >= 6 ? 1 : 0,
  }
}

function validateRoleSettings(playerCount: number, settings: UndercoverRoleSettings): string | null {
  if (playerCount < 4 || playerCount > 12) return '人数需在 4～12 人'
  if (settings.undercoverCount < 1) return '至少需要 1 名卧底'
  if (settings.blankCount < 0) return '白板人数不能小于 0'
  if (settings.undercoverCount + settings.blankCount >= playerCount) return '卧底与白板总数必须小于总人数'
  const civilianCount = playerCount - settings.undercoverCount - settings.blankCount
  if (civilianCount < 1) return '至少需要 1 名平民'
  if (settings.undercoverCount >= civilianCount) return '卧底人数必须小于平民人数'
  return null
}

function checkGameEnd(players: Record<string, UndercoverPlayer>): UndercoverWinner | null {
  const alive = Object.values(players).filter((p) => p.isAlive)
  const civilians = alive.filter((p) => p.role === 'civilian')
  const undercovers = alive.filter((p) => p.role === 'undercover')
  const blanks = alive.filter((p) => p.role === 'blank')

  if (undercovers.length === 0) return 'CIVILIAN_WIN'
  if (undercovers.length >= civilians.length) return 'UNDERCOVER_WIN'
  if (alive.length === 1 && blanks.length === 1) return 'BLANK_WIN'
  return null
}

function tallyVotes(votes: Record<string, string>): Record<string, number> {
  const countMap: Record<string, number> = {}
  for (const targetId of Object.values(votes)) {
    countMap[targetId] = (countMap[targetId] ?? 0) + 1
  }
  return countMap
}

function getTopCandidates(votes: Record<string, string>): string[] {
  const counts = tallyVotes(votes)
  let max = 0
  let candidates: string[] = []
  for (const [targetId, count] of Object.entries(counts)) {
    if (count > max) {
      max = count
      candidates = [targetId]
    } else if (count === max) {
      candidates.push(targetId)
    }
  }
  return candidates
}

function assignRolesAndWords(players: Record<string, UndercoverPlayer>, settings: UndercoverRoleSettings) {
  const pair = UNDERCOVER_WORD_PAIRS[randomInt(UNDERCOVER_WORD_PAIRS.length)]
  if (!pair) throw new Error('词库为空，请先配置词条')
  const playerIds = Object.keys(players).sort()
  const shuffled = shuffle(playerIds)

  const roleMap: Record<string, UndercoverRole> = {}
  for (let i = 0; i < shuffled.length; i++) {
    const id = shuffled[i]!
    if (i < settings.undercoverCount) roleMap[id] = 'undercover'
    else if (i < settings.undercoverCount + settings.blankCount) roleMap[id] = 'blank'
    else roleMap[id] = 'civilian'
  }

  const updates: Record<string, unknown> = {
    state: 'WORD_REVEAL',
    round: 1,
    votes: {},
    tieCandidates: [],
    tieRevoteCount: 0,
    wordPair: pair,
    lastEliminatedId: null,
    lastEliminatedRole: null,
    resultWinner: null,
    resultReason: null,
  }

  for (const id of playerIds) {
    const role = roleMap[id]!
    updates[`players/${id}/role`] = role
    updates[`players/${id}/isAlive`] = true
    updates[`players/${id}/ready`] = false
    updates[`players/${id}/word`] =
      role === 'civilian' ? pair.civilianWord : role === 'undercover' ? pair.undercoverWord : null
  }

  return updates
}

export async function createUndercoverRoom(
  hostName: string
): Promise<{ roomId: string; playerId: string; reconnectToken: string }> {
  const trimmed = hostName.trim()
  if (!trimmed) throw new Error('请输入你的名字')
  const roomId = generateRoomId()
  const playerId = generatePlayerId()
  const reconnectToken = generateReconnectToken()
  const { recommendedUndercoverCount, recommendedBlankCount } = getRecommendedRoleCounts(4)

  const room: UndercoverRoom = {
    hostId: playerId,
    state: 'LOBBY',
    round: 1,
    tieRevoteCount: 0,
    maxTieRevotes: 3,
    players: {
      [playerId]: {
        name: trimmed,
        ready: false,
        isAlive: true,
        role: '',
        word: null,
        reconnectToken,
      },
    },
    votes: {},
    tieCandidates: [],
    wordPair: null,
    lastEliminatedId: null,
    lastEliminatedRole: null,
    resultWinner: null,
    resultReason: null,
    roleSettings: {
      undercoverCount: recommendedUndercoverCount,
      blankCount: recommendedBlankCount,
      recommendedUndercoverCount,
      recommendedBlankCount,
    },
  }

  await set(ref(db, `undercoverRooms/${roomId}`), room)
  return { roomId, playerId, reconnectToken }
}

export async function joinUndercoverRoom(
  roomId: string,
  name: string
): Promise<{ playerId: string; reconnectToken: string }> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('请输入你的名字')

  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as UndercoverRoom
  if (room.state !== 'LOBBY') throw new Error('Game has already started')

  const incoming = normalizeNameForDuplicateCheck(trimmed)
  const players = room.players ?? {}
  for (const p of Object.values(players)) {
    if (normalizeNameForDuplicateCheck(p.name) === incoming) {
      throw new Error('该昵称已被使用，请换一个名字')
    }
  }

  const currentCount = Object.keys(players).length
  if (currentCount >= 12) throw new Error('房间已满（最多 12 人）')

  const playerId = generatePlayerId()
  const reconnectToken = generateReconnectToken()
  await set(ref(db, `undercoverRooms/${roomId}/players/${playerId}`), {
    name: trimmed,
    ready: false,
    isAlive: true,
    role: '',
    word: null,
    reconnectToken,
  } as UndercoverPlayer)

  const nextCount = currentCount + 1
  const recommendations = getRecommendedRoleCounts(nextCount)
  await update(roomRef, {
    'roleSettings/recommendedUndercoverCount': recommendations.recommendedUndercoverCount,
    'roleSettings/recommendedBlankCount': recommendations.recommendedBlankCount,
  })

  return { playerId, reconnectToken }
}

export async function reconnectUndercoverRoom(roomId: string, playerId: string): Promise<{
  roomId: string
  playerId: string
  isHost: boolean
  state: string
}> {
  const snapshot = await get(ref(db, `undercoverRooms/${roomId}`))
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as UndercoverRoom
  if (!room.players?.[playerId]) throw new Error('You are not in this room')
  return {
    roomId,
    playerId,
    isHost: room.hostId === playerId,
    state: room.state,
  }
}

export async function reconnectUndercoverByToken(roomId: string, token: string): Promise<{
  roomId: string
  playerId: string
  isHost: boolean
  state: string
  reconnectToken: string
}> {
  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as UndercoverRoom
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
  await set(ref(db, `undercoverRooms/${roomId}/players/${matchedId}/reconnectToken`), newToken)
  return {
    roomId,
    playerId: matchedId,
    isHost: room.hostId === matchedId,
    state: room.state,
    reconnectToken: newToken,
  }
}

export async function leaveUndercoverLobby(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) return
  const room = snapshot.val() as UndercoverRoom
  if (room.state !== 'LOBBY') return
  const players = room.players ?? {}
  if (!players[playerId]) return
  const ids = Object.keys(players).sort()
  if (ids.length === 1) {
    await remove(roomRef)
    return
  }
  await remove(ref(db, `undercoverRooms/${roomId}/players/${playerId}`))
  if (room.hostId === playerId) {
    const nextHost = ids.find((id) => id !== playerId)
    if (nextHost) {
      await update(roomRef, { hostId: nextHost })
    }
  }
}

export async function setUndercoverPlayerReady(roomId: string, playerId: string, ready: boolean): Promise<void> {
  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('房间不存在')
  const room = snapshot.val() as UndercoverRoom
  if (room.state !== 'LOBBY') throw new Error('游戏已开始')
  const me = room.players?.[playerId]
  if (!me) throw new Error('你不在房间中')
  await update(ref(db, `undercoverRooms/${roomId}/players/${playerId}`), { ready })
}

export async function setUndercoverRoleSettings(
  roomId: string,
  hostPlayerId: string,
  undercoverCount: number,
  blankCount: number
): Promise<void> {
  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as UndercoverRoom
  if (room.state !== 'LOBBY') throw new Error('只能在等待大厅设置角色人数')
  if (room.hostId !== hostPlayerId) throw new Error('只有房主可以设置')
  const playerCount = Object.keys(room.players ?? {}).length
  const recommendations = getRecommendedRoleCounts(playerCount)
  const settings: UndercoverRoleSettings = {
    undercoverCount,
    blankCount,
    recommendedUndercoverCount: recommendations.recommendedUndercoverCount,
    recommendedBlankCount: recommendations.recommendedBlankCount,
  }
  const error = validateRoleSettings(playerCount, settings)
  if (error) throw new Error(error)
  await update(roomRef, { roleSettings: settings })
}

export async function startUndercoverGame(roomId: string, hostPlayerId: string): Promise<void> {
  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as UndercoverRoom
  if (room.state !== 'LOBBY') throw new Error('Game already started')
  if (room.hostId !== hostPlayerId) throw new Error('只有房主可以开始')
  const players = room.players ?? {}
  const playerIds = Object.keys(players)
  const playerCount = playerIds.length
  if (playerCount < 4 || playerCount > 12) throw new Error('人数需在 4～12 人')

  const allReady = playerIds.every((id) => players[id]?.ready === true)
  if (!allReady) throw new Error('请等待所有玩家准备')

  const recommendations = getRecommendedRoleCounts(playerCount)
  const settings: UndercoverRoleSettings = {
    undercoverCount: room.roleSettings?.undercoverCount ?? recommendations.recommendedUndercoverCount,
    blankCount: room.roleSettings?.blankCount ?? recommendations.recommendedBlankCount,
    recommendedUndercoverCount: recommendations.recommendedUndercoverCount,
    recommendedBlankCount: recommendations.recommendedBlankCount,
  }
  const validationError = validateRoleSettings(playerCount, settings)
  if (validationError) throw new Error(validationError)

  const updates = assignRolesAndWords(players, settings)
  await update(roomRef, { ...updates, roleSettings: settings })
}

export async function advanceToUndercoverVoting(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as UndercoverRoom
  if (room.hostId !== playerId) throw new Error('只有房主可以推进流程')
  if (room.state !== 'WORD_REVEAL') return
  await update(roomRef, { state: 'VOTING', votes: {}, tieCandidates: [], tieRevoteCount: 0 })
}

export async function advanceTieSpeakToVoting(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as UndercoverRoom
  if (room.hostId !== playerId) throw new Error('只有房主可以推进流程')
  if (room.state !== 'TIE_SPEAK') return
  await update(roomRef, { state: 'VOTING', votes: {} })
}

export async function submitUndercoverVote(
  roomId: string,
  voterId: string,
  targetId: string
): Promise<void> {
  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as UndercoverRoom
  if (room.state !== 'VOTING') throw new Error('当前不是投票阶段')
  const players = room.players ?? {}
  const voter = players[voterId]
  const target = players[targetId]
  if (!voter || !target) throw new Error('无效玩家')
  if (!voter.isAlive) throw new Error('已淘汰玩家不能投票')
  if (!target.isAlive) throw new Error('不能投给已淘汰玩家')
  if (voterId === targetId) throw new Error('不能投给自己')

  const tieCandidates = room.tieCandidates ?? []
  if (tieCandidates.length > 0 && !tieCandidates.includes(targetId)) {
    throw new Error('复投阶段只能投给平票候选人')
  }

  await set(ref(db, `undercoverRooms/${roomId}/votes/${voterId}`), targetId)
}

export async function resolveUndercoverVoteRound(roomId: string): Promise<UndercoverRoundResolution> {
  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const tx = await runTransaction(
    roomRef,
    (raw) => {
      if (!raw) return raw
      const room = raw as UndercoverRoom
      if (room.state !== 'VOTING') return raw
      const players = room.players ?? {}
      const aliveIds = Object.keys(players).filter((id) => players[id]?.isAlive)
      const votes = room.votes ?? {}
      if (Object.keys(votes).length < aliveIds.length) return raw

      const candidates = getTopCandidates(votes)
      if (candidates.length === 0) return raw
      if (candidates.length > 1) {
        const nextTieRevote = (room.tieRevoteCount ?? 0) + 1
        const maxTieRevotes = room.maxTieRevotes ?? 3
        if (nextTieRevote > maxTieRevotes) {
          const randomEliminated = candidates[randomInt(candidates.length)]
          if (!randomEliminated) return raw
          const eliminatedRole = players[randomEliminated]?.role
          if (!eliminatedRole) return raw
          const nextPlayers: Record<string, UndercoverPlayer> = { ...players }
          nextPlayers[randomEliminated] = { ...nextPlayers[randomEliminated]!, isAlive: false }
          const winner = checkGameEnd(nextPlayers)
          return {
            ...room,
            players: nextPlayers,
            votes: {},
            tieCandidates: [],
            tieRevoteCount: 0,
            lastEliminatedId: randomEliminated,
            lastEliminatedRole: eliminatedRole,
            resultReason: 'RANDOM_TIE_BREAK',
            resultWinner: winner ?? null,
            state: winner ? 'END' : 'VOTING',
            round: winner ? room.round : (room.round ?? 1) + 1,
          } as UndercoverRoom
        }
        return {
          ...room,
          state: 'TIE_SPEAK',
          tieCandidates: candidates,
          votes: {},
          tieRevoteCount: nextTieRevote,
        } as UndercoverRoom
      }

      const eliminatedId = candidates[0]
      if (!eliminatedId) return raw
      const eliminatedRole = players[eliminatedId]?.role
      if (!eliminatedRole) return raw
      const nextPlayers: Record<string, UndercoverPlayer> = { ...players }
      nextPlayers[eliminatedId] = { ...nextPlayers[eliminatedId]!, isAlive: false }
      const winner = checkGameEnd(nextPlayers)
      return {
        ...room,
        players: nextPlayers,
        votes: {},
        tieCandidates: [],
        tieRevoteCount: 0,
        lastEliminatedId: eliminatedId,
        lastEliminatedRole: eliminatedRole,
        resultReason: 'NORMAL',
        resultWinner: winner ?? null,
        state: winner ? 'END' : 'VOTING',
        round: winner ? room.round : (room.round ?? 1) + 1,
      } as UndercoverRoom
    },
    { applyLocally: false }
  )

  const after = tx.snapshot.val() as UndercoverRoom | null
  if (!tx.committed || !after) return { status: 'WAITING' }
  if (after.state === 'TIE_SPEAK') {
    return {
      status: 'TIE_SPEAK',
      tieCandidates: after.tieCandidates,
    }
  }
  if (after.state === 'END') {
    return {
      status: 'END',
      eliminatedId: after.lastEliminatedId ?? undefined,
      eliminatedRole: after.lastEliminatedRole ?? undefined,
      winner: after.resultWinner ?? undefined,
      reason: after.resultReason ?? undefined,
    }
  }
  if (after.lastEliminatedId) {
    return {
      status: 'ELIMINATED',
      eliminatedId: after.lastEliminatedId,
      eliminatedRole: after.lastEliminatedRole ?? undefined,
      reason: after.resultReason ?? undefined,
    }
  }
  return { status: 'WAITING' }
}

export async function restartUndercoverToLobby(roomId: string, hostPlayerId: string): Promise<void> {
  const roomRef = ref(db, `undercoverRooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) throw new Error('Room not found')
  const room = snapshot.val() as UndercoverRoom
  if (room.hostId !== hostPlayerId) throw new Error('只有房主可以再来一局')

  const players = room.players ?? {}
  const playerIds = Object.keys(players).sort()
  const updates: Record<string, unknown> = {
    state: 'LOBBY',
    round: 1,
    tieRevoteCount: 0,
    votes: {},
    tieCandidates: [],
    wordPair: null,
    lastEliminatedId: null,
    lastEliminatedRole: null,
    resultWinner: null,
    resultReason: null,
  }

  for (const id of playerIds) {
    updates[`players/${id}/ready`] = false
    updates[`players/${id}/isAlive`] = true
    updates[`players/${id}/role`] = ''
    updates[`players/${id}/word`] = null
  }

  await update(roomRef, updates)
}
