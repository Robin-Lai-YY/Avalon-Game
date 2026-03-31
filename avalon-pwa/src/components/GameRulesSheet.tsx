import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ROLE_LABEL_ZH } from '../utils/roleLabels'

const MISSION_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
}

type Tab = 'overview' | 'roles' | 'missions'

type GameRulesSheetProps = {
  open: boolean
  onClose: () => void
  currentRole?: string
}

export function GameRulesSheet({ open, onClose, currentRole }: GameRulesSheetProps) {
  const [tab, setTab] = useState<Tab>('overview')

  if (!open) return null

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: '流程' },
    { id: 'roles', label: '角色' },
    { id: 'missions', label: '任务表' },
  ]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Sheet — fixed to bottom, nearly full height with safe-area */}
      <div
        className="relative w-full sm:max-w-lg bg-[#0c101e] border-t border-x border-white/[0.08] rounded-t-2xl flex flex-col animate-slide-up"
        style={{ height: 'calc(92dvh - env(safe-area-inset-top, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-white/[0.15]" />
        </div>

        {/* Header */}
        <div className="shrink-0 px-5 pt-2 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">游戏规则</h2>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-400 active:bg-white/[0.1] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 min-h-[36px] rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === t.id
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'text-slate-400 active:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 space-y-5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {tab === 'overview' && <OverviewTab />}
          {tab === 'roles' && <RolesTab currentRole={currentRole} />}
          {tab === 'missions' && <MissionsTab />}

          {/* Bottom safe area spacer */}
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </div>
      </div>
    </div>,
    document.body
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-white mb-2">{children}</h3>
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.8125rem] text-slate-300/90 leading-relaxed">{children}</p>
}

function OverviewTab() {
  const steps = [
    {
      num: '1',
      title: '组队',
      desc: '每轮由队长选择指定人数的任务队伍。',
    },
    {
      num: '2',
      title: '投票',
      desc: '所有玩家对提议的队伍投赞成或反对。过半赞成则通过；否则换下一位队长重新组队。连续 5 次否决，坏人直接获胜。',
    },
    {
      num: '3',
      title: '执行任务',
      desc: '被选中的队员秘密投「成功」或「失败」。好人只能投成功，坏人可选择投失败。出现任何失败票则任务失败（7+ 人局第 4 轮需 2 张失败票）。',
    },
    {
      num: '4',
      title: '胜负判定',
      desc: '5 轮任务中先赢 3 轮的阵营获胜。若好人先赢 3 轮，进入刺杀阶段：刺客猜中梅林则坏人逆转获胜。',
    },
  ]

  return (
    <>
      <div>
        <SectionTitle>游戏目标</SectionTitle>
        <Paragraph>
          玩家分为<span className="text-blue-300 font-medium">蓝方（好人）</span>和<span className="text-red-300 font-medium">红方（坏人）</span>两个阵营。好人目标是完成任务，坏人目标是破坏任务或隐藏身份到最后。
        </Paragraph>
      </div>
      <div>
        <SectionTitle>游戏流程</SectionTitle>
        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-indigo-300">{s.num}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="text-[0.8125rem] text-slate-400 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>刺杀阶段</SectionTitle>
        <Paragraph>
          好人赢得 3 轮任务后，刺客有一次机会指认梅林。若猜中，坏人逆转获胜；若猜错，好人最终获胜。因此梅林要引导好人又不能暴露自己。
        </Paragraph>
      </div>
    </>
  )
}

