type GameHubPageProps = {
  onEnterAvalon: () => void
  onEnterUndercover?: () => void
  onEnterLiarsDice?: () => void
}

export function GameHubPage({
  onEnterAvalon,
  onEnterUndercover,
  onEnterLiarsDice,
}: GameHubPageProps) {
  return (
    <div className="min-h-dvh flex flex-col items-center px-5 pt-8 pb-12 animate-page-enter">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-7">
          <p className="section-label mb-2">派对游戏大厅</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white/95">选择想玩的游戏</h1>
          <p className="mt-2 text-sm text-slate-400">和朋友一起开玩，马上开始下一局。</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-children">
          <button
            type="button"
            onClick={onEnterAvalon}
            className="avalon-card avalon-card-glow-good text-left p-5 transition-transform active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-label">派对推理</p>
                <h2 className="text-xl font-semibold text-white mt-1">阿瓦隆</h2>
                <p className="text-sm text-slate-300/80 mt-2 leading-relaxed">
                  组队、投票、任务与刺杀，体验完整阵营对抗。
                </p>
              </div>
              <span className="text-2xl" aria-hidden>
                🛡️
              </span>
            </div>
            <div className="mt-4">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[0.6875rem] font-medium text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                在线
              </span>
            </div>
            <div className="mt-5 min-h-[44px] inline-flex items-center justify-center rounded-xl btn-primary px-4 py-2.5 text-sm font-semibold">
              进入阿瓦隆
            </div>
          </button>

          <button
            type="button"
            onClick={onEnterUndercover}
            className="avalon-card avalon-card-glow-evil text-left p-5 transition-transform active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-label">轻量派对</p>
                <h2 className="text-xl font-semibold text-white mt-1">谁是卧底</h2>
                <p className="text-sm text-slate-300/80 mt-2 leading-relaxed">
                  发言在线下进行，系统负责发词、投票和淘汰结算。
                </p>
              </div>
              <span className="text-2xl" aria-hidden>
                🕵️
              </span>
            </div>
            <div className="mt-4">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[0.6875rem] font-medium text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                在线
              </span>
            </div>
            <div className="mt-5 min-h-[44px] inline-flex items-center justify-center rounded-xl btn-evil px-4 py-2.5 text-sm font-semibold text-white">
              进入谁是卧底
            </div>
          </button>

          <button
            type="button"
            onClick={onEnterLiarsDice}
            className="avalon-card border border-amber-400/20 text-left p-5 transition-transform active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-label">酒桌聚会</p>
                <h2 className="text-xl font-semibold text-white mt-1">大话骰</h2>
                <p className="text-sm text-slate-300/80 mt-2 leading-relaxed">
                  摇骰、开盅、看点数。支持手势与摇一摇，朋友围坐随时开局。
                </p>
              </div>
              <span className="text-2xl" aria-hidden>
                🎲
              </span>
            </div>
            <div className="mt-4">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[0.6875rem] font-medium text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                在线
              </span>
            </div>
            <div className="mt-5 min-h-[44px] inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_10px_24px_-12px_rgba(251,191,36,0.85)]">
              进入大话骰
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
