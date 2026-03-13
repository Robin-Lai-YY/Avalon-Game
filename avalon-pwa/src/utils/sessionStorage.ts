const KEY_ROOM = 'avalon_roomId'
const KEY_PLAYER = 'avalon_playerId'
const KEY_HOST = 'avalon_isHost'

export type Session = {
  roomId: string
  playerId: string
  isHost: boolean
}

/** Use sessionStorage so each tab keeps its own identity; refresh restores the same tab's player. */
const storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null

export function saveSession(roomId: string, playerId: string, isHost: boolean): void {
  try {
    if (storage) {
      storage.setItem(KEY_ROOM, roomId)
      storage.setItem(KEY_PLAYER, playerId)
      storage.setItem(KEY_HOST, isHost ? '1' : '0')
    }
  } catch {
    // ignore
  }
}

export function loadSession(): Session | null {
  try {
    if (!storage) return null
    const roomId = storage.getItem(KEY_ROOM)
    const playerId = storage.getItem(KEY_PLAYER)
    if (!roomId || !playerId) return null
    return {
      roomId,
      playerId,
      isHost: storage.getItem(KEY_HOST) === '1',
    }
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    if (storage) {
      storage.removeItem(KEY_ROOM)
      storage.removeItem(KEY_PLAYER)
      storage.removeItem(KEY_HOST)
    }
  } catch {
    // ignore
  }
}
