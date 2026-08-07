import type { ActiveGameType } from '../services/activeGames'

/** Room states that mean the match is over and should not be auto-resumed. */
export const TERMINAL_STATES: Record<ActiveGameType, string> = {
  avalon: 'GAME_END',
  undercover: 'END',
  ninja: 'GAME_END',
}

export function isTerminalState(game: ActiveGameType, state: string | null | undefined): boolean {
  if (!state) return false
  return state === TERMINAL_STATES[game]
}

export function terminalNotice(game: ActiveGameType): string {
  if (game === 'avalon') return '上次阿瓦隆对局已结束，请创建或加入新房间。'
  if (game === 'undercover') return '上次谁是卧底对局已结束，请创建或加入新房间。'
  return '上次忍者之夜对局已结束，请创建或加入新房间。'
}
