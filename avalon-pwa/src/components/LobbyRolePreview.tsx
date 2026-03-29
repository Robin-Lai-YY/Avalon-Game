import { formatRoleListForDisplay } from '../utils/roleLabels'
import { FantasySilhouette } from './visuals/FantasySilhouette'

type LobbyRolePreviewProps = {
  goodRoles: string[]
  evilRoles: string[]
}

export function LobbyRolePreview({ goodRoles, evilRoles }: LobbyRolePreviewProps) {
  const goodLines = formatRoleListForDisplay(goodRoles)
  const evilLines = formatRoleListForDisplay(evilRoles)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl p-4 bg-blue-500/[0.04] avalon-card-glow-good border border-blue-500/10 transition-all duration-300">
        <div className="flex items-center gap-3 mb-3">
          <div className="shrink-0 opacity-90">
            <FantasySilhouette variant="good" size={44} />
          </div>
          <div>
            <p className="text-[0.6875rem] font-semibold text-blue-300/80 uppercase tracking-wider">蓝方 · 好人</p>
            <p className="text-sm text-blue-100/80 font-medium">{goodRoles.length} 人</p>
          </div>
        </div>
        <ul className="list-none p-0 space-y-1.5">
          {goodLines.map((line, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-300/90">
              <span className="w-1 h-1 rounded-full bg-blue-400/50 shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl p-4 bg-red-500/[0.04] avalon-card-glow-evil border border-red-500/10 transition-all duration-300">
        <div className="flex items-center gap-3 mb-3">
          <div className="shrink-0 opacity-90">
            <FantasySilhouette variant="evil" size={44} />
          </div>
          <div>
            <p className="text-[0.6875rem] font-semibold text-red-300/80 uppercase tracking-wider">红方 · 坏人</p>
            <p className="text-sm text-red-100/80 font-medium">{evilRoles.length} 人</p>
          </div>
        </div>
        <ul className="list-none p-0 space-y-1.5">
          {evilLines.map((line, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-300/90">
              <span className="w-1 h-1 rounded-full bg-red-400/50 shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
