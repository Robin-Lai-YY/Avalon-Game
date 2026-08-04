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
}) {
  const isMyTurn = w.currentResponderId === myPlayerId
  const isMonkDecision = w.step === 'monk'
  const isMartyrDecision = w.step === 'martyr'
  const isMonkEligible = isMyTurn && isMonkDecision && w.eligibleMonkIds?.includes(myPlayerId) && hasMonk
  const isMartyrEligible = isMyTurn && isMartyrDecision && w.eligibleMartyrIds?.includes(myPlayerId) && hasMartyr
  const myResponse = w.responses?.[myPlayerId]

  return (
    <div className="fixed inset-x-3 bottom-4 z-40 mx-auto max-w-md rounded-3xl border border-red-400/50 bg-red-950/90 p-4 shadow-2xl shadow-red-950/50 backdrop-blur animate-scale-bounce">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="section-label text-red-200">反应决策</p>
          <p className="mt-1 text-sm text-red-100/95">
            <span className="font-semibold">{attackerName}</span> → <span className="font-semibold">{victimName}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-red-200/20 bg-red-500/15 px-3 py-2 text-right">
          <p className="text-[0.625rem] uppercase tracking-[0.18em] text-red-100/60">Step</p>
          <p className="text-sm font-black text-red-50">{isMonkDecision ? '还施僧' : '殉道者'}</p>
        </div>
      </div>

      {!isMyTurn && (
        <p className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
          等待响应玩家决定是否打出{isMonkDecision ? '还施僧' : '殉道者'}。
        </p>
      )}

      {isMyTurn && (isMonkEligible || isMartyrEligible) && !myResponse && (
        <div className="mt-3 flex flex-col gap-2">
          {isMonkEligible && (
            <button
              type="button"
              disabled={loading}
              onClick={onMonk}
              className="min-h-[44px] rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 font-semibold disabled:opacity-50"
            >
              打出还施僧（反弹）
            </button>
          )}
          {isMartyrEligible && (
            <button
              type="button"
              disabled={loading}
              onClick={onMartyr}
              className="min-h-[44px] rounded-xl bg-pink-500/20 border border-pink-400/40 text-pink-100 font-semibold disabled:opacity-50"
            >
              打出殉道者（保命 + 荣誉标记）
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={onPass}
            className="min-h-[40px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm disabled:opacity-50"
          >
            不打出
          </button>
        </div>
      )}

      {isMyTurn && !isMonkEligible && !isMartyrEligible && (
        <p className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
          当前没有可打出的反应牌。
        </p>
      )}

      {myResponse && (
        <p className="text-xs text-red-200/80 mt-2">
          已选择：{myResponse === 'monk' ? '还施僧' : myResponse === 'martyr' ? '殉道者（护己）' : '放弃'}
        </p>
      )}
    </div>
  )
}
