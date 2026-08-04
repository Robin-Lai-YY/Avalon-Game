/**
 * Night of the Ninja types.
 *
 * Note on Firebase Realtime Database conventions used here:
 * - We avoid `undefined` (RTDB rejects it) — use `null` for absent values.
 * - Ordered lists (hand, draftHand, discard pile, resolution queue) are stored as arrays.
 * - Per-player private info lives under `privateState/{playerId}/...` so subscribers can scope it.
 */

export type HouseSide = 'crane' | 'lotus' | 'ronin'

export type HouseCard =
  | { side: 'crane' | 'lotus'; rank: number }
  | { side: 'ronin' }

export type NinjaCardKind =
  | 'spy'
  | 'mystic'
  | 'trickster'
  | 'blind_assassin'
  | 'shinobi'
  | 'mirror_monk'
  | 'martyr'
  | 'mastermind'

export type TricksterVariant =
  | 'gravedigger'
  | 'shapeshifter'
  | 'spirit_merchant'
  | 'thief'
  | 'troublemaker'
  | 'judgement'

export type NinjaCard = {
  /** Stable instance id within a deck shuffle. */
  id: string
  kind: NinjaCardKind
  /** Defined for tricksters; null otherwise. */
  variant: TricksterVariant | null
  /** Within-phase resolution priority (smaller goes first). */
  priority: number
  /** Display name. */
  name: string
  /** Effect text shown to the player. */
  text: string
}

export type NinjaPhase =
  | 'LOBBY'
  | 'HOUSE_REVEAL'
  | 'DRAFT_PICK_1'
  | 'DRAFT_PICK_2'
  | 'NIGHT_SPY'
  | 'NIGHT_MYSTIC'
  | 'NIGHT_TRICKSTER'
  | 'NIGHT_BLIND_ASSASSIN'
  | 'NIGHT_SHINOBI'
  /** @deprecated Kept for old rooms; no longer used in the night sequence. */
  | 'NIGHT_MASTERMIND'
  | 'REVEAL'
  | 'GAME_END'

export type HonorTokenValue = 2 | 3 | 4

export type HonorToken = {
  /** Stable id used to keep individual tokens unique even when point values repeat. */
  id: string
  value: HonorTokenValue
}

/** Public per-player state stored under `players/{id}` on the room. */
export type NinjaPlayer = {
  name: string
  ready: boolean
  isAlive: boolean
  reconnectToken: string
  /** Firebase Auth uid bound to this seat (anonymous or linked). */
  uid?: string
  lastSeen?: number
  seatGeneration?: number

  /** Cards currently in the player's hand (face-down to others, public to self). */
  hand: NinjaCard[]
  /** Pool of cards the player must pick from during the current draft phase. */
  draftHand: NinjaCard[]
  /** Card id chosen during the current draft phase but not yet committed. */
  draftPick: string | null
  /** "play" or "hold" choice during the current night phase, keyed by card id. */
  nightChoices: Record<string, 'play' | 'hold'>
  /** True once the player has acknowledged the HOUSE_REVEAL prompt this round. */
  hasAcknowledgedHouse: boolean
  /** True once the player has acknowledged the round-end REVEAL summary. */
  hasAcknowledgedReveal: boolean
  /** Cleared by Shapeshifter — when false, the player can no longer freely peek their house card. */
  canViewHouse: boolean

  /** Cumulative honor tokens — persists across rounds. */
  honorTokens: HonorToken[]
}

export type ReactiveResponseChoice = 'monk' | 'martyr' | 'pass'

/** Victim-only reactive window (Mirror Monk / Martyr self-protect). */
export type ReactiveWindow = {
  attackerId: string
  victimId: string
  source: 'blind_assassin' | 'shinobi'
  triggerCardId: string
  step: 'monk' | 'martyr'
  currentResponderId: string
  /** Victim id if they hold Mirror Monk; else empty. */
  eligibleMonkIds: string[]
  /** Victim id if they hold Martyr; else empty. */
  eligibleMartyrIds: string[]
  /** @deprecated Unused; kept empty for RTDB shape stability. */
  pendingMartyrIds: string[]
  responses: Record<string, ReactiveResponseChoice>
}

