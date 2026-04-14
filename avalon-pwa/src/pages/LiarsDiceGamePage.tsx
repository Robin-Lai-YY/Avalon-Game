import { useState } from 'react'
import { LiarsDiceRulesSheet } from '../components/LiarsDiceRulesSheet'
import { DiceCup } from '../components/liars-dice/DiceCup'

type LiarsDiceGamePageProps = {
  diceCount: number
  onDiceCountChange: (count: number) => void
  onBackToHub: () => void
}

const DICE_COUNT_OPTIONS = [3, 4, 5, 6, 7, 8]

export function LiarsDiceGamePage({
  diceCount,
  onDiceCountChange,
  onBackToHub,
}: LiarsDiceGamePageProps) {
  const [started, setStarted] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const clampedDiceCount = Math.min(8, Math.max(3, diceCount))

  function updateCount(nextCount: number) {
    onDiceCountChange(Math.min(8, Math.max(3, nextCount)))
  }

  if (!started) {
    return (
      <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-lg mx-auto animate-page-enter">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="min-h-[40px] rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2 text-xs font-medium text-slate-300/90 transition-colors active:bg-white/[0.08]"
          >
            ← 返回游戏大厅
          </button>
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 active:text-slate-200 transition-all duration-200"
          >
            规则
          </button>
        </div>

        <section className="avalon-card mt-6 border border-amber-400/15 p-5 sm:p-6">
          <p className="section-label text-amber-200/75">大话骰</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">先选骰子数量</h1>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div>
              <p className="section-label">当前数量</p>
              <p className="mt-1 text-3xl font-bold text-white">{clampedDiceCount} 颗</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateCount(clampedDiceCount - 1)}
                disabled={clampedDiceCount <= 3}
                className="min-h-[42px] min-w-[42px] rounded-xl border border-white/[0.08] bg-white/[0.05] text-lg text-slate-200 disabled:opacity-35"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => updateCount(clampedDiceCount + 1)}
                disabled={clampedDiceCount >= 8}
                className="min-h-[42px] min-w-[42px] rounded-xl border border-white/[0.08] bg-white/[0.05] text-lg text-slate-200 disabled:opacity-35"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {DICE_COUNT_OPTIONS.map((count) => {
              const active = count === clampedDiceCount
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => updateCount(count)}
                  className={`min-h-[48px] rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'border-amber-300/45 bg-amber-400/15 text-amber-100 shadow-[0_14px_32px_-24px_rgba(251,191,36,0.9)]'
                      : 'border-white/[0.08] bg-white/[0.04] text-slate-300 active:bg-white/[0.08]'
                  }`}
                >
                  {count} 颗
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-6 min-h-[52px] w-full rounded-[1rem] bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_20px_44px_-24px_rgba(251,191,36,0.95)] transition-transform active:scale-[0.99]"
          >
            进入摇骰
          </button>
        </section>

        <LiarsDiceRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-2xl mx-auto animate-page-enter">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStarted(false)}
          className="min-h-[44px] flex items-center gap-1 text-slate-400 font-medium text-sm transition-colors active:text-white"
        >
          返回配置
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 active:text-slate-200 transition-all duration-200"
          >
            规则
          </button>
          <button
            type="button"
            onClick={onBackToHub}
            className="min-h-[40px] rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2 text-xs font-medium text-slate-300/90 transition-colors active:bg-white/[0.08]"
          >
            回到大厅
          </button>
        </div>
      </div>

      <div className="mt-5">
        <DiceCup key={`dice-cup-${clampedDiceCount}`} diceCount={clampedDiceCount} />
      </div>

      <LiarsDiceRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}
