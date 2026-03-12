import { useEffect, useState } from 'react'
import { createRoom, joinRoom } from '../services/gameEngine'

type HomePageProps = {
  onEnterLobby: (roomId: string, playerId: string, isHost: boolean) => void
}

export function HomePage({ onEnterLobby }: HomePageProps) {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')?.trim().toUpperCase()
    if (room) setRoomCode(room)
  }, [])

  async function handleCreateRoom() {
    setError('')
    if (!name.trim()) {
      setError('Enter your name')
      return
    }
    setLoading(true)
    try {
      const { roomId, hostId } = await createRoom(name.trim())
      onEnterLobby(roomId, hostId, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinRoom() {
    setError('')
    const code = roomCode.trim().toUpperCase()
    if (!code) {
      setError('Enter room code')
      return
    }
    if (!joinName.trim()) {
      setError('Enter your name')
      return
    }
    setLoading(true)
    try {
      const { playerId } = await joinRoom(code, joinName.trim())
      onEnterLobby(code, playerId, false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-6">Avalon Assistant</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2"
          aria-label="Your name for create"
        />
        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={loading}
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50 transition-opacity duration-200"
        >
          Create Room
        </button>
        <hr className="border-gray-300" />
        <input
          type="text"
          placeholder="Room code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          className="border rounded px-3 py-2 font-mono uppercase"
          aria-label="Room code"
          maxLength={6}
        />
        <input
          type="text"
          placeholder="Your name"
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
          className="border rounded px-3 py-2"
          aria-label="Your name for join"
        />
        <button
          type="button"
          onClick={handleJoinRoom}
          disabled={loading}
          className="bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          Join Room
        </button>
      </div>
    </div>
  )
}
