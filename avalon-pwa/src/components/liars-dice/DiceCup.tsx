import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { DieFace } from './DieFace'
import { useShakeDetection } from './useShakeDetection'
import type { DiceCupStatus, DieModel, DieValue } from './types'

type DiceCupProps = {
  diceCount?: number
}

const DEFAULT_SHAKE_DURATION_MS = 1250
const CUP_OPEN_DISTANCE = 168
const SWIPE_TRIGGER_DISTANCE = 72
const SWIPE_TRIGGER_VELOCITY = 0.42

function shakeSoundUrl() {
  const base = import.meta.env.BASE_URL
  return `${base.endsWith('/') ? base : `${base}/`}sounds/dice-shake.wav`
}

function stopShakeSound(audio: HTMLAudioElement | null) {
  if (!audio) return
  audio.pause()
  audio.currentTime = 0
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function rollDieValue(): DieValue {
  return (Math.floor(Math.random() * 6) + 1) as DieValue
}

function createScatterSlots() {
  return [
    { layoutX: 50, layoutY: 50 },
    { layoutX: 50, layoutY: 24 },
    { layoutX: 68, layoutY: 31 },
    { layoutX: 74, layoutY: 50 },
    { layoutX: 67, layoutY: 69 },
    { layoutX: 50, layoutY: 76 },
    { layoutX: 33, layoutY: 68 },
    { layoutX: 26, layoutY: 49 },
    { layoutX: 32, layoutY: 31 },
  ]
}

function shuffleSlots(slots: Array<{ layoutX: number; layoutY: number }>) {
  const next = [...slots]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[target]] = [next[target], next[index]]
  }
  return next
}

function createScatterLayout(
  index: number,
  scatterSlots: Array<{ layoutX: number; layoutY: number }>
) {
  const slot = scatterSlots[index] ?? scatterSlots[scatterSlots.length - 1]

  return {
    layoutX: slot.layoutX + randomBetween(-2.1, 2.1),
    layoutY: slot.layoutY + randomBetween(-2.1, 2.1),
  }
}

function createDieModel(
  index: number,
  scatterSlots: Array<{ layoutX: number; layoutY: number }>
): DieModel {
  const scatter = createScatterLayout(index, scatterSlots)
  const isCenterSlot = Math.abs(scatter.layoutX - 50) < 5 && Math.abs(scatter.layoutY - 50) < 5

  return {
    id: `die-${index}`,
    value: rollDieValue(),
    rotation: randomBetween(-14, 14),
    tiltX: randomBetween(4, 12),
    tiltY: randomBetween(-10, 10),
    layoutX: scatter.layoutX,
    layoutY: scatter.layoutY,
    scale: isCenterSlot ? randomBetween(0.88, 0.95) : randomBetween(0.92, 1.02),
    layer: 10 + index,
    offsetX: randomBetween(-8, 8),
    offsetY: randomBetween(-8, 8),
    rattleX: randomBetween(-14, 14),
    rattleY: randomBetween(-12, 12),
  }
}

function createDiceSet(diceCount: number) {
  const scatterSlots = shuffleSlots(createScatterSlots()).slice(0, diceCount)
  return Array.from({ length: diceCount }, (_, index) => createDieModel(index, scatterSlots))
}

function statusCopy(status: DiceCupStatus) {
  if (status === 'SHAKING') return '摇骰中...'
  if (status === 'CLOSED') return '上滑开盅'
  if (status === 'OPEN') return '下滑盖盅'
  return '点击开始摇骰'
}

