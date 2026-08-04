import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { auth } from './firebase'

let authReady: Promise<User> | null = null

/**
 * Ensure the client has a Firebase Auth user (anonymous).
 * Idempotent: reuses the current session if already signed in.
 */
export function ensureAnonymousAuth(): Promise<User> {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser)
  }
  if (authReady) return authReady

  authReady = (async () => {
    const existing = await new Promise<User | null>((resolve, reject) => {
      const unsub = onAuthStateChanged(
        auth,
        (user) => {
          unsub()
          resolve(user)
        },
        (err) => {
          unsub()
          reject(err)
        }
      )
    })
    if (existing) return existing
    const cred = await signInAnonymously(auth)
    return cred.user
  })().catch((err) => {
    authReady = null
    throw err
  })

  return authReady
}

export function getCurrentUid(): string | null {
  return auth.currentUser?.uid ?? null
}
