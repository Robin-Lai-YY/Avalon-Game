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
              通过密探、骗术与暗杀赢得荣誉标记，最先累计 10 分的玩家获胜（暗自计分，达成后翻开宣告）。
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
              <li>夜晚 5 阶段：密探 → 隐士 → 骗徒 → 盲眼刺客 → 上忍。首脑在夜末自动公开（不出牌阶段）。</li>
              <li>每个阶段全员确认：持有该类牌的人选「打出 / 本阶段不出」；没有该类牌的人点「没有此牌，点击继续」。锁定后公布打出的牌，再按优先级结算。</li>
              <li>出牌与指定目标对全员可见；看到的流派/手牌内容仅行动者可见（可真可假地口头宣布）。密探/隐士查看后需点「我看完了」才会继续结算；上忍先确认看完流派，再选暗杀或放过。</li>
              <li>暗杀触发时：仅受害者可打出还施僧（反弹）或殉道者（保命并获得荣誉标记）。审判无法被响应。</li>
              <li>夜晚结束后存活者翻开流派：最高阶级存活方获胜；完美平局时所有活人各得 1 标记。</li>
              <li>胜利方成员（无论生死）抽 1 荣誉标记；浪人若存活额外 1 张。</li>
            </ol>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">卡组结构（共 33 张）</h3>
            <p className="text-[0.75rem] text-slate-400 mb-2">每位玩家每回合从 3 张里抽 2 张参战。</p>
            <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.06] text-[0.8125rem] text-slate-300/90">
              <div className="flex justify-between px-3 py-2"><span>密探（Spy）</span><span className="text-slate-400">×6</span></div>
              <div className="flex justify-between px-3 py-2"><span>隐士（Mystic）</span><span className="text-slate-400">×6</span></div>
              <div className="flex justify-between px-3 py-2"><span>骗徒（Trickster · 6 种各 1 张）</span><span className="text-slate-400">×6</span></div>
              <div className="flex justify-between px-3 py-2"><span>盲眼刺客（Blind Assassin）</span><span className="text-slate-400">×6</span></div>
              <div className="flex justify-between px-3 py-2"><span>上忍（Shinobi）</span><span className="text-slate-400">×6</span></div>
              <div className="flex justify-between px-3 py-2"><span>还施僧（Mirror Monk）</span><span className="text-slate-400">×1</span></div>
              <div className="flex justify-between px-3 py-2"><span>殉道者（Martyr）</span><span className="text-slate-400">×1</span></div>
              <div className="flex justify-between px-3 py-2"><span>首脑（Mastermind）</span><span className="text-slate-400">×1</span></div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">阶段牌效果</h3>
            <ul className="space-y-2 text-[0.8125rem] text-slate-300/90 leading-relaxed">
              <li>
                <span className="text-sky-300 font-semibold">密探 1–6</span>
                <span className="block text-slate-300/85">
                  指定一名玩家，秘密查看其流派牌。同阶段按数字 1→6 结算。
                </span>
              </li>
              <li>
                <span className="text-violet-300 font-semibold">隐士 1–6</span>
                <span className="block text-slate-300/85">
                  指定一名玩家，秘密查看其流派牌，并随机查看其手中 1 张忍者牌（若已空手牌则仅看流派）。
                </span>
              </li>
              <li>
                <span className="text-red-300 font-semibold">盲眼刺客 1–6</span>
                <span className="block text-slate-300/85">
                  指定一名其他玩家直接暗杀。目标可打出还施僧反弹，或打出殉道者保命并获荣誉标记。
                </span>
              </li>
              <li>
                <span className="text-emerald-300 font-semibold">上忍 1–6</span>
                <span className="block text-slate-300/85">
                  指定一名玩家（可含自己），偷看流派后选择暗杀或放过；暗杀同样触发受害者反应。
                </span>
              </li>
              <li>
                <span className="text-cyan-300 font-semibold">还施僧（反应牌）×1</span>
                <span className="block text-slate-300/85">
                  当你被指定为暗杀目标时打出：反弹至攻击者。审判无法被反弹。
                </span>
              </li>
              <li>
                <span className="text-pink-300 font-semibold">殉道者（反应牌）×1</span>
                <span className="block text-slate-300/85">
                  当你被指定为暗杀目标时打出：你不会死亡，并获得 1 枚荣誉标记。审判无法响应。
                </span>
              </li>
              <li>
                <span className="text-indigo-300 font-semibold">首脑 ×1</span>
                <span className="block text-slate-300/85">
                  夜末若你仍存活则自动公开：你的流派赢得本回合。若你是浪人，则不发放鹤/莲奖励，仅浪人因存活获得 1 个标记。
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">骗徒 6 张（英版优先级）</h3>
            <ul className="space-y-2 text-[0.8125rem] text-slate-300/90 leading-relaxed">
              <li>
                <span className="text-amber-300 font-semibold">变形者（优先级 1）</span>
                <span className="block text-slate-300/85">
                  选择任意两名玩家（可含自己），查看后可选秘密交换；被交换者之后不可再自由查看自己的流派牌。
                </span>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">盗墓者（优先级 2）</span>
                <span className="block text-slate-300/85">
                  从弃牌堆翻最多 2 张，必须取 1 张；可立即打出（可越阶段），或留下等到对应阶段。
                </span>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">灵商（优先级 3）</span>
                <span className="block text-slate-300/85">
                  先查看目标的流派或一张荣誉标记，再决定是否 1 换 1。没有自己的标记则只能看。
                </span>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">盗贼（优先级 4）</span>
                <span className="block text-slate-300/85">
                  公开自己的流派；从标记数严格更多的玩家中随机偷 1 张。无人可偷时仍公开身份。
                </span>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">麻烦制造者（优先级 5）</span>
                <span className="block text-slate-300/85">
                  偷看目标流派后，选择是否当众揭示。
                </span>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">审判（优先级 6）</span>
                <span className="block text-slate-300/85">
                  公开自己的流派并击杀一名玩家。<strong className="text-amber-200">还施僧与殉道者无法响应</strong>。
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">注意</h3>
            <p className="text-[0.8125rem] text-slate-300/90 leading-relaxed">
              鼓励发言与诈唬。选择「本阶段不出」的牌本回合后续不能再出。死亡后无法行动，但仍可发言。公开行动会出现在本回合日志中。
            </p>
          </section>

          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </div>
      </div>
    </div>,
    document.body
  )
}
