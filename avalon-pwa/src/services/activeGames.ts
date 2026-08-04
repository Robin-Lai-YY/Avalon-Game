import { get, onValue, ref, remove, set, type Unsubscribe } from 'firebase/database'
import { ensureAnonymousAuth } from './auth'
import { db } from './firebase'

export type ActiveGameType = 'avalon' | 'undercover' | 'ninja'

export type ActiveGameEntry = {
  game: ActiveGameType
  roomId: string
  playerId: string
  isHost: boolean
  updatedAt: number
}

export function activeGameKey(game: ActiveGameType, roomId: string): string {
  return `${game}_${roomId}`
}

function entryRef(uid: string, game: ActiveGameType, roomId: string) {
  return ref(db, `users/${uid}/activeGames/${activeGameKey(game, roomId)}`)
}

function listRef(uid: string) {
  return ref(db, `users/${uid}/activeGames`)
}

export async function setActiveGame(
  game: ActiveGameType,
  roomId: string,
  playerId: string,
  isHost: boolean,
  uid?: string
): Promise<void> {
  const userUid = uid ?? (await ensureAnonymousAuth()).uid
  const entry: ActiveGameEntry = {
    game,
    roomId,
    playerId,
    isHost,
    updatedAt: Date.now(),
  }
  await set(entryRef(userUid, game, roomId), entry)
}

export async function clearActiveGame(
  game: ActiveGameType,
  roomId: string,
  uid?: string
): Promise<void> {
  const userUid = uid ?? (await ensureAnonymousAuth()).uid
  await remove(entryRef(userUid, game, roomId))
}

/** Clear only if the indexed playerId matches (avoids wiping another seat). */
export async function clearActiveGameIfOwned(
  game: ActiveGameType,
  roomId: string,
  playerId: string,
  uid?: string
): Promise<void> {
  const userUid = uid ?? (await ensureAnonymousAuth()).uid
  const snap = await get(entryRef(userUid, game, roomId))
  if (!snap.exists()) return
  const entry = snap.val() as ActiveGameEntry
  if (entry.playerId === playerId) {
    await remove(entryRef(userUid, game, roomId))
  }
}

export async function getActiveGame(
  game: ActiveGameType,
  roomId: string,
  uid?: string
): Promise<ActiveGameEntry | null> {
  const userUid = uid ?? (await ensureAnonymousAuth()).uid
  const snap = await get(entryRef(userUid, game, roomId))
  if (!snap.exists()) return null
  return snap.val() as ActiveGameEntry
}

export async function listActiveGames(uid?: string): Promise<ActiveGameEntry[]> {
  const userUid = uid ?? (await ensureAnonymousAuth()).uid
  const snap = await get(listRef(userUid))
  if (!snap.exists()) return []
  const raw = snap.val() as Record<string, ActiveGameEntry>
  return Object.values(raw)
    .filter((e) => e && e.roomId && e.playerId && e.game)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

/** Subscribe to the current user's active games list. */
export function subscribeActiveGames(
  onChange: (entries: ActiveGameEntry[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let unsubDb: Unsubscribe | null = null
  let cancelled = false

  void ensureAnonymousAuth()
    .then((user) => {
      if (cancelled) return
      unsubDb = onValue(
        listRef(user.uid),
        (snap) => {
          if (!snap.exists()) {
            onChange([])
            return
          }
          const raw = snap.val() as Record<string, ActiveGameEntry>
          const entries = Object.values(raw)
            .filter((e) => e && e.roomId && e.playerId && e.game)
            .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
          onChange(entries)
        },
        (err) => onError?.(err)
      )
    })
    .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))))

  return () => {
    cancelled = true
    unsubDb?.()
  }
}

export const GAME_LABELS: Record<ActiveGameType, string> = {
  avalon: '阿瓦隆',
  undercover: '谁是卧底',
  ninja: '忍者之夜',
}
