import { useId, type ReactNode } from 'react'

/** Matches avalon_visual_prompts.md: #3B82F6 good, #EF4444 evil */
const GOOD = '#3B82F6'
const EVIL = '#EF4444'

type Variant = 'good' | 'evil' | 'merlin' | 'percival' | 'assassin' | 'morgana' | 'servant' | 'minion' | 'mordred' | 'oberon'

function isEvilVariant(v: Variant): boolean {
  return ['evil', 'assassin', 'morgana', 'minion', 'mordred', 'oberon'].includes(v)
}

type FantasySilhouetteProps = {
  variant: Variant
  className?: string
  /** Card / icon size */
  size?: number
}

/**
 * Minimal fantasy silhouette + soft glow (vector, no raster).
 * Style: Modern Minimal Fantasy UI — dark-friendly, mobile-safe.
 */
export function FantasySilhouette({ variant, className = '', size = 120 }: FantasySilhouetteProps) {
  const uid = useId().replace(/:/g, '')
  const evil = isEvilVariant(variant)
  const fill = evil ? EVIL : GOOD
  const filterId = evil ? `glow-red-${uid}` : `glow-blue-${uid}`

  const head = <ellipse cx="50" cy="26" rx="11" ry="13" fill={fill} opacity={0.95} />

  let body: ReactNode
  switch (variant) {
    case 'merlin':
      body = (
        <>
          <path d="M 50 12 L 58 24 L 50 22 L 42 24 Z" fill={fill} opacity={0.9} />
          {head}
          <path
            d="M 32 40 Q 50 36 68 40 L 78 112 L 22 112 Z"
            fill={fill}
            opacity={0.85}
          />
          <circle cx="50" cy="68" r="4" fill="#93C5FD" opacity={0.6} />
        </>
      )
      break
    case 'percival':
    case 'servant':
      body = (
        <>
          {head}
          <path d="M 38 38 L 62 38 L 68 110 L 32 110 Z" fill={fill} opacity={0.88} />
          <path d="M 35 42 L 30 55 L 38 52 Z" fill={fill} opacity={0.7} />
          <path d="M 65 42 L 70 55 L 62 52 Z" fill={fill} opacity={0.7} />
        </>
      )
      break
    case 'assassin':
      body = (
        <>
          <path d="M 50 18 L 34 38 L 38 42 L 50 32 L 62 42 L 66 38 Z" fill={fill} opacity={0.95} />
          {head}
          <path d="M 36 44 L 64 44 L 72 114 L 28 114 Z" fill={fill} opacity={0.82} />
          <path d="M 18 70 L 36 78 L 34 82 Z" fill={fill} opacity={0.75} />
        </>
      )
      break
    case 'morgana':
      body = (
        <>
          {head}
          <path d="M 50 38 L 70 48 L 65 115 L 35 115 L 30 48 Z" fill={fill} opacity={0.85} />
          <ellipse cx="50" cy="52" rx="18" ry="6" fill="#A855F7" opacity={0.35} />
        </>
      )
      break
    case 'evil':
    case 'mordred':
    case 'minion':
    case 'oberon':
      body = (
        <>
          <path d="M 50 16 Q 32 28 30 46 L 34 112 L 66 112 L 70 46 Q 68 28 50 16" fill={fill} opacity={0.9} />
          <ellipse cx="50" cy="38" rx="8" ry="9" fill="#1a0a0a" opacity={0.5} />
        </>
      )
      break
    default:
      body = (
        <>
          {head}
          <path d="M 34 38 Q 50 34 66 38 L 76 112 L 24 112 Z" fill={fill} opacity={0.88} />
        </>
      )
  }

  return (
    <svg
      viewBox="0 0 100 120"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <defs>
        <filter id={`glow-blue-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`glow-red-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>{body}</g>
    </svg>
  )
}

/** Map game engine role string to silhouette variant */
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
