import type { CSSProperties } from 'react'
import type { DieModel, DieValue } from './types'

type DieFaceProps = {
  die: DieModel
  index: number
  isShaking: boolean
  isRevealed: boolean
}

const FACE_PIPS: Record<DieValue, string[]> = {
  1: ['center'],
  2: ['top-left', 'bottom-right'],
  3: ['top-left', 'center', 'bottom-right'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
}

const SLOT_ORDER = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

export function DieFace({ die, index, isShaking, isRevealed }: DieFaceProps) {
  const activePips = new Set(FACE_PIPS[die.value])
  const style = {
    '--die-left': `${die.layoutX}%`,
    '--die-top': `${die.layoutY}%`,
    '--die-scale': `${die.scale}`,
    zIndex: die.layer,
    '--die-rotation': `${die.rotation}deg`,
    '--die-tilt-x': `${die.tiltX}deg`,
    '--die-tilt-y': `${die.tiltY}deg`,
    '--die-offset-x': `${die.offsetX}px`,
    '--die-offset-y': `${die.offsetY}px`,
    '--die-rattle-x': `${die.rattleX}px`,
    '--die-rattle-y': `${die.rattleY}px`,
    animationDelay: `${index * 60}ms`,
  } as CSSProperties

  return (
    <div
      className={[
        'liars-die',
        isShaking ? 'dice-rattle' : '',
        isRevealed ? 'die-roll-in' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-label={`骰子点数 ${die.value}`}
    >
      <div className="liars-die__shadow" aria-hidden />
      <div className="liars-die__body" aria-hidden>
        {SLOT_ORDER.map((slot) => (
          <span
            key={slot}
            className={`die-pip die-pip--${slot} ${activePips.has(slot) ? 'die-pip--active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