function RolesTab({ currentRole }: { currentRole?: string }) {
  const roles = [
    {
      name: '梅林',
      eng: 'Merlin',
      side: 'good' as const,
      desc: '知道所有坏人身份（莫德雷德除外）。但必须隐藏自己，否则会被刺客刺杀。',
    },
    {
      name: '派西维尔',
      eng: 'Percival',
      side: 'good' as const,
      desc: '能看到梅林和莫甘娜，但不知道谁是谁。需要辨别真假梅林。',
    },
    {
      name: '忠臣',
      eng: 'Servant',
      side: 'good' as const,
      desc: '普通好人，没有额外信息。通过讨论和推理判断队友。',
    },
    {
      name: '刺客',
      eng: 'Assassin',
      side: 'evil' as const,
      desc: '坏人核心。好人赢 3 轮后，刺客可尝试刺杀梅林来逆转。',
    },
    {
      name: '莫甘娜',
      eng: 'Morgana',
      side: 'evil' as const,
      desc: '在派西维尔眼中与梅林相同，可以假扮梅林迷惑好人。',
    },
    {
      name: '莫德雷德',
      eng: 'Mordred',
      side: 'evil' as const,
      desc: '梅林看不到的坏人。不会出现在梅林的视野中，非常危险。',
      note: '9–10 人局出场',
    },
    {
      name: '奥伯伦',
      eng: 'Oberon',
      side: 'evil' as const,
      desc: '孤立的坏人：不知道其他坏人是谁，其他坏人也看不到他。',
      note: '7 人局 / 10 人局出场',
    },
    {
      name: '爪牙',
      eng: 'Minion',
      side: 'evil' as const,
      desc: '普通坏人，和其他坏人互相认识（奥伯伦除外）。',
      note: '8 人局出场',
    },
  ]
  const myRoleLabel = currentRole ? ROLE_LABEL_ZH[currentRole] ?? currentRole : ''
  const roleTips: Record<string, string[]> = {
    MERLIN: ['你知道大部分坏人，但千万不要太像“先知”。', '发言以引导为主，避免给出过于精确的身份判断。'],
    PERCIVAL: ['你能看到两位“梅林候选人”，要重点观察发言一致性。', '优先保护更像真梅林的玩家，避免把信息说死。'],
    SERVANT: ['你没有额外视野，核心是听逻辑与投票轨迹。', '多用“队伍组合是否合理”来判断阵营。'],
    ASSASSIN: ['坏人若先输到 2:3，你还有一次刺杀翻盘机会。', '留意谁在稳定引导局势，可能是真梅林。'],
    MORGANA: ['你的目标是制造“真假梅林”混淆。', '发言尽量像在保护好人，但别和同伙完全同调。'],
    MORDRED: ['梅林看不到你，你是隐藏最深的坏人位。', '关键轮可主动进队制造失败，同时保持“像好人”的发言。'],
    OBERON: ['你是孤狼位，其他坏人不知道你。', '别和“疑似坏人”强绑定，避免互相暴露。'],
    MINION: ['你与多数坏人互认，任务是协同控队和带节奏。', '失败票不要太贪，优先保证自己不被坐实。'],
  }
  const myRoleTips = currentRole ? roleTips[currentRole] ?? [] : []

  return (
    <div className="space-y-3">
      {currentRole && (
        <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05]">
          <p className="text-[0.6875rem] text-indigo-300/70 font-medium mb-1.5">你的当前身份</p>
          <p className="text-sm font-semibold text-indigo-200">{myRoleLabel}</p>
          {myRoleTips.length > 0 && (
            <ul className="mt-2 space-y-1.5 list-none p-0">
              {myRoleTips.map((tip) => (
                <li key={tip} className="text-[0.75rem] text-indigo-100/80 leading-relaxed">
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {roles.map((r) => (
        <div
          key={r.eng}
          className={`p-3.5 rounded-xl border ${
            r.side === 'good'
              ? 'border-blue-500/10 bg-blue-500/[0.03]'
              : 'border-red-500/10 bg-red-500/[0.03]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${r.side === 'good' ? 'bg-blue-400' : 'bg-red-400'}`} />
            <span className="text-sm font-semibold text-white">{r.name}</span>
            <span className="text-[0.625rem] text-slate-500 font-mono">{r.eng}</span>
            {r.side === 'good' && (
              <span className="ml-auto text-[0.625rem] text-blue-400/70 font-medium">蓝方</span>
            )}
            {r.side === 'evil' && (
              <span className="ml-auto text-[0.625rem] text-red-400/70 font-medium">红方</span>
            )}
          </div>
          <p className="text-[0.8125rem] text-slate-400 leading-relaxed">{r.desc}</p>
          {r.note && (
            <p className="text-[0.6875rem] text-slate-500 mt-1">{r.note}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function MissionsTab() {
  const playerCounts = [5, 6, 7, 8, 9, 10]

  return (
    <>
      <div>
        <SectionTitle>任务人数表</SectionTitle>
        <Paragraph>
          每轮任务需要队长选择指定人数的队员。下表列出了不同人数对局中，每轮所需的队员数量。
        </Paragraph>
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[0.6875rem] text-slate-500 font-medium pb-2 pr-3 whitespace-nowrap">人数</th>
              {[1, 2, 3, 4, 5].map((r) => (
                <th key={r} className="text-center text-[0.6875rem] text-slate-500 font-medium pb-2 px-2 whitespace-nowrap">
                  第{r}轮
                </th>
              ))}
              <th className="text-center text-[0.6875rem] text-slate-500 font-medium pb-2 pl-2 whitespace-nowrap">阵营</th>
            </tr>
          </thead>
          <tbody>
            {playerCounts.map((pc) => {
              const sizes = MISSION_SIZES[pc] ?? []
              const goodCount = pc <= 6 ? (pc === 5 ? 3 : 4) : pc <= 8 ? (pc === 7 ? 4 : 5) : 6
              const evilCount = pc - goodCount
              return (
                <tr key={pc} className="border-t border-white/[0.04]">
                  <td className="py-2.5 pr-3 text-white font-semibold">{pc}人</td>
                  {sizes.map((s, i) => (
                    <td key={i} className="py-2.5 px-2 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                        pc >= 7 && i === 3
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                          : 'bg-white/[0.04] text-slate-300 border border-white/[0.06]'
                      }`}>
                        {s}
                      </span>
                    </td>
                  ))}
                  <td className="py-2.5 pl-2 text-center">
                    <span className="text-[0.6875rem]">
                      <span className="text-blue-300">{goodCount}</span>
                      <span className="text-slate-600 mx-0.5">:</span>
                      <span className="text-red-300">{evilCount}</span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/10">
        <p className="text-[0.8125rem] text-amber-200/80 leading-relaxed">
          <span className="font-semibold">特殊规则：</span>7 人及以上对局的第 4 轮任务，需要<span className="font-semibold">至少 2 张失败票</span>才会判定任务失败（<span className="text-amber-300">黄色高亮</span>的轮次）。
        </p>
      </div>
    </>
  )
}
