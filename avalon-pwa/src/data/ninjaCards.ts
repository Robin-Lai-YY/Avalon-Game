import type { HonorToken, HonorTokenValue, NinjaCard, NinjaCardKind, TricksterVariant } from '../types/ninja'

/**
 * Deck composition for Night of the Ninja.
 *
 * Counts and priorities follow the official Brotherwise Games rulebook + FAQ
 * (33 ninja cards total). Card effects mirror the printed cards:
 *  - 5 night phases with priorities 1..6 each (30 cards)
 *  - 6 Trickster variants: Gravedigger, Shapeshifter, Spirit Merchant, Thief,
 *    Troublemaker, Judgement (one of each).
 *  - 3 non-phase special cards: Mirror Monk, Martyr, Mastermind.
 */

type NinjaCardDef = {
  kind: NinjaCardKind
  variant: TricksterVariant | null
  priority: number
  name: string
  text: string
  count: number
}

export const NINJA_CARD_DEFS: NinjaCardDef[] = [
  // Spy phase — view a target's house card. 6 cards, priorities 1..6.
  { kind: 'spy', variant: null, priority: 1, name: '密探 1', text: '指定一名玩家，秘密查看其流派牌。', count: 1 },
  { kind: 'spy', variant: null, priority: 2, name: '密探 2', text: '指定一名玩家，秘密查看其流派牌。', count: 1 },
  { kind: 'spy', variant: null, priority: 3, name: '密探 3', text: '指定一名玩家，秘密查看其流派牌。', count: 1 },
  { kind: 'spy', variant: null, priority: 4, name: '密探 4', text: '指定一名玩家，秘密查看其流派牌。', count: 1 },
  { kind: 'spy', variant: null, priority: 5, name: '密探 5', text: '指定一名玩家，秘密查看其流派牌。', count: 1 },
  { kind: 'spy', variant: null, priority: 6, name: '密探 6', text: '指定一名玩家，秘密查看其流派牌。', count: 1 },

  // Mystic phase — view house card + 1 random ninja card. 6 cards.
  { kind: 'mystic', variant: null, priority: 1, name: '隐士 1', text: '指定一名玩家，秘密查看其流派牌，并随机查看其手中 1 张忍者牌。', count: 1 },
  { kind: 'mystic', variant: null, priority: 2, name: '隐士 2', text: '指定一名玩家，秘密查看其流派牌，并随机查看其手中 1 张忍者牌。', count: 1 },
  { kind: 'mystic', variant: null, priority: 3, name: '隐士 3', text: '指定一名玩家，秘密查看其流派牌，并随机查看其手中 1 张忍者牌。', count: 1 },
  { kind: 'mystic', variant: null, priority: 4, name: '隐士 4', text: '指定一名玩家，秘密查看其流派牌，并随机查看其手中 1 张忍者牌。', count: 1 },
  { kind: 'mystic', variant: null, priority: 5, name: '隐士 5', text: '指定一名玩家，秘密查看其流派牌，并随机查看其手中 1 张忍者牌。', count: 1 },
  { kind: 'mystic', variant: null, priority: 6, name: '隐士 6', text: '指定一名玩家，秘密查看其流派牌，并随机查看其手中 1 张忍者牌。', count: 1 },

  // Trickster phase — 6 unique variants, priorities 1..6.
  { kind: 'trickster', variant: 'gravedigger', priority: 1, name: '盗墓者', text: '从弃牌堆中查看 2 张被弃的忍者牌，挑 1 张加入手牌；可立即按其阶段打出，或保留至本回合后续阶段。', count: 1 },
  { kind: 'trickster', variant: 'shapeshifter', priority: 2, name: '变形者', text: '查看任意两名玩家（可包含自己）的流派牌，可选择是否秘密交换两人的流派牌；被涉及的两人之后不可再自由查看自己的流派牌。', count: 1 },
  { kind: 'trickster', variant: 'spirit_merchant', priority: 3, name: '灵商', text: '查看一名玩家的 1 个荣誉标记或其流派牌；之后可选择交换：将你任一标记给该玩家，并从其手中取走任一标记。', count: 1 },
  { kind: 'trickster', variant: 'thief', priority: 4, name: '盗贼', text: '公开自己的流派牌；从荣誉标记数量比你多的玩家中选 1 人，随机偷取其 1 个荣誉标记。若无人比你多则无效。', count: 1 },
  { kind: 'trickster', variant: 'troublemaker', priority: 5, name: '麻烦制造者', text: '指定一名玩家，秘密查看其流派牌；之后可选择是否将其流派牌当众揭示。', count: 1 },
  { kind: 'trickster', variant: 'judgement', priority: 6, name: '审判', text: '公开自己的流派牌，然后击杀一名玩家。还施僧与殉道者无法响应此击杀。', count: 1 },

  // Blind Assassin — direct kill, can be countered. 6 cards.
  { kind: 'blind_assassin', variant: null, priority: 1, name: '盲眼刺客 1', text: '指定一名玩家，直接将其暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },
  { kind: 'blind_assassin', variant: null, priority: 2, name: '盲眼刺客 2', text: '指定一名玩家，直接将其暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },
  { kind: 'blind_assassin', variant: null, priority: 3, name: '盲眼刺客 3', text: '指定一名玩家，直接将其暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },
  { kind: 'blind_assassin', variant: null, priority: 4, name: '盲眼刺客 4', text: '指定一名玩家，直接将其暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },
  { kind: 'blind_assassin', variant: null, priority: 5, name: '盲眼刺客 5', text: '指定一名玩家，直接将其暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },
  { kind: 'blind_assassin', variant: null, priority: 6, name: '盲眼刺客 6', text: '指定一名玩家，直接将其暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },

  // Shinobi — peek then choose to kill. 6 cards.
  { kind: 'shinobi', variant: null, priority: 1, name: '上忍 1', text: '指定一名玩家，秘密查看其流派牌后决定是否暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },
  { kind: 'shinobi', variant: null, priority: 2, name: '上忍 2', text: '指定一名玩家，秘密查看其流派牌后决定是否暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },
  { kind: 'shinobi', variant: null, priority: 3, name: '上忍 3', text: '指定一名玩家，秘密查看其流派牌后决定是否暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },
  { kind: 'shinobi', variant: null, priority: 4, name: '上忍 4', text: '指定一名玩家，秘密查看其流派牌后决定是否暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },
  { kind: 'shinobi', variant: null, priority: 5, name: '上忍 5', text: '指定一名玩家，秘密查看其流派牌后决定是否暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },
  { kind: 'shinobi', variant: null, priority: 6, name: '上忍 6', text: '指定一名玩家，秘密查看其流派牌后决定是否暗杀（可被还施僧反弹或殉道者代死）。', count: 1 },

  // Reactive cards — held outside phase order, played on assassination triggers.
  { kind: 'mirror_monk', variant: null, priority: 1, name: '还施僧', text: '当你被盲眼刺客或上忍指定为暗杀目标时打出：暗杀反弹至攻击者，你不会死亡。', count: 1 },
  { kind: 'martyr', variant: null, priority: 2, name: '殉道者', text: '当其他玩家被盲眼刺客或上忍暗杀时打出：你代替其死亡，原目标存活。', count: 1 },

  // Mastermind — reveal at end of night; if alive, this player's house wins the round.
  { kind: 'mastermind', variant: null, priority: 1, name: '首脑', text: '夜晚结束时若你仍存活，公开此牌：你的流派赢得本回合。若你是浪人，则仅浪人因存活获得荣誉标记。', count: 1 },
]

/** Asserts at module-load that the configured deck still totals 33 cards. */
export const NINJA_DECK_TOTAL = NINJA_CARD_DEFS.reduce((sum, d) => sum + d.count, 0)
if (NINJA_DECK_TOTAL !== 33) {
  // eslint-disable-next-line no-console
  console.warn(`Ninja deck has ${NINJA_DECK_TOTAL} cards; expected 33. Update ninjaCards.ts counts.`)
}

/** Build a fresh, ordered deck of NinjaCard instances with stable ids. */
export function buildNinjaDeck(): NinjaCard[] {
  const deck: NinjaCard[] = []
  let counter = 0
  for (const def of NINJA_CARD_DEFS) {
    for (let i = 0; i < def.count; i++) {
      deck.push({
        id: `c${counter++}-${def.kind}${def.variant ? `-${def.variant}` : ''}-${def.priority}-${i}`,
        kind: def.kind,
        variant: def.variant,
        priority: def.priority,
        name: def.name,
        text: def.text,
      })
    }
  }
  return deck
}

/** Honor tokens (35) — point distribution is configurable here. */
export const HONOR_TOKEN_DISTRIBUTION: { value: HonorTokenValue; count: number }[] = [
  { value: 2, count: 12 },
  { value: 3, count: 12 },
  { value: 4, count: 11 },
]

export const HONOR_TOKEN_TOTAL = HONOR_TOKEN_DISTRIBUTION.reduce((sum, t) => sum + t.count, 0)

export function buildHonorTokenBag(): HonorToken[] {
  const bag: HonorToken[] = []
  let counter = 0
  for (const def of HONOR_TOKEN_DISTRIBUTION) {
    for (let i = 0; i < def.count; i++) {
      bag.push({ id: `t${counter++}-${def.value}`, value: def.value })
    }
  }
  return bag
}

/**
 * House card distribution by player count (4..11).
 * Equal numbers of Crane/Lotus starting from rank 1, plus Ronin for odd counts.
 */
export function buildHouseDeck(playerCount: number): { side: 'crane' | 'lotus' | 'ronin'; rank?: number }[] {
  if (playerCount < 4 || playerCount > 11) {
    throw new Error('忍者之夜支持 4-11 人')
  }
  const isOdd = playerCount % 2 === 1
  const perHouse = Math.floor(playerCount / 2)
  const cards: { side: 'crane' | 'lotus' | 'ronin'; rank?: number }[] = []
  for (let r = 1; r <= perHouse; r++) {
    cards.push({ side: 'crane', rank: r })
    cards.push({ side: 'lotus', rank: r })
  }
  if (isOdd) cards.push({ side: 'ronin' })
  return cards
}

/** Threshold for game end: a player wins if they reach this many points after a round. */
export const HONOR_WIN_THRESHOLD = 10

/** Number of cards each player drafts at start of the round. */
export const DRAFT_DEAL_SIZE = 3
