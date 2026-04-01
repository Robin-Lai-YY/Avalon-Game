export type UndercoverRole = 'civilian' | 'undercover' | 'blank'

export type UndercoverWinner = 'CIVILIAN_WIN' | 'UNDERCOVER_WIN' | 'BLANK_WIN'

export type UndercoverPhase = 'LOBBY' | 'WORD_REVEAL' | 'VOTING' | 'TIE_SPEAK' | 'END'

export type UndercoverWordPair = {
  civilianWord: string
  undercoverWord: string
}

export type UndercoverPlayer = {
  name: string
  ready: boolean
  isAlive: boolean
  role: UndercoverRole | ''
  word: string | null
  reconnectToken: string
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
  wordPair: UndercoverWordPair | null
  lastEliminatedId: string | null
  lastEliminatedRole: UndercoverRole | null
  resultWinner: UndercoverWinner | null
  resultReason: 'NORMAL' | 'RANDOM_TIE_BREAK' | null
  roleSettings: UndercoverRoleSettings
}
