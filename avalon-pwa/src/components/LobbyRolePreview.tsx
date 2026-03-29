import { formatRoleListForDisplay } from '../utils/roleLabels'

type LobbyRolePreviewProps = {
  goodRoles: string[]
  evilRoles: string[]
}

/** Shows blue (good) and red (evil) role lineup for the selected player count. */
export function LobbyRolePreview({ goodRoles, evilRoles }: LobbyRolePreviewProps) {
  const goodLines = formatRoleListForDisplay(goodRoles)
  const evilLines = formatRoleListForDisplay(evilRoles)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">蓝方 · 好人</p>
        <p className="text-sm text-blue-900 font-medium mb-2">{goodRoles.length} 人</p>
        <ul className="list-none p-0 space-y-1 text-sm text-blue-950">
          {goodLines.map((line, i) => (
            <li key={i}>· {line}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
        <p className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-2">红方 · 坏人</p>
        <p className="text-sm text-red-900 font-medium mb-2">{evilRoles.length} 人</p>
        <ul className="list-none p-0 space-y-1 text-sm text-red-950">
          {evilLines.map((line, i) => (
            <li key={i}>· {line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
