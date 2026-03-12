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
      <div className="min-h-screen flex items-center justify-center p-4">
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Your Role</h2>
      <div className="border border-gray-300 rounded py-4 px-4 mb-6 text-center">
        <p className="text-lg font-mono font-bold">{myRole || '—'}</p>
      </div>
      <h3 className="text-lg font-semibold mb-2">Visible Players:</h3>
      <ul className="list-none p-0 space-y-1 mb-6">
        {visibleEntries.length > 0 ? (
          visibleEntries.map(({ id, name }) => <li key={id}>{name}</li>)
        ) : (
          <li className="text-gray-500">None</li>
        )}
      </ul>
      <button
        type="button"
        onClick={handleContinue}
        disabled={advancing}
        className="w-full bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {advancing ? 'Continuing…' : 'Continue'}
      </button>
    </div>
  )
}
