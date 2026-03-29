import { useState } from 'react'
import { FantasySilhouette } from './FantasySilhouette'

function artUrl(filename: string): string {
  const base = import.meta.env.BASE_URL
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}avalon-art/${filename}`
}

type HeroSideProps = {
  variant: 'good' | 'evil'
  size: number
  file: string
}

function HeroSide({ variant, size, file }: HeroSideProps) {
  const [useVector, setUseVector] = useState(false)
  const glow =
    variant === 'good'
      ? 'absolute inset-0 rounded-full bg-blue-500/20 blur-xl scale-150'
      : 'absolute inset-0 rounded-full bg-red-500/20 blur-xl scale-150'

  if (useVector) {
    return (
      <div className="relative opacity-90">
        <div className={glow} />
        <FantasySilhouette variant={variant} size={size} />
      </div>
    )
  }

  return (
    <div className="relative opacity-90">
      <div className={glow} />
      <img
        src={artUrl(file)}
        alt=""
        width={size}
        height={size}
        className={`object-contain ${
          variant === 'good'
            ? 'drop-shadow-[0_0_14px_rgba(59,130,246,0.45)]'
            : 'drop-shadow-[0_0_14px_rgba(239,68,68,0.45)]'
        }`}
        onError={() => setUseVector(true)}
      />
    </div>
  )
}

/** Home strip: tries `public/avalon-art/hero-good.png` & `hero-evil.png`, else SVG silhouettes. */
export function AvalonHeroArt({ className = '' }: { className?: string }) {
  const size = 88
  return (
    <div
      className={`flex items-end justify-center gap-6 sm:gap-10 py-2 ${className}`}
      aria-hidden
    >
      <HeroSide variant="good" size={size} file="hero-good.png" />
      <HeroSide variant="evil" size={size} file="hero-evil.png" />
    </div>
  )
}
