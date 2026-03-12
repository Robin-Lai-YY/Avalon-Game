/**
 * Mission team size by (round, playerCount). Rounds are 1-based.
 * Source: Avalon rules table.
 */
const MISSION_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
}

/**
 * Returns the required mission team size for the given round (1–5) and player count (5–10).
 */
export function getMissionTeamSize(round: number, playerCount: number): number {
  const row = MISSION_SIZES[playerCount]
  if (!row || round < 1 || round > 5) return 0
  return row[round - 1] ?? 0
}

/**
 * Round 4 with 7+ players requires two fail votes for mission to fail.
 */
export function isDoubleFailRound(round: number, playerCount: number): boolean {
  return round === 4 && playerCount >= 7
}
