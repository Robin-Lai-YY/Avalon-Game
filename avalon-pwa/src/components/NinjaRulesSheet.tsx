import { createPortal } from 'react-dom'

type NinjaRulesSheetProps = {
  open: boolean
  onClose: () => void
}

export function NinjaRulesSheet({ open, onClose }: NinjaRulesSheetProps) {
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
            <h2 className="text-lg font-bold text-white">忍者之夜规则</h2>
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
              通过暗杀、欺诈与情报赢得荣誉标记，最先累计 10 分的玩家获胜（暗自计分，达成后翻开宣告）。
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">阵营</h3>
            <ul className="space-y-1.5 text-[0.8125rem] text-slate-300/90 leading-relaxed">
              <li>鹤之流派 vs 莲之流派：阶级数字越小越高（1 = 首领）。</li>
              <li>奇数人时加入 1 张浪人，浪人靠存活独立赢得标记。</li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">回合流程</h3>
            <ol className="space-y-2 text-[0.8125rem] text-slate-300/90 leading-relaxed list-decimal pl-4">
              <li>系统秘密发流派牌，所有人查看自己的身份。</li>
              <li>轮抽：发 3 张忍者牌，留 1 传 2；再从右邻收 2 张，留 1 弃 1，结束时手中 2 张。</li>
              <li>夜晚 6 阶段（按顺序自动推进）：情报员 → 灵媒 → 欺诈师 → 盲眼刺客 → 忍者 → 幕后黑手。</li>
              <li>每个阶段，持有该类牌的玩家选择"打出 / 弃权"；同阶段多张按牌面优先级数字结算。</li>
              <li>暗杀触发时进入反应窗口（8 秒）：被指定者可打出镜僧反弹，旁人可打出殉道者代死。</li>
              <li>夜晚结束后所有存活者翻开流派牌：存活阶级最高（1 优先）的流派获胜；完美平局时所有活人各得 1 标记。</li>
              <li>胜利方成员（无论生死）从牌堆抽 1 张荣誉标记；浪人活下来也独得 1 张。</li>
            </ol>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">卡组结构（共 33 张）</h3>
            <p className="text-[0.75rem] text-slate-400 mb-2">每位玩家每回合从 3 张里抽 2 张参战。</p>
            <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.06] text-[0.8125rem] text-slate-300/90">
              <div className="flex justify-between px-3 py-2"><span>情报员（Spy）</span><span className="text-slate-400">×4</span></div>
              <div className="flex justify-between px-3 py-2"><span>灵媒（Mystic）</span><span className="text-slate-400">×3</span></div>
              <div className="flex justify-between px-3 py-2"><span>把戏师（Trickster · 6 种各 1 张）</span><span className="text-slate-400">×6</span></div>
              <div className="flex justify-between px-3 py-2"><span>盲眼刺客（Blind Assassin）</span><span className="text-slate-400">×5</span></div>
              <div className="flex justify-between px-3 py-2"><span>忍者（Shinobi）</span><span className="text-slate-400">×5</span></div>
              <div className="flex justify-between px-3 py-2"><span>镜僧（Mirror Monk）</span><span className="text-slate-400">×4</span></div>
              <div className="flex justify-between px-3 py-2"><span>殉道者（Martyr）</span><span className="text-slate-400">×4</span></div>
              <div className="flex justify-between px-3 py-2"><span>幕后黑手（Mastermind）</span><span className="text-slate-400">×2</span></div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">阶段牌效果</h3>
            <ul className="space-y-2 text-[0.8125rem] text-slate-300/90 leading-relaxed">
              <li>
                <span className="text-sky-300 font-semibold">情报员 1–4</span>
                <span className="block text-slate-300/85">
                  指定一名玩家，秘密查看其流派牌。同阶段多张按数字 1→4 顺序结算。
                </span>
              </li>
              <li>
                <span className="text-violet-300 font-semibold">灵媒 1–3</span>
                <span className="block text-slate-300/85">
                  指定一名玩家，秘密查看其流派牌，并随机查看其手中 1 张忍者牌。
                </span>
              </li>
              <li>
                <span className="text-red-300 font-semibold">盲眼刺客 1–5</span>
                <span className="block text-slate-300/85">
                  指定一名玩家直接暗杀。8 秒反应窗口内，目标可打镜僧反弹击杀，或他人可打殉道者代死。
                </span>
              </li>
              <li>
                <span className="text-emerald-300 font-semibold">忍者 1–5</span>
                <span className="block text-slate-300/85">
                  指定一名玩家，秘密查看其流派牌后选择「暗杀」或「放过」；选择暗杀同样进入 8 秒反应窗口。
                </span>
              </li>
              <li>
                <span className="text-cyan-300 font-semibold">镜僧（反应牌）×4</span>
                <span className="block text-slate-300/85">
                  当你被指定为暗杀目标时打出：暗杀反弹至攻击者，你不会死亡。审判 无法被反弹。
                </span>
              </li>
              <li>
                <span className="text-pink-300 font-semibold">殉道者（反应牌）×4</span>
                <span className="block text-slate-300/85">
                  当其他玩家被暗杀时打出：你代替其死亡，原目标存活。审判 无法被代死。
                </span>
              </li>
              <li>
                <span className="text-indigo-300 font-semibold">幕后黑手 1–2</span>
                <span className="block text-slate-300/85">
                  夜晚结束时若你仍存活，公开此牌：本回合<strong className="text-amber-200">不再发放任何流派荣誉标记</strong>，仅你（与存活的浪人）各得 1 个标记。
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">把戏师 6 张</h3>
            <ul className="space-y-2 text-[0.8125rem] text-slate-300/90 leading-relaxed">
              <li>
                <span className="text-amber-300 font-semibold">盗墓者（优先级 1）</span>
                <span className="block text-slate-300/85">
                  系统从弃牌堆中随机翻开最多 2 张忍者牌给你看，挑 1 张加入手牌；可立即按其阶段打出，或保留至本回合后续阶段。
                </span>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">变形者（优先级 2）</span>
                <span className="block text-slate-300/85">
                  选择任意两名玩家（可含你自己），查看二人的流派牌后选择是否秘密交换。一旦交换，被涉及的两人之后不可再自由查看自己的流派牌。
                </span>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">灵商（优先级 3）</span>
                <span className="block text-slate-300/85">
                  查看一名玩家的 1 个荣誉标记或流派牌；之后可选交换：将你任一标记给该玩家，并取走其任一标记（已看到的或未看到的均可）。
                </span>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">盗贼（优先级 4）</span>
                <span className="block text-slate-300/85">
                  公开你自己的流派牌，从荣誉标记数<strong className="text-amber-200">严格大于</strong>你的玩家中选 1 人，随机偷其 1 个标记。若没有人比你多则该牌无效。
                </span>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">麻烦制造者（优先级 5）</span>
                <span className="block text-slate-300/85">
                  指定一名玩家，秘密查看其流派牌；之后选择是否当众揭示该流派牌。
                </span>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">审判（优先级 6）</span>
                <span className="block text-slate-300/85">
                  公开你自己的流派牌，然后击杀一名玩家。<strong className="text-amber-200">镜僧与殉道者无法响应</strong>，目标必定死亡。
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">注意</h3>
            <p className="text-[0.8125rem] text-slate-300/90 leading-relaxed">
              你可以在场上发言诈唬，但若选择不打出某阶段的牌，该牌即作废，本回合后续阶段不能再补打。死亡后无法再行动，但仍可继续发言。
            </p>
          </section>

          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </div>
      </div>
    </div>,
    document.body
  )
}
