import type { HouseCard, NinjaCard, NinjaCardKind } from '../types/ninja'

const KIND_LABEL: Record<NinjaCardKind, string> = {
  spy: '情报员',
  mystic: '灵媒',
  trickster: '欺诈师',
  blind_assassin: '盲眼刺客',
  shinobi: '忍者',
  mirror_monk: '镜僧',
  martyr: '殉道者',
  mastermind: '幕后黑手',
}

const KIND_TONE: Record<NinjaCardKind, string> = {
  spy: 'border-sky-500/30 bg-sky-950/40 text-sky-200',
  mystic: 'border-violet-500/30 bg-violet-950/40 text-violet-200',
  trickster: 'border-amber-500/30 bg-amber-950/40 text-amber-200',
  blind_assassin: 'border-red-500/30 bg-red-950/40 text-red-200',
  shinobi: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200',
  mirror_monk: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-200',
  martyr: 'border-pink-500/30 bg-pink-950/40 text-pink-200',
  mastermind: 'border-indigo-500/30 bg-indigo-950/40 text-indigo-200',
}

export function ninjaKindLabel(kind: NinjaCardKind): string {
  return KIND_LABEL[kind] ?? kind
}

export function NinjaCardView({
  card,
  selected,
  disabled,
  onClick,
  compact,
}: {
  card: NinjaCard
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  compact?: boolean
}) {
  const tone = KIND_TONE[card.kind]
  const cls = `w-full rounded-xl border ${tone} ${compact ? 'px-3 py-2' : 'px-3.5 py-3'} text-left transition-colors ${
    selected ? 'ring-2 ring-white/40' : ''
  } ${disabled ? 'opacity-40' : 'active:bg-white/[0.06]'}`
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      disabled={onClick ? disabled : undefined}
      onClick={onClick}
      className={cls}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tracking-wide">{card.name}</span>
        <span className="text-[0.6875rem] opacity-80">优先级 {card.priority}</span>
      </div>
      {!compact && <p className="text-[0.75rem] mt-1 opacity-80 leading-snug">{card.text}</p>}
    </Comp>
  )
}

export function HouseCardLabel({ card }: { card: HouseCard }) {
  if (card.side === 'ronin') {
    return <span className="text-purple-300 font-semibold">浪人</span>
  }
  if (card.side === 'crane') {
    return (
      <span className="text-rose-300 font-semibold">
        鹤 · 阶级 {card.rank}
      </span>
    )
  }
  return (
    <span className="text-blue-300 font-semibold">
      莲 · 阶级 {card.rank}
    </span>
  )
}
