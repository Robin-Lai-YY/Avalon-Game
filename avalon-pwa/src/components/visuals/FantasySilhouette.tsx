import { useId } from 'react'

const GOOD_PRIMARY = '#60a5fa'
const GOOD_SECONDARY = '#93c5fd'
const EVIL_PRIMARY = '#f87171'
const EVIL_SECONDARY = '#fca5a5'
const ACCENT_PURPLE = '#a78bfa'
const ACCENT_GOLD = '#fbbf24'

type Variant = 'good' | 'evil' | 'merlin' | 'percival' | 'assassin' | 'morgana' | 'servant' | 'minion' | 'mordred' | 'oberon'

function isEvilVariant(v: Variant): boolean {
  return ['evil', 'assassin', 'morgana', 'minion', 'mordred', 'oberon'].includes(v)
}

type FantasySilhouetteProps = {
  variant: Variant
  className?: string
  size?: number
}

export function FantasySilhouette({ variant, className = '', size = 120 }: FantasySilhouetteProps) {
  if (variant === 'good' || variant === 'evil') {
    const base = import.meta.env.BASE_URL
    const src = variant === 'good' ? `${base}faction-good.png` : `${base}faction-evil.png`
    return (
      <img
        src={src}
        alt={variant === 'good' ? '正义阵营' : '邪恶阵营'}
        width={size}
        height={size}
        className={`object-cover ${className}`}
        draggable={false}
      />
    )
  }

  const uid = useId().replace(/:/g, '')
  const evil = isEvilVariant(variant)
  const primary = evil ? EVIL_PRIMARY : GOOD_PRIMARY
  const secondary = evil ? EVIL_SECONDARY : GOOD_SECONDARY
  const gradId = `grad-${uid}`
  const glowId = `glow-${uid}`
  const maskId = `mask-${uid}`

  const gradientDef = (
    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={secondary} stopOpacity="0.95" />
      <stop offset="100%" stopColor={primary} stopOpacity="0.7" />
    </linearGradient>
  )

  const glowDef = (
    <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  )

  function renderIcon() {
    switch (variant) {
      case 'merlin':
        return (
          <g>
            {/* Wizard hat */}
            <path d="M50 6 L62 34 L38 34 Z" fill={`url(#${gradId})`} opacity="0.9" />
            <line x1="50" y1="6" x2="56" y2="12" stroke={ACCENT_GOLD} strokeWidth="1.5" opacity="0.7" />
            <circle cx="56" cy="12" r="2" fill={ACCENT_GOLD} opacity="0.8" />
            {/* Head */}
            <circle cx="50" cy="42" r="10" fill={`url(#${gradId})`} />
            {/* Robe */}
            <path d="M34 50 Q50 46 66 50 L72 98 Q50 102 28 98 Z" fill={`url(#${gradId})`} opacity="0.8" />
            {/* Staff */}
            <line x1="72" y1="40" x2="76" y2="96" stroke={GOOD_SECONDARY} strokeWidth="2" opacity="0.5" strokeLinecap="round" />
            <circle cx="72" cy="38" r="4" fill={ACCENT_GOLD} opacity="0.6" />
            <circle cx="72" cy="38" r="2" fill="white" opacity="0.3" />
            {/* Orb glow */}
            <circle cx="50" cy="70" r="5" fill={GOOD_SECONDARY} opacity="0.15" />
            <circle cx="50" cy="70" r="2.5" fill={GOOD_SECONDARY} opacity="0.3" />
          </g>
        )

      case 'percival':
        return (
          <g>
            {/* Helmet */}
            <path d="M38 28 Q50 16 62 28 L62 38 Q50 42 38 38 Z" fill={`url(#${gradId})`} opacity="0.9" />
            <line x1="50" y1="18" x2="50" y2="28" stroke={GOOD_SECONDARY} strokeWidth="2" opacity="0.5" strokeLinecap="round" />
            {/* Visor */}
            <path d="M42 32 Q50 30 58 32" stroke={primary} strokeWidth="1.5" fill="none" opacity="0.6" />
            {/* Head */}
            <circle cx="50" cy="36" r="9" fill={`url(#${gradId})`} />
            {/* Armor body */}
            <path d="M36 44 L64 44 L68 96 L32 96 Z" fill={`url(#${gradId})`} opacity="0.85" />
            {/* Shoulder guards */}
            <ellipse cx="34" cy="48" rx="6" ry="4" fill={primary} opacity="0.6" />
            <ellipse cx="66" cy="48" rx="6" ry="4" fill={primary} opacity="0.6" />
            {/* Shield */}
            <path d="M24 56 L32 52 L32 72 L28 76 Z" fill={GOOD_SECONDARY} opacity="0.4" />
            <line x1="28" y1="58" x2="28" y2="70" stroke={GOOD_PRIMARY} strokeWidth="1" opacity="0.3" />
            {/* Belt */}
            <rect x="36" y="68" width="28" height="3" rx="1.5" fill={primary} opacity="0.4" />
          </g>
        )

      case 'servant':
        return (
          <g>
            {/* Hood */}
            <path d="M36 30 Q50 18 64 30 L66 42 Q50 46 34 42 Z" fill={`url(#${gradId})`} opacity="0.85" />
            {/* Head */}
            <circle cx="50" cy="38" r="9" fill={`url(#${gradId})`} />
            {/* Cloak */}
            <path d="M34 44 Q50 40 66 44 L70 98 Q50 100 30 98 Z" fill={`url(#${gradId})`} opacity="0.75" />
            {/* Inner vest */}
            <path d="M42 50 L58 50 L56 88 L44 88 Z" fill={primary} opacity="0.25" />
            {/* Subtle loyal heart emblem */}
            <circle cx="50" cy="62" r="3" fill={GOOD_SECONDARY} opacity="0.2" />
          </g>
        )

      case 'assassin':
        return (
          <g>
            {/* Hood - sharp & angular */}
            <path d="M50 14 L38 32 L40 36 L50 30 L60 36 L62 32 Z" fill={`url(#${gradId})`} opacity="0.95" />
            {/* Head */}
            <circle cx="50" cy="36" r="9" fill={`url(#${gradId})`} />
            {/* Mask/shadow over face */}
            <path d="M43 34 Q50 32 57 34 L56 38 Q50 40 44 38 Z" fill="#1a0505" opacity="0.4" />
            {/* Body - asymmetric cloak */}
            <path d="M34 42 L66 42 L74 98 L26 98 Z" fill={`url(#${gradId})`} opacity="0.82" />
            {/* Dagger */}
            <line x1="70" y1="54" x2="78" y2="44" stroke={EVIL_SECONDARY} strokeWidth="1.5" opacity="0.7" strokeLinecap="round" />
            <path d="M78 44 L80 42 L79 46 Z" fill={EVIL_SECONDARY} opacity="0.6" />
            {/* Crossed belt */}
            <line x1="38" y1="50" x2="62" y2="70" stroke={EVIL_PRIMARY} strokeWidth="1" opacity="0.3" />
            <line x1="62" y1="50" x2="38" y2="70" stroke={EVIL_PRIMARY} strokeWidth="1" opacity="0.3" />
          </g>
        )

      case 'morgana':
        return (
          <g>
            {/* Crown/tiara */}
            <path d="M40 26 L44 20 L47 26 L50 18 L53 26 L56 20 L60 26" stroke={ACCENT_PURPLE} strokeWidth="1.5" fill="none" opacity="0.7" />
            {/* Head */}
            <circle cx="50" cy="34" r="10" fill={`url(#${gradId})`} />
            {/* Flowing hair hint */}
            <path d="M40 30 Q36 40 34 52" stroke={EVIL_SECONDARY} strokeWidth="1.5" fill="none" opacity="0.3" />
            <path d="M60 30 Q64 40 66 52" stroke={EVIL_SECONDARY} strokeWidth="1.5" fill="none" opacity="0.3" />
            {/* Dress/robe */}
            <path d="M36 44 Q50 40 64 44 L72 100 Q50 104 28 100 Z" fill={`url(#${gradId})`} opacity="0.8" />
            {/* Magic aura */}
            <ellipse cx="50" cy="60" rx="14" ry="6" fill={ACCENT_PURPLE} opacity="0.12" />
            {/* Orbs */}
            <circle cx="36" cy="62" r="2.5" fill={ACCENT_PURPLE} opacity="0.35" />
            <circle cx="64" cy="62" r="2.5" fill={ACCENT_PURPLE} opacity="0.35" />
          </g>
        )

      case 'mordred':
        return (
          <g>
            {/* Dark crown */}
            <path d="M38 24 L42 16 L46 24 L50 12 L54 24 L58 16 L62 24" fill={`url(#${gradId})`} opacity="0.9" />
            {/* Head */}
            <circle cx="50" cy="34" r="10" fill={`url(#${gradId})`} />
            {/* Dark visor */}
            <ellipse cx="50" cy="34" rx="7" ry="5" fill="#1a0505" opacity="0.5" />
            {/* Heavy armor/robe */}
            <path d="M32 44 L68 44 L74 100 L26 100 Z" fill={`url(#${gradId})`} opacity="0.85" />
            {/* Shoulder spikes */}
            <path d="M32 44 L24 36 L34 48 Z" fill={primary} opacity="0.6" />
            <path d="M68 44 L76 36 L66 48 Z" fill={primary} opacity="0.6" />
            {/* Dark emblem */}
            <circle cx="50" cy="64" r="5" fill="#1a0505" opacity="0.3" />
            <circle cx="50" cy="64" r="2.5" fill={EVIL_PRIMARY} opacity="0.3" />
          </g>
        )

      case 'oberon':
        return (
          <g>
            {/* Mysterious shroud */}
            <path d="M50 16 Q34 22 30 40 L28 92 Q50 100 72 92 L70 40 Q66 22 50 16" fill={`url(#${gradId})`} opacity="0.75" />
            {/* Shadow face */}
            <ellipse cx="50" cy="36" rx="10" ry="11" fill="#1a0505" opacity="0.45" />
            {/* Eyes */}
            <ellipse cx="46" cy="35" rx="1.5" ry="1" fill={EVIL_PRIMARY} opacity="0.7" />
            <ellipse cx="54" cy="35" rx="1.5" ry="1" fill={EVIL_PRIMARY} opacity="0.7" />
            {/* Tattered edges */}
            <path d="M28 92 L26 96 L30 94 L28 100 L34 96 L32 102" stroke={primary} strokeWidth="0.8" fill="none" opacity="0.4" />
            <path d="M72 92 L74 96 L70 94 L72 100 L66 96 L68 102" stroke={primary} strokeWidth="0.8" fill="none" opacity="0.4" />
          </g>
        )

      case 'minion':
        return (
          <g>
            {/* Simple hood */}
            <path d="M38 30 Q50 20 62 30 L64 40 Q50 44 36 40 Z" fill={`url(#${gradId})`} opacity="0.8" />
            {/* Head */}
            <circle cx="50" cy="38" r="9" fill={`url(#${gradId})`} />
            {/* Plain cloak */}
            <path d="M36 46 Q50 42 64 46 L68 98 Q50 100 32 98 Z" fill={`url(#${gradId})`} opacity="0.7" />
            {/* Evil mark */}
            <circle cx="50" cy="64" r="3" fill="#1a0505" opacity="0.25" />
          </g>
        )

      default:
        return null
    }
  }

  return (
    <svg
      viewBox="0 0 100 110"
      width={size}
      height={size * 1.1}
      className={className}
      aria-hidden
    >
      <defs>
        {gradientDef}
        {glowDef}
        <mask id={maskId}>
          <rect width="100" height="110" fill="white" />
        </mask>
      </defs>
      <g filter={`url(#${glowId})`} mask={`url(#${maskId})`}>
        {renderIcon()}
      </g>
    </svg>
  )
}

export function roleToSilhouetteVariant(role: string): Variant {
  const r = role.toUpperCase()
  const map: Record<string, Variant> = {
    MERLIN: 'merlin',
    PERCIVAL: 'percival',
    SERVANT: 'servant',
    ASSASSIN: 'assassin',
    MORGANA: 'morgana',
    MINION: 'minion',
    MORDRED: 'mordred',
    OBERON: 'oberon',
  }
  return map[r] ?? (['ASSASSIN', 'MORGANA', 'MINION', 'MORDRED', 'OBERON'].includes(r) ? 'evil' : 'good')
}
