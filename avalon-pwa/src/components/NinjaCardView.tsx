import type { HouseCard, NinjaCard, NinjaCardKind } from '../types/ninja'

const KIND_LABEL: Record<NinjaCardKind, string> = {
  spy: '密探',
  mystic: '隐士',
  trickster: '骗徒',
  blind_assassin: '盲眼刺客',
  shinobi: '上忍',
  mirror_monk: '还施僧',
  martyr: '殉道者',
  mastermind: '首脑',
}

const KIND_TONE: Record<NinjaCardKind, string> = {
  spy: 'border-sky-400/40 from-sky-950/90 via-slate-950 to-sky-900/70 text-sky-100',
  mystic: 'border-violet-400/40 from-violet-950/90 via-slate-950 to-fuchsia-900/70 text-violet-100',
  trickster: 'border-amber-400/45 from-amber-950/90 via-slate-950 to-orange-900/70 text-amber-100',
  blind_assassin: 'border-red-400/45 from-red-950/90 via-slate-950 to-rose-900/70 text-red-100',
  shinobi: 'border-emerald-400/40 from-emerald-950/90 via-slate-950 to-teal-900/70 text-emerald-100',
  mirror_monk: 'border-cyan-400/40 from-cyan-950/90 via-slate-950 to-blue-900/70 text-cyan-100',
  martyr: 'border-pink-400/40 from-pink-950/90 via-slate-950 to-rose-900/70 text-pink-100',
  mastermind: 'border-indigo-400/45 from-indigo-950/90 via-slate-950 to-purple-900/70 text-indigo-100',
}

const KIND_ACCENT: Record<NinjaCardKind, string> = {
  spy: 'bg-sky-300/15 text-sky-100 border-sky-200/20',
  mystic: 'bg-violet-300/15 text-violet-100 border-violet-200/20',
  trickster: 'bg-amber-300/15 text-amber-100 border-amber-200/20',
  blind_assassin: 'bg-red-300/15 text-red-100 border-red-200/20',
  shinobi: 'bg-emerald-300/15 text-emerald-100 border-emerald-200/20',
  mirror_monk: 'bg-cyan-300/15 text-cyan-100 border-cyan-200/20',
  martyr: 'bg-pink-300/15 text-pink-100 border-pink-200/20',
  mastermind: 'bg-indigo-300/15 text-indigo-100 border-indigo-200/20',
}

const CARD_ART_COPY: Record<NinjaCardKind, string> = {
  spy: '刺探流派',
  mystic: '隐修窥视',
  trickster: '扰乱与诡计',
  blind_assassin: '无视身份的暗杀',
  shinobi: '确认身份后出手',
  mirror_monk: '反射暗杀',
  martyr: '替身赴死',
  mastermind: '独占荣誉',
}

const CARD_ART_FILE: Record<NinjaCardKind, string> = {
  spy: 'spy',
  mystic: 'mystic',
  trickster: 'trickster',
  blind_assassin: 'blind-assassin',
  shinobi: 'shinobi',
  mirror_monk: 'mirror-monk',
  martyr: 'martyr',
  mastermind: 'mastermind',
}

