import { onValue, ref, set, type Unsubscribe } from 'firebase/database'
import { db } from './firebase'

/** How often the client writes lastSeen while in a room. */
export const HEARTBEAT_MS = 20_000

/** Seat is considered offline if lastSeen is older than this (or missing). */
export const OFFLINE_MS = 75_000

export function isPlayerOffline(lastSeen: number | null | undefined, now = Date.now()): boolean {
  if (lastSeen == null || !Number.isFinite(lastSeen) || lastSeen <= 0) return true
  return now - lastSeen > OFFLINE_MS
}

export function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase()
}

export function findPlayerIdByName(
  players: Record<string, { name?: string } | undefined>,
  name: string
): string | null {
  const incoming = normalizePlayerName(name)
  if (!incoming) return null
  for (const [id, p] of Object.entries(players)) {
    if (normalizePlayerName(p?.name ?? '') === incoming) return id
  }
  return null
}

/**
 * Periodically writes `lastSeen` under `players/{playerId}` for the given room path prefix
 * (e.g. `rooms/ABC123` or `undercoverRooms/UXXXXX`).
 */
export function startPresenceHeartbeat(roomPath: string, playerId: string): () => void {
  const lastSeenRef = ref(db, `${roomPath}/players/${playerId}/lastSeen`)

  const touch = () => {
    void set(lastSeenRef, Date.now()).catch(() => {
      // ignore transient write failures
    })
  }

  touch()
  const intervalId = window.setInterval(touch, HEARTBEAT_MS)

  const onVisibility = () => {
    if (document.visibilityState === 'visible') touch()
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    window.clearInterval(intervalId)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

/**
 * Watch seatGeneration for takeover. Calls onTakenOver when remote generation exceeds local.
 */
export function watchSeatGeneration(
  roomPath: string,
  playerId: string,
  localGeneration: number,
  onTakenOver: () => void
): Unsubscribe {
  const genRef = ref(db, `${roomPath}/players/${playerId}/seatGeneration`)
  let fired = false
  return onValue(genRef, (snap) => {
    if (fired) return
    const remote = snap.exists() ? Number(snap.val()) : 0
    if (!Number.isFinite(remote)) return
    if (remote > localGeneration) {
      fired = true
      onTakenOver()
    }
  })
}
