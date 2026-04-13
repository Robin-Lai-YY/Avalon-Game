export type UndercoverRole = 'civilian' | 'undercover' | 'blank'

export type UndercoverWinner = 'CIVILIAN_WIN' | 'UNDERCOVER_WIN' | 'BLANK_WIN'

export type UndercoverPhase = 'LOBBY' | 'WORD_REVEAL' | 'VOTING' | 'TIE_SPEAK' | 'END'

/** 一组近义词，A/B 对称；每局开局随机决定谁是平民词、谁是卧底词。 */
export type UndercoverWordPair = {
  wordA: string
  wordB: string
}

/** 本局已随机分配后的词对（写入房间）。 */
export type UndercoverWordRound = UndercoverWordPair & {
  civilianUsesA: boolean
}

export type UndercoverPlayer = {
  name: string
  ready: boolean
  isAlive: boolean
  role: UndercoverRole | ''
  word: string | null
  reconnectToken: string
  /** 大厅内是否同意本局使用隐藏题库；仅本人应在 UI 中展示，勿在列表中泄露他人选择。 */
  preferHiddenBank?: boolean
}

export type UndercoverRoleSettings = {
  undercoverCount: number
  blankCount: number
  recommendedUndercoverCount: number
  recommendedBlankCount: number
}

export type UndercoverVoteMap = Record<string, string>

export type UndercoverRoundResolution = {
  status: 'WAITING' | 'TIE_SPEAK' | 'ELIMINATED' | 'END'
  eliminatedId?: string
  eliminatedRole?: UndercoverRole
  winner?: UndercoverWinner
  reason?: 'NORMAL' | 'RANDOM_TIE_BREAK'
  tieCandidates?: string[]
}

export type UndercoverRoom = {
  hostId: string
  state: UndercoverPhase
  round: number
  tieRevoteCount: number
  maxTieRevotes: number
  players: Record<string, UndercoverPlayer>
  votes: UndercoverVoteMap
  tieCandidates: string[]
  wordPair: UndercoverWordRound | null
  lastEliminatedId: string | null
  lastEliminatedRole: UndercoverRole | null
  resultWinner: UndercoverWinner | null
  resultReason: 'NORMAL' | 'RANDOM_TIE_BREAK' | null
  roleSettings: UndercoverRoleSettings
}
