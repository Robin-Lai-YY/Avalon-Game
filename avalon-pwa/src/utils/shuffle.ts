/**
 * Returns a new array with the same elements in uniformly random order (Fisher–Yates).
 * Does not mutate the input array.
 */
export function shuffle<T>(array: readonly T[]): T[] {
  const out = [...array]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}
