import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import { FantasySilhouette, roleToSilhouetteVariant } from '../components/visuals/FantasySilhouette'
import { advanceToTeamSelection, getVisiblePlayerIds, isEvilRole } from '../services/gameEngine'

type RoomData = {
  state: string
  roles: Record<string, string>
  players: Record<string, { name: string }>
}

type RolePageProps = {
  roomId: string
  playerId: string
  onContinue: () => void
}

export function RolePage({ roomId, playerId, onContinue }: RolePageProps) {
  const [room, setRoom] = useState<RoomData | null>(null)
  const [advancing, setAdvancing] = useState(false)

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.val())
    })
    return () => unsubscribe()
  }, [roomId])

  const myRole = room?.roles?.[playerId] ?? ''
  const visibleIds = myRole ? getVisiblePlayerIds(myRole, room?.roles ?? {}, playerId) : []
  const visibleEntries = visibleIds.map((id) => ({ id, name: room?.players?.[id]?.name ?? id }))

  async function handleContinue() {
    setAdvancing(true)
    try {
      await advanceToTeamSelection(roomId)
      onContinue()
    } finally {
      setAdvancing(false)
    }
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <p className="text-slate-400">加载中…</p>
      </div>
    )
  }

  const sil = roleToSilhouetteVariant(myRole)

  return (
    <div className="min-h-screen flex flex-col p-5 max-w-md mx-auto gap-6 animate-fade-in">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">你的身份</h2>
      <div
        className={`rounded-2xl py-6 px-6 text-center bg-slate-900/70 ${
          isEvilRole(myRole)
            ? 'avalon-card-glow-evil border border-red-500/30'
            : 'avalon-card-glow-good border border-blue-500/30'
        }`}
      >
        <div className="flex justify-center mb-3">
          <FantasySilhouette variant={sil} size={100} />
        </div>
        <p className="text-xl font-mono font-bold text-slate-100">{myRole || '—'}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">可见玩家</h3>
        <ul className="list-none p-0 space-y-2 rounded-xl avalon-card p-4">
          {visibleEntries.length > 0 ? (
            visibleEntries.map(({ id, name }) => (
              <li key={id} className="text-slate-200 font-medium">
                {name}
              </li>
            ))
          ) : (
            <li className="text-slate-500">无</li>
          )}
        </ul>
      </div>
      <button
        type="button"
        onClick={handleContinue}
        disabled={advancing}
        className="w-full min-h-[48px] bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
      >
        {advancing ? '进入中…' : '进入游戏'}
      </button>
    </div>
  )
}
