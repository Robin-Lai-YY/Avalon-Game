import { useEffect, useState } from 'react'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { RolePage } from './pages/RolePage'
import { GamePage } from './pages/GamePage'
import { reconnectRoom } from './services/gameEngine'
import { clearSession, loadSession, saveSession } from './utils/sessionStorage'
import './index.css'

type View = 'home' | 'lobby' | 'roleReveal' | 'game'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [roomId, setRoomId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    const session = loadSession()
    if (!session) {
      setRestoring(false)
      return
    }
    reconnectRoom(session.roomId, session.playerId)
      .then(({ roomId: rid, playerId: pid, isHost: host, state }) => {
        setRoomId(rid)
        setPlayerId(pid)
        setIsHost(host)
        if (state === 'LOBBY') setView('lobby')
        else if (state === 'ROLE_REVEAL') setView('roleReveal')
        else setView('game')
      })
      .catch(() => {
        clearSession()
      })
      .finally(() => setRestoring(false))
  }, [])

  function handleEnterLobby(rid: string, pid: string, host: boolean) {
    setRoomId(rid)
    setPlayerId(pid)
    setIsHost(host)
    setView('lobby')
    saveSession(rid, pid, host)
  }

  function handleReconnect(rid: string, pid: string, host: boolean, state: string) {
    setRoomId(rid)
    setPlayerId(pid)
    setIsHost(host)
    saveSession(rid, pid, host)
    if (state === 'LOBBY') setView('lobby')
    else if (state === 'ROLE_REVEAL') setView('roleReveal')
    else setView('game')
  }

  function handleBack() {
    setView('home')
    setRoomId('')
    setPlayerId('')
    setIsHost(false)
    clearSession()
  }

  if (view === 'lobby') {
    return (
      <LobbyPage
        roomId={roomId}
        playerId={playerId}
        isHost={isHost}
        onBack={handleBack}
        onEnterRoleReveal={() => setView('roleReveal')}
      />
    )
  }

  if (view === 'roleReveal') {
    return (
      <RolePage
        roomId={roomId}
        playerId={playerId}
        onContinue={() => setView('game')}
      />
    )
  }

  if (view === 'game') {
    return (
      <GamePage
        roomId={roomId}
        playerId={playerId}
        onPlayAgain={handleBack}
      />
    )
  }

  if (restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <HomePage
      onEnterLobby={handleEnterLobby}
      onReconnect={handleReconnect}
    />
  )
}
