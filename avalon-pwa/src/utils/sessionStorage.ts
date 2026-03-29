const KEY_ROOM = 'avalon_roomId'
const KEY_PLAYER = 'avalon_playerId'
const KEY_HOST = 'avalon_isHost'
const KEY_TOKEN = 'avalon_reconnectToken'

export type Session = {
  roomId: string
  playerId: string
  isHost: boolean
  reconnectToken?: string
}

function write(storage: Storage | null, roomId: string, playerId: string, isHost: boolean, reconnectToken?: string) {
  if (!storage) return
  storage.setItem(KEY_ROOM, roomId)
  storage.setItem(KEY_PLAYER, playerId)
  storage.setItem(KEY_HOST, isHost ? '1' : '0')
  if (reconnectToken) {
    storage.setItem(KEY_TOKEN, reconnectToken)
  }
}

function read(storage: Storage | null): Session | null {
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

/**
 * Save to both storages:
 * - sessionStorage: this tab keeps its own copy (refresh / multi-tab).
 * - localStorage: survives closing the tab or browser so you can return to the same room later.
 */
export function saveSession(roomId: string, playerId: string, isHost: boolean, reconnectToken?: string): void {
  try {
    write(session, roomId, playerId, isHost, reconnectToken)
    write(local, roomId, playerId, isHost, reconnectToken)
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Prefer sessionStorage (correct per-tab identity), then localStorage (after full browser restart).
 */
export function loadSession(): Session | null {
  try {
    return read(session) ?? read(local)
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    clear(session)
    clear(local)
  } catch {
    // ignore
  }
}

/** True if reconnect failure means the saved session is useless and should be dropped. */
export function isReconnectPermanentFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    /Room not found/i.test(msg) ||
    /You are not in this room/i.test(msg) ||
    /not in this room/i.test(msg)
  )
}

/**
 * Build a shareable reconnect URL that works even without local storage.
 */
export function buildReconnectUrl(roomId: string, token: string): string {
  const base = window.location.origin + window.location.pathname
  return `${base}?room=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`
}
