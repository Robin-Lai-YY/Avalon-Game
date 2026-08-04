const KEY_ROOM = 'ninja_roomId'
const KEY_PLAYER = 'ninja_playerId'
const KEY_HOST = 'ninja_isHost'
const KEY_TOKEN = 'ninja_reconnectToken'
const KEY_GEN = 'ninja_seatGeneration'
const KEY_SAVED_AT = 'ninja_savedAt'
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

export type NinjaSession = {
  roomId: string
  playerId: string
  isHost: boolean
  reconnectToken?: string
  seatGeneration?: number
  savedAt?: number
}

function write(
  storage: Storage | null,
  roomId: string,
  playerId: string,
  isHost: boolean,
  reconnectToken?: string,
  seatGeneration?: number
) {
  if (!storage) return
  storage.setItem(KEY_ROOM, roomId)
  storage.setItem(KEY_PLAYER, playerId)
  storage.setItem(KEY_HOST, isHost ? '1' : '0')
  storage.setItem(KEY_SAVED_AT, String(Date.now()))
  if (reconnectToken) storage.setItem(KEY_TOKEN, reconnectToken)
  if (seatGeneration != null && Number.isFinite(seatGeneration)) {
    storage.setItem(KEY_GEN, String(seatGeneration))
  }
}

function read(storage: Storage | null): NinjaSession | null {
  if (!storage) return null
  const roomId = storage.getItem(KEY_ROOM)
  const playerId = storage.getItem(KEY_PLAYER)
  if (!roomId || !playerId) return null
  const savedAt = Number(storage.getItem(KEY_SAVED_AT) ?? 0)
  if (!savedAt || Date.now() - savedAt > SESSION_TTL_MS) {
    clear(storage)
    return null
  }
  const genRaw = storage.getItem(KEY_GEN)
  const seatGeneration = genRaw != null ? Number(genRaw) : undefined
  return {
    roomId,
    playerId,
    isHost: storage.getItem(KEY_HOST) === '1',
    reconnectToken: storage.getItem(KEY_TOKEN) ?? undefined,
    seatGeneration: seatGeneration != null && Number.isFinite(seatGeneration) ? seatGeneration : undefined,
    savedAt: savedAt || undefined,
  }
}

function clear(storage: Storage | null) {
  if (!storage) return
  storage.removeItem(KEY_ROOM)
  storage.removeItem(KEY_PLAYER)
  storage.removeItem(KEY_HOST)
  storage.removeItem(KEY_TOKEN)
  storage.removeItem(KEY_GEN)
  storage.removeItem(KEY_SAVED_AT)
}

const session = typeof sessionStorage !== 'undefined' ? sessionStorage : null
const local = typeof localStorage !== 'undefined' ? localStorage : null

export function saveNinjaSession(
  roomId: string,
  playerId: string,
  isHost: boolean,
  reconnectToken?: string,
  seatGeneration?: number
) {
  try {
    write(session, roomId, playerId, isHost, reconnectToken, seatGeneration)
    write(local, roomId, playerId, isHost, reconnectToken, seatGeneration)
  } catch {
    // ignore
  }
}

export function loadNinjaSession(): NinjaSession | null {
  try {
    return read(session) ?? read(local)
  } catch {
    return null
  }
}

export function clearNinjaSession() {
  try {
    clear(session)
    clear(local)
  } catch {
    // ignore
  }
}

export function isNinjaReconnectPermanentFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /Room not found/i.test(msg) || /not in this room/i.test(msg)
}

export function buildNinjaReconnectUrl(roomId: string, token: string): string {
  const base = window.location.origin + window.location.pathname
  return `${base}?game=ninja&room=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`
}
