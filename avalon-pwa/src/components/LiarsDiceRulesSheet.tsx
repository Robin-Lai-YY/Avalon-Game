import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

type LiarsDiceRulesSheetProps = {
  open: boolean
  onClose: () => void
}

function TermBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
      <div className="text-[0.8125rem] text-slate-300/90 leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

export function LiarsDiceRulesSheet({ open, onClose }: LiarsDiceRulesSheetProps) {
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
            <h2 className="text-lg font-bold text-white">大话骰规则</h2>
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
            <h3 className="text-sm font-semibold text-white mb-2">怎么玩</h3>
            <p className="text-[0.8125rem] text-slate-300/90 leading-relaxed">
              每人若干颗骰放在盅里摇匀后私下看自己的点数。大家轮流向<strong className="text-slate-200 font-medium">全场</strong>
              叫一个「总共有几颗某点数」（是否把 1 当万能由是否叫斋决定）。若有人不信，可开盅数全场该点数的颗数，不够则叫骰方输，够则质疑方输。罚喝几杯、是否允许劈与跳劈等，由你们桌规约定。本工具只负责摇骰与开盅看点数。
            </p>
          </section>

          <TermBlock title="叫骰">
            <p>
              类似扑克里的「出牌」：必须在上家所叫的<strong className="text-slate-200 font-medium">个数</strong>或
              <strong className="text-slate-200 font-medium">点数</strong>上往上加（常见规则是加个数或抬高点数，以你们约定为准）。
            </p>
            <p className="text-slate-400/90">标准叫法示例：「3 个 2」「3 个 6」。</p>
          </TermBlock>

          <TermBlock title="叫斋">
            <p>
              通常「1」可以当作任意点数参与计数；一旦叫了<strong className="text-slate-200 font-medium">斋</strong>，「1」就只算
              1，不再当万能。
            </p>
            <p className="text-slate-400/90">标准叫法示例：「2 个 3 斋」「3 个 6 斋」。</p>
          </TermBlock>

          <TermBlock title="飞斋">
            <p>
              场上已处于「斋」时，可用「飞」破斋：一般要求所叫个数至少为上家的<strong className="text-slate-200 font-medium">双倍或以上</strong>
              （各地倍数略有出入，开局前对齐即可）。
            </p>
            <p className="text-slate-400/90">示例：上家叫「2 个 1 斋」，下家可叫「4 个 2 飞」，去掉斋的限制。</p>
          </TermBlock>

          <TermBlock title="开骰">
            <p>
              当你认为上家叫的个数<strong className="text-slate-200 font-medium">超过了全场实际拥有的该点数颗数</strong>
              时，可以要求开盅。清点后的输赢与是否算万能、斋等，按你们事先约定的规则执行。
            </p>
          </TermBlock>

          <TermBlock title="反弹">
            <p>
              在上家所叫的个数基础上<strong className="text-slate-200 font-medium">加 2</strong>，并改变之后的叫骰顺序（常见为反转轮流方向，以桌规为准）。
            </p>
            <p>
              许多局里反弹会<strong className="text-slate-200 font-medium">加码</strong>：反弹 1 次则输方在原罚码上加 1 码起步；反弹 2 次加 2 码起步，以此类推。
            </p>
          </TermBlock>

          <TermBlock title="劈">
            <p>
              不按正常顺序，直接指定一名玩家与自己对决（常见为立即开盅比该轮叫法）。若劈的一方判断错误而输，输方惩罚通常按桌规<strong className="text-slate-200 font-medium">加倍</strong>。
            </p>
          </TermBlock>

          <TermBlock title="反劈">
            <p>
              被劈时可以选择「反劈」，把赌注再抬高一档；若最终仍输，惩罚常在「劈」的基础上<strong className="text-slate-200 font-medium">再翻倍</strong>（具体倍数依本地习惯）。
            </p>
          </TermBlock>

          <TermBlock title="跳劈">
            <p>
              轮到某人叫骰时，由其他人<strong className="text-slate-200 font-medium">抢先</strong>越过顺序直接劈指定玩家，节奏更快。是否允许跳劈、是否要在「劈」的罚码上再加码，建议开局前统一说法。
            </p>
          </TermBlock>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">说明</h3>
            <p className="text-[0.8125rem] text-slate-400/90 leading-relaxed">
              各地酒吧、朋友局细则不同（例如 1 是否万能、飞要几倍个数）。本文只梳理常见术语含义；实际以你们当场约定为准。
            </p>
          </section>

          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </div>
      </div>
    </div>,
    document.body
  )
}
