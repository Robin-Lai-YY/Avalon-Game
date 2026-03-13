import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import { advanceToTeamSelection, getVisiblePlayerIds } from '../services/gameEngine'

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
        <p className="text-gray-500">加载中…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col p-5 max-w-md mx-auto gap-6 animate-fade-in">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">你的身份</h2>
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 py-8 px-6 text-center">
        <p className="text-2xl font-mono font-bold text-amber-900">{myRole || '—'}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">可见玩家</h3>
        <ul className="list-none p-0 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
          {visibleEntries.length > 0 ? (
            visibleEntries.map(({ id, name }) => (
              <li key={id} className="text-gray-800 font-medium">{name}</li>
            ))
          ) : (
            <li className="text-gray-500">无</li>
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
