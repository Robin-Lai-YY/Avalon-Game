import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import { FantasySilhouette, roleToSilhouetteVariant } from '../components/visuals/FantasySilhouette'
import { advanceToTeamSelection, getVisiblePlayerIds, isEvilRole } from '../services/gameEngine'
import { ROLE_LABEL_ZH } from '../utils/roleLabels'
import { useSeatPresence } from '../hooks/useSeatPresence'
import { loadSession } from '../utils/sessionStorage'

type RoomData = {
  state: string
  roles: Record<string, string>
  players: Record<string, { name: string }>
}

type RolePageProps = {
  roomId: string
  playerId: string
  onContinue: () => void
  onSeatTakenOver?: () => void
}

export function RolePage({ roomId, playerId, onContinue, onSeatTakenOver }: RolePageProps) {
  const [room, setRoom] = useState<RoomData | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const seatGeneration = loadSession()?.seatGeneration ?? 0

  useSeatPresence({
    roomPath: `rooms/${roomId}`,
    playerId,
    seatGeneration,
    onSeatTakenOver: () => onSeatTakenOver?.(),
  })

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.val())
    })
    return () => unsubscribe()
  }, [roomId])

  useEffect(() => {
    if (room) {
      const t = setTimeout(() => setRevealed(true), 300)
      return () => clearTimeout(t)
    }
  }, [room])

  const myRole = room?.roles?.[playerId] ?? ''
  const visibleIds = myRole ? getVisiblePlayerIds(myRole, room?.roles ?? {}, playerId) : []
  const visibleEntries = visibleIds.map((id) => ({ id, name: room?.players?.[id]?.name ?? id }))
  const evil = isEvilRole(myRole)

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
      <div className="min-h-dvh flex items-center justify-center p-5">
        <div className="flex gap-1.5">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      </div>
    )
  }

  const sil = roleToSilhouetteVariant(myRole)
  const roleLabel = ROLE_LABEL_ZH[myRole] ?? myRole

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 py-10 max-w-md mx-auto">
      {/* Role Reveal Card */}
      <div
        className={`w-full rounded-2xl p-8 text-center transition-all duration-700 ${
          revealed ? 'animate-role-reveal' : 'opacity-0'
        } ${
          evil
            ? 'avalon-card-glow-evil border border-red-500/20 bg-gradient-to-b from-red-950/30 to-[var(--avalon-bg-elevated)]'
            : 'avalon-card-glow-good border border-blue-500/20 bg-gradient-to-b from-blue-950/30 to-[var(--avalon-bg-elevated)]'
        }`}
        style={{ backdropFilter: 'blur(16px)' }}
      >
        <p className="section-label mb-6">你的身份</p>

        <div className={`flex justify-center mb-5 ${revealed ? 'animate-float' : ''}`}>
          <FantasySilhouette variant={sil} size={110} />
        </div>

        <h2 className={`text-2xl font-bold tracking-wide ${evil ? 'text-red-300' : 'text-blue-300'}`}>
          {roleLabel}
        </h2>
        <p className={`text-xs mt-1.5 font-mono tracking-widest uppercase ${evil ? 'text-red-400/50' : 'text-blue-400/50'}`}>
          {myRole || '—'}
        </p>

        {/* Faction indicator */}
        <div className={`inline-flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full text-xs font-semibold ${
          evil
            ? 'bg-red-500/10 text-red-400/80 border border-red-500/15'
            : 'bg-blue-500/10 text-blue-400/80 border border-blue-500/15'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${evil ? 'bg-red-400' : 'bg-blue-400'} animate-glow-breathe`} />
          {evil ? '红方 · 邪恶阵营' : '蓝方 · 正义阵营'}
        </div>
      </div>

      {/* Visible Players */}
      <div className={`w-full mt-6 transition-all duration-500 ${revealed ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
        <h3 className="section-label mb-3 px-1">可见玩家</h3>
        <div className="avalon-card p-4">
          {visibleEntries.length > 0 ? (
            <ul className="list-none p-0 space-y-2.5">
              {visibleEntries.map(({ id, name }) => (
                <li key={id} className="flex items-center gap-2.5 text-slate-200 font-medium text-[0.9375rem]">
                  <span className={`w-2 h-2 rounded-full ${evil ? 'bg-red-400/60' : 'bg-blue-400/60'}`} />
                  {name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm">无可见玩家</p>
          )}
        </div>
      </div>

      {/* Continue Button */}
      <div className={`w-full mt-6 transition-all duration-500 ${revealed ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '600ms' }}>
        <button
          type="button"
          onClick={handleContinue}
          disabled={advancing}
          className="w-full min-h-[48px] btn-primary px-4 py-3 font-semibold disabled:opacity-50 text-[0.9375rem]"
        >
          {advancing ? '进入中…' : '进入游戏'}
        </button>
      </div>
    </div>
  )
}
