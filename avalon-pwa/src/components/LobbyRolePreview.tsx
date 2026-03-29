import { formatRoleListForDisplay } from '../utils/roleLabels'
import { FantasySilhouette } from './visuals/FantasySilhouette'

type LobbyRolePreviewProps = {
  goodRoles: string[]
  evilRoles: string[]
}

/** Shows blue (good) and red (evil) role lineup — dark cards + glow (visual prompt pack). */
export function LobbyRolePreview({ goodRoles, evilRoles }: LobbyRolePreviewProps) {
  const goodLines = formatRoleListForDisplay(goodRoles)
  const evilLines = formatRoleListForDisplay(evilRoles)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl p-4 bg-slate-900/60 avalon-card-glow-good border border-blue-500/25">
        <div className="flex items-start gap-3 mb-2">
          <FantasySilhouette variant="good" size={56} className="shrink-0 opacity-95" />
          <div>
            <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide">蓝方 · 好人</p>
            <p className="text-sm text-blue-100 font-medium">{goodRoles.length} 人</p>
          </div>
        </div>
        <ul className="list-none p-0 space-y-1 text-sm text-slate-200">
          {goodLines.map((line, i) => (
            <li key={i}>· {line}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl p-4 bg-slate-900/60 avalon-card-glow-evil border border-red-500/25">
        <div className="flex items-start gap-3 mb-2">
          <FantasySilhouette variant="evil" size={56} className="shrink-0 opacity-95" />
          <div>
            <p className="text-xs font-semibold text-red-300 uppercase tracking-wide">红方 · 坏人</p>
            <p className="text-sm text-red-100 font-medium">{evilRoles.length} 人</p>
          </div>
        </div>
        <ul className="list-none p-0 space-y-1 text-sm text-slate-200">
          {evilLines.map((line, i) => (
            <li key={i}>· {line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
