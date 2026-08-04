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
  /** Pool of cards the player must pick from during draft phases. */
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

export type ReactiveWindow = {
  attackerId: string
  victimId: string
  source: 'blind_assassin' | 'shinobi'
  /** Card id that triggered the kill, used to resume after the window resolves. */
  triggerCardId: string
  /** Current decision step; no timer, one player decides at a time. */
  step: 'monk' | 'martyr'
  /** Player who must make the current reactive decision. */
  currentResponderId: string
  /** Player ids who could play Mirror Monk (only victim if they hold one). */
  eligibleMonkIds: string[]
  /** Player ids who could play Martyr (any other alive player who holds one). */
  eligibleMartyrIds: string[]
  /** Remaining Martyr responders in seat order. */
  pendingMartyrIds: string[]
  /** Each eligible player's response. */
  responses: Record<string, ReactiveResponseChoice>
}

export type PendingActionStep =
  | 'pick_target'
  | 'pick_card_to_view'
  | 'pick_card_to_discard'
  | 'pick_token'
  | 'shinobi_decide'
  | 'gravedigger_pick'
  | 'spirit_merchant_swap'
  | 'troublemaker_decide'
  | 'shapeshifter_pick_b'
  | 'shapeshifter_decide'

export type PendingAction = {
  /** Active player who needs to make the choice. */
  playerId: string
  cardId: string
  kind: NinjaCardKind
  variant: TricksterVariant | null
  step: PendingActionStep
  /** For shinobi_decide: target's id and house — already peeked. */
  shinobiTargetId?: string | null
  /** For pick_card_to_view (mystic): which target was chosen. */
  mysticTargetId?: string | null
  /** For spirit_merchant_swap: target id and what was viewed. */
  spiritMerchantTargetId?: string | null
  /** For gravedigger_pick: ids of the up-to-2 cards revealed from the discard pile. */
  gravediggerOptionIds?: string[] | null
  /** For troublemaker_decide: target whose house has been privately viewed. */
  troublemakerTargetId?: string | null
  /** For shapeshifter_pick_b / shapeshifter_decide: first selected player. */
  shapeshifterAId?: string | null
  /** For shapeshifter_decide: second selected player. */
  shapeshifterBId?: string | null
}

export type NightPhaseState = {
  kind: 'spy' | 'mystic' | 'trickster' | 'blind_assassin' | 'shinobi' | 'mastermind'
  /** Resolution queue derived from declarations after all players are declared. */
  resolutionQueue: { playerId: string; cardId: string; priority: number }[]
  /** Current index into resolutionQueue. -1 when queue is not built yet. */
  resolutionIndex: number
  /** True once everyone with a card of this kind has declared. */
  declarationsLocked: boolean
  pendingAction: PendingAction | null
  reactive: ReactiveWindow | null
}

/** Information the engine writes per-player so that only that player's UI surfaces it. */
export type NinjaPrivateRoundState = {
  spyReveals: { targetId: string; card: HouseCard }[]
  mysticReveals: { targetId: string; card: HouseCard; ninjaCardKind: NinjaCardKind; ninjaCardVariant: TricksterVariant | null }[]
  shinobiPeek: { targetId: string; card: HouseCard } | null
  spiritMerchantViews: { targetId: string; tokenValue: HonorTokenValue | null; card: HouseCard | null }[]
  /** Set during troublemaker_decide; cleared once the player chooses reveal/hide. */
  troublemakerPeek: { targetId: string; card: HouseCard } | null
  /** Set during shapeshifter_decide; cleared once the player chooses swap/keep. */
  shapeshifterPeeks: { aId: string; aCard: HouseCard; bId: string; bCard: HouseCard } | null
}

export type NinjaRoom = {
  hostId: string
  state: NinjaPhase
  round: number
  /** Host-selected player count for the next game, 4-11. */
  targetPlayerCount: number
  players: Record<string, NinjaPlayer>
  /** Authoritative clockwise seating order. Used by draft passing and tie-breaks. */
  seatOrder: string[]
  /** Lobby seating map: player id -> seat index (0-10). Drives the round-table layout. */
  seatAssignments: Record<string, number>

  /** Active house card per player this round. May be swapped by Shapeshifter. */
  houseCardAssignments: Record<string, HouseCard>
  /**
   * Player ids whose house card has been publicly revealed this round
   * (Troublemaker reveal, Thief / Judgement self-reveal). Cleared each round.
   */
  publiclyRevealedHouseIds: string[]
  /** Tokens still in the bag, with order locked at room creation/restart. */
  tokenBag: HonorToken[]
  ninjaDiscardPile: NinjaCard[]
  /** Active night phase, null between phases. */
  currentNight: NightPhaseState | null
  /**
   * Player ids of Mastermind owners who revealed the card while still alive
   * during the Mastermind step. If the owner is Crane/Lotus, that house wins
   * the round; if the owner is Ronin, normal house-token distribution is skipped.
   */
  mastermindRevealedAliveIds: string[]

  /** Reveal phase summary. */
  reveal: {
    winningHouse: 'crane' | 'lotus' | 'tie' | 'none'
    aliveIds: string[]
    /** Per-player tokens drawn this round (for animation/UI). */
    tokensDrawn: Record<string, HonorToken[]>
    masterRevealedIds: string[]
    roninWasAlive: boolean
    perfectTie: boolean
    /** True only when Ronin Mastermind blocked normal house-token scoring this round. */
    mastermindBlocked: boolean
  } | null

  resultWinnerIds: string[] | null
  /** Ms timestamp used by clients to lazily expire reactive windows. */
  serverTimeOffset: number
}

export type NinjaSeatRing = {
  ids: string[]
  leftOf: Record<string, string>
  rightOf: Record<string, string>
}
