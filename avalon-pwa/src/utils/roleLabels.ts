/** Display labels for lobby / UI (Chinese). */
export const ROLE_LABEL_ZH: Record<string, string> = {
  MERLIN: '梅林',
  PERCIVAL: '派西维尔',
  SERVANT: '忠臣',
  ASSASSIN: '刺客',
  MORGANA: '莫甘娜',
  OBERON: '奥伯伦',
  MINION: '爪牙',
  MORDRED: '莫德雷德',
}

/** Collapse duplicate role keys into "忠臣 ×2" style lines. */
export function formatRoleListForDisplay(roleKeys: string[]): string[] {
  const counts = new Map<string, number>()
  for (const k of roleKeys) {
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const order = [...new Set(roleKeys)]
  return order.map((key) => {
    const n = counts.get(key) ?? 1
    const label = ROLE_LABEL_ZH[key] ?? key
    return n > 1 ? `${label} ×${n}` : label
  })
}