function NinjaCardArt({ kind }: { kind: NinjaCardKind }) {
  const common = 'fill-none stroke-current stroke-[1.8] opacity-85'
  if (kind === 'spy') {
    return (
      <svg viewBox="0 0 80 56" className="h-16 w-24 opacity-80" aria-hidden="true">
        <path className={common} d="M8 28s12-16 32-16 32 16 32 16-12 16-32 16S8 28 8 28Z" />
        <circle className={common} cx="40" cy="28" r="9" />
        <path className={common} d="M40 19v-7M40 44v-7M19 28h-7M68 28h-7" />
      </svg>
    )
  }
  if (kind === 'mystic') {
    return (
      <svg viewBox="0 0 80 56" className="h-16 w-24 opacity-80" aria-hidden="true">
        <path className={common} d="M40 5l7 16 17 2-13 11 4 17-15-9-15 9 4-17-13-11 17-2 7-16Z" />
        <path className={common} d="M22 48c7-5 29-5 36 0M18 13l5 5M62 13l-5 5" />
      </svg>
    )
  }
  if (kind === 'trickster') {
    return (
      <svg viewBox="0 0 80 56" className="h-16 w-24 opacity-80" aria-hidden="true">
        <path className={common} d="M17 15c10 6 36 6 46 0v15c0 14-11 21-23 21S17 44 17 30V15Z" />
        <path className={common} d="M28 30c3-3 7-3 10 0M42 30c3-3 7-3 10 0M30 40c7 4 13 4 20 0" />
      </svg>
    )
  }
  if (kind === 'blind_assassin') {
    return (
      <svg viewBox="0 0 80 56" className="h-16 w-24 opacity-80" aria-hidden="true">
        <path className={common} d="M50 5L18 37l-4 15 15-4L61 16 50 5Z" />
        <path className={common} d="M43 12l11 11M20 36l8 8M56 10l10-5 9 9-5 10" />
      </svg>
    )
  }
  if (kind === 'shinobi') {
    return (
      <svg viewBox="0 0 80 56" className="h-16 w-24 opacity-80" aria-hidden="true">
        <path className={common} d="M40 7l23 11v15c0 12-9 19-23 20-14-1-23-8-23-20V18L40 7Z" />
        <path className={common} d="M25 29h30M32 21l-7 8 7 8M48 21l7 8-7 8" />
      </svg>
    )
  }
  if (kind === 'mirror_monk') {
    return (
      <svg viewBox="0 0 80 56" className="h-16 w-24 opacity-80" aria-hidden="true">
        <path className={common} d="M40 6c12 7 19 17 19 28 0 9-7 16-19 16s-19-7-19-16c0-11 7-21 19-28Z" />
        <path className={common} d="M30 27h20M26 36h28M35 17l-5 10M45 17l5 10" />
      </svg>
    )
  }
  if (kind === 'martyr') {
    return (
      <svg viewBox="0 0 80 56" className="h-16 w-24 opacity-80" aria-hidden="true">
        <path className={common} d="M40 9v38M24 25h32M22 47h36" />
        <path className={common} d="M40 9c-9 6-14 13-14 21M40 9c9 6 14 13 14 21" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 80 56" className="h-16 w-24 opacity-80" aria-hidden="true">
      <path className={common} d="M40 6l25 13-6 29H21l-6-29L40 6Z" />
      <path className={common} d="M27 30l8 8 18-18M24 48h32" />
    </svg>
  )
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
  const interactive = !!onClick && !disabled
  const displayName = card.name.replace(/\s+\d+$/, '')
  const showKindBadge = displayName !== ninjaKindLabel(card.kind)
  const artSrc = `${import.meta.env.BASE_URL}ninja/card-art/${CARD_ART_FILE[card.kind]}.webp`
  const Comp = onClick ? 'button' : 'div'

  if (compact) {
    const compactCls = `group relative flex h-[318px] w-full flex-col overflow-hidden rounded-[1.2rem] border bg-gradient-to-br ${tone} px-3 py-3 text-left shadow-xl shadow-black/20 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-100 ${
      selected ? 'border-amber-100/90 ring-2 ring-amber-100/60 shadow-amber-500/20' : ''
    } ${disabled ? 'opacity-40' : interactive ? 'cursor-pointer hover:border-white/40 hover:shadow-rose-950/30 active:border-white/50' : ''}`

    return (
      <Comp
        type={onClick ? 'button' : undefined}
        disabled={onClick ? disabled : undefined}
        onClick={onClick}
        className={compactCls}
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-white/[0.08] blur-2xl" />
        <div className="pointer-events-none absolute inset-0 rounded-[1.2rem] border border-white/[0.07]" />

        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-[0.08em] text-slate-50">{displayName}</p>
            <div className="mt-1 flex min-h-[22px] flex-wrap items-start gap-1.5">
              {showKindBadge && (
                <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-[0.14em] ${KIND_ACCENT[card.kind]}`}>
                  {ninjaKindLabel(card.kind)}
                </span>
              )}
              {selected && (
                <span className="inline-flex rounded-full border border-amber-100/50 bg-amber-300/25 px-1.5 py-0.5 text-[0.5625rem] font-black tracking-wide text-amber-50">
                  已选中
                </span>
              )}
            </div>
          </div>
          <span className="flex min-h-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/25 px-2 text-[0.625rem] font-black text-white/80 shadow-inner">
            优先 {card.priority}
          </span>
        </div>

        <div className="relative my-2.5 flex h-[168px] items-end overflow-hidden rounded-2xl border border-white/[0.1] bg-black/30 p-2.5 shadow-[inset_0_0_28px_rgba(255,255,255,0.05)]">
          <div className="absolute inset-0 flex items-center justify-center text-white/35">
            <NinjaCardArt kind={card.kind} />
          </div>
          <img
            src={artSrc}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
            className="absolute inset-0 h-full w-full object-cover object-center opacity-95"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-slate-950/10" />
          <span className="relative rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[0.5625rem] font-bold uppercase tracking-[0.16em] text-white/80 backdrop-blur-sm">
            {CARD_ART_COPY[card.kind]}
          </span>
        </div>
        <p className="relative line-clamp-3 text-[0.6875rem] leading-snug text-slate-100/90">
          {card.text}
        </p>
      </Comp>
    )
  }

  const cls = `group relative flex h-[386px] w-full flex-col overflow-hidden rounded-[1.35rem] border bg-gradient-to-br ${tone} px-3.5 py-3.5 text-left shadow-2xl shadow-black/25 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-100 ${
    selected ? 'border-amber-100/90 ring-2 ring-amber-100/70 shadow-amber-500/25' : ''
  } ${disabled ? 'opacity-40' : interactive ? 'cursor-pointer hover:border-white/40 hover:shadow-rose-950/35 active:border-white/50' : ''}`
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      disabled={onClick ? disabled : undefined}
      onClick={onClick}
      className={cls}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/[0.1] blur-2xl" />
      <div className="pointer-events-none absolute inset-0 rounded-[1.35rem] border border-white/[0.07]" />
      <div className="pointer-events-none absolute left-3 right-3 top-3 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block truncate text-sm font-black tracking-[0.08em]">{displayName}</span>
          <div className="mt-1 flex min-h-[24px] flex-wrap items-start gap-1.5">
            {showKindBadge && (
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.16em] ${KIND_ACCENT[card.kind]}`}>
                {ninjaKindLabel(card.kind)}
              </span>
            )}
            {selected && (
              <span className="inline-flex rounded-full border border-amber-100/50 bg-amber-300/25 px-2 py-0.5 text-[0.625rem] font-black tracking-wide text-amber-50 shadow-lg shadow-amber-950/30">
                已选中
              </span>
            )}
          </div>
        </div>
        <span className="flex min-h-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/25 px-2 text-[0.625rem] font-black text-white/80 shadow-inner">
          优先 {card.priority}
        </span>
      </div>
      <div className="relative my-3 flex h-[224px] items-end overflow-hidden rounded-2xl border border-white/[0.1] bg-black/30 p-3 shadow-[inset_0_0_34px_rgba(255,255,255,0.05)]">
        <div className="absolute inset-0 flex items-center justify-center text-white/35">
          <NinjaCardArt kind={card.kind} />
        </div>
        <img
          src={artSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
          className="absolute inset-0 h-full w-full object-cover object-center opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/55 via-transparent to-slate-950/10" />
        <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />
        <span className="relative rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm">
          {CARD_ART_COPY[card.kind]}
        </span>
      </div>
      <p className="relative line-clamp-4 text-[0.75rem] leading-snug opacity-90">
        {card.text}
      </p>
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
