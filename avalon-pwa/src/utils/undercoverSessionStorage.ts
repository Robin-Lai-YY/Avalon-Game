const KEY_ROOM = 'undercover_roomId'
const KEY_PLAYER = 'undercover_playerId'
const KEY_HOST = 'undercover_isHost'
const KEY_TOKEN = 'undercover_reconnectToken'
const KEY_SAVED_AT = 'undercover_savedAt'
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

export type UndercoverSession = {
  roomId: string
  playerId: string
  isHost: boolean
  reconnectToken?: string
  savedAt?: number
}

function write(
  storage: Storage | null,
  roomId: string,
  playerId: string,
  isHost: boolean,
  reconnectToken?: string
) {
  if (!storage) return
  storage.setItem(KEY_ROOM, roomId)
  storage.setItem(KEY_PLAYER, playerId)
  storage.setItem(KEY_HOST, isHost ? '1' : '0')
  storage.setItem(KEY_SAVED_AT, String(Date.now()))
  if (reconnectToken) storage.setItem(KEY_TOKEN, reconnectToken)
}

function read(storage: Storage | null): UndercoverSession | null {
  if (!storage) return null
  const roomId = storage.getItem(KEY_ROOM)
  const playerId = storage.getItem(KEY_PLAYER)
  if (!roomId || !playerId) return null
  const savedAt = Number(storage.getItem(KEY_SAVED_AT) ?? 0)
  if (!savedAt || Date.now() - savedAt > SESSION_TTL_MS) {
    clear(storage)
    return null
  }
  return {
    roomId,
    playerId,
    isHost: storage.getItem(KEY_HOST) === '1',
    reconnectToken: storage.getItem(KEY_TOKEN) ?? undefined,
    savedAt: savedAt || undefined,
  }
}

function clear(storage: Storage | null) {
  if (!storage) return
  storage.removeItem(KEY_ROOM)
  storage.removeItem(KEY_PLAYER)
  storage.removeItem(KEY_HOST)
  storage.removeItem(KEY_TOKEN)
  storage.removeItem(KEY_SAVED_AT)
}

const session = typeof sessionStorage !== 'undefined' ? sessionStorage : null
const local = typeof localStorage !== 'undefined' ? localStorage : null

export function saveUndercoverSession(
  roomId: string,
  playerId: string,
  isHost: boolean,
  reconnectToken?: string
) {
  try {
    write(session, roomId, playerId, isHost, reconnectToken)
    write(local, roomId, playerId, isHost, reconnectToken)
  } catch {
    // ignore
  }
}

export function loadUndercoverSession(): UndercoverSession | null {
  try {
    return read(session) ?? read(local)
  } catch {
    return null
  }
}

export function clearUndercoverSession() {
  try {
    clear(session)
    clear(local)
  } catch {
    // ignore
  }
}

export function isUndercoverReconnectPermanentFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /Room not found/i.test(msg) || /not in this room/i.test(msg)
}

export function buildUndercoverReconnectUrl(roomId: string, token: string): string {
  const base = window.location.origin + window.location.pathname
  return `${base}?game=undercover&room=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`
}