export type PendingActionStep =
  | 'pick_target'
  | 'pick_card_to_view'
  | 'pick_card_to_discard'
  | 'pick_token'
  | 'shinobi_decide'
  | 'gravedigger_pick'
  | 'gravedigger_decide'
  | 'spirit_merchant_view'
  | 'spirit_merchant_swap'
  | 'troublemaker_decide'
  | 'shapeshifter_pick_b'
  | 'shapeshifter_decide'

export type PendingAction = {
  playerId: string
  cardId: string
  kind: NinjaCardKind
  variant: TricksterVariant | null
  step: PendingActionStep
  shinobiTargetId?: string | null
  mysticTargetId?: string | null
  spiritMerchantTargetId?: string | null
  gravediggerOptionIds?: string[] | null
  /** After pick: the card taken from discard (before play-now / keep). */
  gravediggerPickedId?: string | null
  troublemakerTargetId?: string | null
  shapeshifterAId?: string | null
  shapeshifterBId?: string | null
}

export type NightPhaseState = {
  kind: 'spy' | 'mystic' | 'trickster' | 'blind_assassin' | 'shinobi'
  resolutionQueue: { playerId: string; cardId: string; priority: number }[]
  resolutionIndex: number
  declarationsLocked: boolean
  /** Alive players who confirmed this phase (no matching cards → tap ack). */
  phaseAckIds: string[]
  pendingAction: PendingAction | null
  reactive: ReactiveWindow | null
}

export type NinjaPublicNightEventKind =
  | 'phase_plays'
  | 'phase_skip'
  | 'peek'
  | 'swap_lock'
  | 'public_reveal'
  | 'kill'
  | 'reactive'
  | 'steal'
  | 'gravedigger'
  | 'mastermind'
  | 'spirit_merchant'

export type NinjaPublicNightEvent = {
  id: string
  at: number
  round: number
  kind: NinjaPublicNightEventKind
  actorId?: string | null
  cardLabel?: string | null
  targetIds?: string[] | null
  text: string
}

/** Information the engine writes per-player so that only that player's UI surfaces it. */
export type NinjaPrivateRoundState = {
  spyReveals: { targetId: string; card: HouseCard }[]
  mysticReveals: {
    targetId: string
    card: HouseCard
    ninjaCardKind: NinjaCardKind | null
    ninjaCardVariant: TricksterVariant | null
  }[]
  shinobiPeek: { targetId: string; card: HouseCard } | null
  spiritMerchantViews: { targetId: string; tokenValue: HonorTokenValue | null; card: HouseCard | null }[]
  troublemakerPeek: { targetId: string; card: HouseCard } | null
  shapeshifterPeeks: { aId: string; aCard: HouseCard; bId: string; bCard: HouseCard } | null
}

export type NinjaRoom = {
  hostId: string
  state: NinjaPhase
  round: number
  targetPlayerCount: number
  players: Record<string, NinjaPlayer>
  seatOrder: string[]
  seatAssignments: Record<string, number>

  houseCardAssignments: Record<string, HouseCard>
  /**
   * Snapshot of publicly revealed house cards this round (Troublemaker / Thief / Judgement).
   * Cleared on Shapeshifter swap for involved seats so the new secret card is not shown as public.
   */
  publiclyRevealedHouses: Record<string, HouseCard>
  /** @deprecated Prefer publiclyRevealedHouses; kept synced for older clients. */
  publiclyRevealedHouseIds: string[]
  tokenBag: HonorToken[]
  ninjaDiscardPile: NinjaCard[]
  currentNight: NightPhaseState | null
  /** Chronological public night actions this round. */
  publicNightLog: NinjaPublicNightEvent[]
  /**
   * Alive Mastermind owners auto-revealed at end of night.
   * Crane/Lotus forces that house win; Ronin blocks normal house-token distribution.
   */
  mastermindRevealedAliveIds: string[]

  reveal: {
    winningHouse: 'crane' | 'lotus' | 'tie' | 'none'
    aliveIds: string[]
    tokensDrawn: Record<string, HonorToken[]>
    masterRevealedIds: string[]
    roninWasAlive: boolean
    perfectTie: boolean
    mastermindBlocked: boolean
  } | null

  resultWinnerIds: string[] | null
  serverTimeOffset: number
}

export type NinjaSeatRing = {
  ids: string[]
  leftOf: Record<string, string>
  rightOf: Record<string, string>
}
