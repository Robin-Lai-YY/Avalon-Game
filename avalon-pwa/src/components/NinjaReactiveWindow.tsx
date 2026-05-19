import { useEffect, useState } from 'react'
import type { ReactiveWindow } from '../types/ninja'

export function NinjaReactiveWindowView({
  window: w,
  myPlayerId,
  hasMonk,
  hasMartyr,
  attackerName,
  victimName,
  loading,
  onMonk,
  onMartyr,
  onPass,
  onExpire,
}: {
  window: ReactiveWindow
  myPlayerId: string
  hasMonk: boolean
  hasMartyr: boolean
  attackerName: string
  victimName: string
  loading: boolean
  onMonk: () => void
  onMartyr: () => void
  onPass: () => void
  onExpire: () => void
}) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (now > w.expiresAt) onExpire()
  }, [now, w.expiresAt, onExpire])

  const remainingMs = Math.max(0, w.expiresAt - now)
  const remainingSec = Math.ceil(remainingMs / 1000)

  const isMonkEligible = w.eligibleMonkIds?.includes(myPlayerId) && hasMonk
  const isMartyrEligible = w.eligibleMartyrIds?.includes(myPlayerId) && hasMartyr
  const myResponse = w.responses?.[myPlayerId]

  return (
    <div className="avalon-card p-4 border border-red-500/40 bg-red-950/30 animate-scale-bounce">
      <div className="flex items-baseline justify-between mb-1">
        <p className="section-label text-red-300">反应窗口</p>
        <p className="text-xs text-red-200 font-mono">{remainingSec}s</p>
      </div>
      <p className="text-sm text-red-100/95">
        <span className="font-semibold">{attackerName}</span> 即将暗杀 <span className="font-semibold">{victimName}</span>
      </p>

      {(isMonkEligible || isMartyrEligible) && !myResponse && (
        <div className="mt-3 flex flex-col gap-2">
          {isMonkEligible && (
            <button
              type="button"
              disabled={loading}
              onClick={onMonk}
              className="min-h-[44px] rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 font-semibold disabled:opacity-50"
            >
              打出镜僧（反弹）
            </button>
          )}
          {isMartyrEligible && (
            <button
              type="button"
              disabled={loading}
              onClick={onMartyr}
              className="min-h-[44px] rounded-xl bg-pink-500/20 border border-pink-400/40 text-pink-100 font-semibold disabled:opacity-50"
            >
              打出殉道者（替死）
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={onPass}
            className="min-h-[40px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm disabled:opacity-50"
          >
            放弃响应
          </button>
        </div>
      )}

      {myResponse && (
        <p className="text-xs text-red-200/80 mt-2">
          已选择：{myResponse === 'monk' ? '镜僧' : myResponse === 'martyr' ? '殉道者' : '放弃'}
        </p>
      )}
    </div>
  )
}
