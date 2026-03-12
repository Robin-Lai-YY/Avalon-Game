import { useState } from 'react'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { RolePage } from './pages/RolePage'
import { GamePage } from './pages/GamePage'
import './index.css'

type View = 'home' | 'lobby' | 'roleReveal' | 'game'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [roomId, setRoomId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [isHost, setIsHost] = useState(false)

  function handleEnterLobby(rid: string, pid: string, host: boolean) {
    setRoomId(rid)
    setPlayerId(pid)
    setIsHost(host)
    setView('lobby')
  }

  function handleBack() {
    setView('home')
    setRoomId('')
    setPlayerId('')
    setIsHost(false)
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

  return <HomePage onEnterLobby={handleEnterLobby} />
}
