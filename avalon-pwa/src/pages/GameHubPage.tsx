import { useEffect, useState } from 'react'
import {
  activeGameKey,
  GAME_LABELS,
  subscribeActiveGames,
  type ActiveGameEntry,
} from '../services/activeGames'

type GameHubPageProps = {
  notice?: string
  onClearNotice?: () => void
  continueLoadingKey?: string | null
  onContinueGame?: (entry: ActiveGameEntry) => void
  onEnterAvalon: () => void
  onEnterUndercover?: () => void
  onEnterLiarsDice?: () => void
  onEnterNinja?: () => void
}

export function GameHubPage({
  notice,
  onClearNotice,
  continueLoadingKey,
  onContinueGame,
  onEnterAvalon,
  onEnterUndercover,
  onEnterLiarsDice,
  onEnterNinja,
}: GameHubPageProps) {
  const [activeGames, setActiveGames] = useState<ActiveGameEntry[]>([])

  useEffect(() => {
    return subscribeActiveGames(setActiveGames)
  }, [])

  return (
    <div className="min-h-dvh flex flex-col items-center px-5 pt-8 pb-12 animate-page-enter">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-7">
          <p className="section-label mb-2">派对游戏大厅</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white/95">选择想玩的游戏</h1>
          <p className="mt-2 text-sm text-slate-400">和朋友一起开玩，马上开始下一局。</p>
        </div>

        {notice && (
          <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90 flex items-start justify-between gap-3">
            <p>{notice}</p>
            {onClearNotice && (
              <button
                type="button"
                onClick={onClearNotice}
                className="shrink-0 text-xs text-amber-200/80 underline-offset-2 hover:underline"
              >
                关闭
              </button>
            )}
          </div>
        )}

        {activeGames.length > 0 && (
          <section className="mb-6">
            <p className="section-label mb-3">进行中的对局</p>
            <ul className="space-y-2">
              {activeGames.map((entry) => {
                const key = activeGameKey(entry.game, entry.roomId)
                const loading = continueLoadingKey === key
                return (
                  <li key={key}>
                    <button
                      type="button"
                      disabled={loading || !onContinueGame}
                      onClick={() => onContinueGame?.(entry)}
                      className="w-full text-left rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3.5 transition-colors hover:bg-white/[0.07] active:scale-[0.99] disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white/95">
                            {GAME_LABELS[entry.game]}
                            <span className="ml-2 font-mono text-xs text-slate-400 tracking-wider">
                              {entry.roomId}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {entry.isHost ? '房主' : '玩家'} · 点此继续
                          </p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-emerald-500/15 border border-emerald-500/25 px-3 py-1.5 text-xs font-medium text-emerald-300">
                          {loading ? '恢复中…' : '继续'}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

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

          <button
            type="button"
            onClick={onEnterNinja}
            className="avalon-card border border-indigo-400/25 text-left p-5 transition-transform active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-label">阵营推理</p>
                <h2 className="text-xl font-semibold text-white mt-1">忍者之夜</h2>
                <p className="text-sm text-slate-300/80 mt-2 leading-relaxed">
                  鹤莲对决、暗杀与轮抽，比拼智谋与情报，最快累计 10 分荣誉者胜出。
                </p>
              </div>
              <span className="text-2xl" aria-hidden>
                🥷
              </span>
            </div>
            <div className="mt-4">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[0.6875rem] font-medium text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                在线
              </span>
            </div>
            <div className="mt-5 min-h-[44px] inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(99,102,241,0.85)]">
              进入忍者之夜
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
