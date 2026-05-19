const KEY_ROOM = 'ninja_roomId'
const KEY_PLAYER = 'ninja_playerId'
const KEY_HOST = 'ninja_isHost'
const KEY_TOKEN = 'ninja_reconnectToken'

export type NinjaSession = {
  roomId: string
  playerId: string
  isHost: boolean
  reconnectToken?: string
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
  if (reconnectToken) storage.setItem(KEY_TOKEN, reconnectToken)
}

function read(storage: Storage | null): NinjaSession | null {
  if (!storage) return null
  const roomId = storage.getItem(KEY_ROOM)
  const playerId = storage.getItem(KEY_PLAYER)
  if (!roomId || !playerId) return null
  return {
    roomId,
    playerId,
    isHost: storage.getItem(KEY_HOST) === '1',
    reconnectToken: storage.getItem(KEY_TOKEN) ?? undefined,
  }
}

function clear(storage: Storage | null) {
  if (!storage) return
  storage.removeItem(KEY_ROOM)
  storage.removeItem(KEY_PLAYER)
  storage.removeItem(KEY_HOST)
  storage.removeItem(KEY_TOKEN)
}

const session = typeof sessionStorage !== 'undefined' ? sessionStorage : null
const local = typeof localStorage !== 'undefined' ? localStorage : null

export function saveNinjaSession(
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
