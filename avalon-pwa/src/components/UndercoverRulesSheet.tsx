import { createPortal } from 'react-dom'

type UndercoverRulesSheetProps = {
  open: boolean
  onClose: () => void
}

export function UndercoverRulesSheet({ open, onClose }: UndercoverRulesSheetProps) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative w-full sm:max-w-lg bg-[#0c101e] border-t border-x border-white/[0.08] rounded-t-2xl flex flex-col animate-slide-up"
        style={{ height: 'calc(86dvh - env(safe-area-inset-top, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-white/[0.15]" />
        </div>

        <div className="shrink-0 px-5 pt-2 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">谁是卧底规则</h2>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-400 active:bg-white/[0.1] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 space-y-5">
          <section>
            <h3 className="text-sm font-semibold text-white mb-2">目标</h3>
            <p className="text-[0.8125rem] text-slate-300/90 leading-relaxed">
              找出并淘汰所有卧底。白板没有词语，需要通过场上信息判断并隐藏自己。
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">准备阶段 · 隐藏题库</h3>
            <p className="text-[0.8125rem] text-slate-300/90 leading-relaxed">
              每人可在大厅自行选择是否同意使用隐藏题库；界面不会展示其他人的选择。仅当所有人都同意时，本局从隐藏题库抽词，否则使用常规题库。
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">流程</h3>
            <ol className="space-y-2 text-[0.8125rem] text-slate-300/90 leading-relaxed list-decimal pl-4">
              <li>房主设置角色人数并开始游戏，系统发放词语。</li>
              <li>玩家线下发言（系统不记录发言内容）。</li>
              <li>进入投票阶段，每位存活玩家投 1 人，不能投自己。</li>
              <li>票数最高者淘汰，系统自动判定是否结束。</li>
            </ol>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">平票规则</h3>
            <p className="text-[0.8125rem] text-slate-300/90 leading-relaxed">
              平票玩家先补充发言，再在平票候选人中复投。若连续平票超过阈值，系统在平票候选中随机淘汰 1 人。
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">胜利条件</h3>
            <ul className="space-y-1.5 text-[0.8125rem] text-slate-300/90 leading-relaxed">
              <li>平民胜：场上卧底人数为 0。</li>
              <li>卧底胜：场上卧底人数大于等于平民人数。</li>
              <li>白板胜：场上只剩 1 人且该玩家是白板。</li>
            </ul>
          </section>

          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </div>
      </div>
    </div>,
    document.body
  )
}