export function DiceCup({ diceCount = 5 }: DiceCupProps) {
  const [status, setStatus] = useState<DiceCupStatus>('IDLE')
  const [dice, setDice] = useState<DieModel[]>(() => createDiceSet(diceCount))
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const shakeTimerRef = useRef<number | null>(null)
  const shakeAudioRef = useRef<HTMLAudioElement | null>(null)
  const pointerStateRef = useRef<{
    pointerId: number
    startY: number
    latestY: number
    startTime: number
  } | null>(null)

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) {
        window.clearTimeout(shakeTimerRef.current)
      }
      stopShakeSound(shakeAudioRef.current)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)

    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  const shakeDurationMs = prefersReducedMotion ? 220 : DEFAULT_SHAKE_DURATION_MS

  const baseLift = status === 'OPEN' ? -CUP_OPEN_DISTANCE : 0
  const computedLift =
    status === 'SHAKING'
      ? 0
      : Math.min(CUP_OPEN_DISTANCE, Math.max(-CUP_OPEN_DISTANCE, baseLift + dragOffset))
  const openness = Math.min(Math.abs(computedLift) / CUP_OPEN_DISTANCE, 1)
  const shellOpacity = status === 'SHAKING' ? 1 : 1 - openness * 0.78
  const shellStyle = {
    transform: `translate3d(0, ${computedLift}px, 0)`,
    opacity: shellOpacity,
    transitionDuration: isDragging ? '0ms' : undefined,
  }

  const shakeDice = useCallback((source: 'button' | 'motion' = 'button') => {
    if (status === 'SHAKING') return
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current)
    }
    stopShakeSound(shakeAudioRef.current)
    setDice(createDiceSet(diceCount))
    setDragOffset(0)
    setIsDragging(false)
    pointerStateRef.current = null
    setStatus('SHAKING')
    if (navigator.vibrate) {
      navigator.vibrate(source === 'motion' ? [24, 36, 24] : 24)
    }
    if (typeof window !== 'undefined') {
      if (!shakeAudioRef.current) {
        const audio = new Audio(shakeSoundUrl())
        audio.loop = true
        audio.preload = 'auto'
        shakeAudioRef.current = audio
      }
      const audio = shakeAudioRef.current
      audio.currentTime = 0
      void audio.play().catch(() => {
        // Autoplay policy or missing file: ignore
      })
    }
    shakeTimerRef.current = window.setTimeout(() => {
      stopShakeSound(shakeAudioRef.current)
      setStatus('CLOSED')
      shakeTimerRef.current = null
    }, shakeDurationMs)
  }, [diceCount, shakeDurationMs, status])

  const { supported, permissionState, canRequestPermission, requestPermission } = useShakeDetection({
    enabled: status !== 'SHAKING',
    onShake: () => shakeDice('motion'),
  })

  function openCup() {
    if (status !== 'CLOSED') return
    setDragOffset(0)
    setStatus('OPEN')
  }

  function closeCup() {
    if (status !== 'OPEN') return
    setDragOffset(0)
    setStatus('CLOSED')
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (status !== 'CLOSED' && status !== 'OPEN') return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      latestY: event.clientY,
      startTime: performance.now(),
    }
    setIsDragging(true)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerStateRef.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    pointer.latestY = event.clientY
    const deltaY = event.clientY - pointer.startY

    if (status === 'CLOSED') {
      const nextOffset = deltaY < 0 ? Math.max(deltaY * 0.72, -CUP_OPEN_DISTANCE) : 0
      setDragOffset(nextOffset)
      return
    }

    if (status === 'OPEN') {
      const nextOffset = deltaY > 0 ? Math.min(deltaY * 0.72, CUP_OPEN_DISTANCE) : 0
      setDragOffset(nextOffset)
    }
  }

  function finishPointerInteraction(event?: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerStateRef.current
    if (!pointer) return

    if (event && event.currentTarget.hasPointerCapture(pointer.pointerId)) {
      event.currentTarget.releasePointerCapture(pointer.pointerId)
    }

    const deltaY = pointer.latestY - pointer.startY
    const elapsed = Math.max(performance.now() - pointer.startTime, 1)
    const velocity = deltaY / elapsed

    if (status === 'CLOSED') {
      if (deltaY <= -SWIPE_TRIGGER_DISTANCE || velocity <= -SWIPE_TRIGGER_VELOCITY) {
        setStatus('OPEN')
      }
    } else if (status === 'OPEN') {
      if (deltaY >= SWIPE_TRIGGER_DISTANCE || velocity >= SWIPE_TRIGGER_VELOCITY) {
        setStatus('CLOSED')
      }
    }

    pointerStateRef.current = null
    setDragOffset(0)
    setIsDragging(false)
  }

  return (
    <section className="avalon-card border border-amber-400/15 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">骰盅</h2>
          <p className="mt-1 text-sm text-slate-300/80">{statusCopy(status)}</p>
        </div>
        <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300">
          {diceCount} 颗
        </div>
      </div>

      <div className="liars-dice-stage mt-5">
        <div
          className={`liars-dice-stage__gesture-layer ${isDragging ? 'liars-dice-stage__gesture-layer--dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerInteraction}
          onPointerCancel={finishPointerInteraction}
        />

        <div className={`liars-dice-tray ${status === 'OPEN' ? 'liars-dice-tray--open liars-dice-tray--visible' : ''}`}>
          {dice.map((die, index) => (
            <DieFace
              key={`${die.id}-${die.value}`}
              die={die}
              index={index}
              isShaking={status === 'SHAKING'}
              isRevealed={status === 'OPEN'}
            />
          ))}
        </div>

        <div
          className={[
            'dice-cup-shell',
            status === 'SHAKING' ? 'cup-shake' : '',
            status === 'OPEN' ? 'cup-open' : 'cup-close',
            isDragging ? 'dice-cup-shell--dragging' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={shellStyle}
          aria-hidden
        >
          <div className="dice-cup-body">
            <div className="dice-cup-rim" />
            <div className="dice-cup-sideband" />
            <div className="dice-cup-highlight" />
            <div className="dice-cup-emblem">{status === 'OPEN' ? 'SHOW' : 'LIAR'}</div>
          </div>
        </div>

        <div className="dice-cup-swipe-hint" aria-hidden>
          <span className="dice-cup-swipe-hint__bar" />
          <span className="dice-cup-swipe-hint__label">
            {status === 'OPEN'
              ? '向下滑动，盖回骰盅'
              : status === 'CLOSED'
                ? '向上滑动，打开骰盅'
                : '先摇骰，再滑动开盅'}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
        <button
          type="button"
          onClick={() => shakeDice('button')}
          disabled={status === 'SHAKING'}
          className="min-h-[50px] rounded-[1rem] bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_20px_44px_-24px_rgba(251,191,36,0.95)] transition-transform disabled:opacity-60 active:scale-[0.99]"
        >
          {status === 'SHAKING' ? '摇骰中…' : '摇一摇'}
        </button>

        <button
          type="button"
          onClick={openCup}
          disabled={status !== 'CLOSED'}
          className="min-h-[50px] rounded-[1rem] border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-sm font-semibold text-slate-200 transition-colors disabled:opacity-35 active:bg-white/[0.08]"
        >
          打开骰盅
        </button>

        <button
          type="button"
          onClick={closeCup}
          disabled={status !== 'OPEN'}
          className="min-h-[50px] rounded-[1rem] border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-sm font-semibold text-slate-200 transition-colors disabled:opacity-35 active:bg-white/[0.08]"
        >
          盖回骰盅
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canRequestPermission && (
          <button
            type="button"
            onClick={() => void requestPermission()}
            className="min-h-[40px] rounded-xl border border-amber-300/25 bg-amber-400/10 px-3.5 py-2 text-xs font-semibold text-amber-100 transition-colors active:bg-amber-400/15"
          >
            启用手机摇一摇
          </button>
        )}
        {permissionState === 'granted' && (
          <div className="text-xs text-emerald-200/80">已启用摇一摇</div>
        )}
        {permissionState === 'denied' && (
          <div className="text-xs text-amber-100/80">未开启传感器权限</div>
        )}
        {!supported && (
          <div className="text-xs text-slate-400">当前设备不支持摇一摇</div>
        )}
      </div>
    </section>
  )
}
