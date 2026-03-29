import { useCallback, useEffect, useState } from 'react'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { RolePage } from './pages/RolePage'
import { GamePage } from './pages/GamePage'
import { leaveLobby, reconnectRoom } from './services/gameEngine'
import {
  clearSession,
  isReconnectPermanentFailure,
  loadSession,
  saveSession,
} from './utils/sessionStorage'
import './index.css'

type View = 'home' | 'lobby' | 'roleReveal' | 'game'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [roomId, setRoomId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const [homeNotice, setHomeNotice] = useState('')
  const [failedInitialRestore, setFailedInitialRestore] = useState(false)

  useEffect(() => {
    const session = loadSession()
    if (!session) {
      setRestoring(false)
      return
    }
    reconnectRoom(session.roomId, session.playerId)
      .then(({ roomId: rid, playerId: pid, isHost: host, state }) => {
        saveSession(rid, pid, host)
        setRoomId(rid)
        setPlayerId(pid)
        setIsHost(host)
        setFailedInitialRestore(false)
        if (state === 'LOBBY') setView('lobby')
        else if (state === 'ROLE_REVEAL') setView('roleReveal')
        else setView('game')
      })
      .catch((e) => {
        if (isReconnectPermanentFailure(e)) {
          clearSession()
          setFailedInitialRestore(false)
        } else {
          setFailedInitialRestore(true)
        }
      })
      .finally(() => setRestoring(false))
  }, [])

  async function handleRetryInitialRestore() {
    const session = loadSession()
    if (!session) {
      setFailedInitialRestore(false)
      return
    }
    try {
      const { roomId: rid, playerId: pid, isHost: host, state } = await reconnectRoom(
        session.roomId,
        session.playerId
      )
      saveSession(rid, pid, host)
      setRoomId(rid)
      setPlayerId(pid)
      setIsHost(host)
      setFailedInitialRestore(false)
      if (state === 'LOBBY') setView('lobby')
      else if (state === 'ROLE_REVEAL') setView('roleReveal')
      else setView('game')
    } catch (e) {
      if (isReconnectPermanentFailure(e)) {
        clearSession()
        setFailedInitialRestore(false)
      }
    }
  }

  function handleEnterLobby(rid: string, pid: string, host: boolean) {
    setHomeNotice('')
    setFailedInitialRestore(false)
    setRoomId(rid)
    setPlayerId(pid)
    setIsHost(host)
    setView('lobby')
    saveSession(rid, pid, host)
  }

  function handleReconnect(rid: string, pid: string, host: boolean, state: string) {
    setFailedInitialRestore(false)
    setRoomId(rid)
    setPlayerId(pid)
    setIsHost(host)
    saveSession(rid, pid, host)
    if (state === 'LOBBY') setView('lobby')
    else if (state === 'ROLE_REVEAL') setView('roleReveal')
    else setView('game')
  }

  const handleRemovedFromLobby = useCallback(() => {
    setHomeNotice('你已被移出房间，或房间已解散。可重新加入其他对局。')
    setView('home')
    setRoomId('')
    setPlayerId('')
    setIsHost(false)
    clearSession()
  }, [])

  async function handleBack() {
    if (view === 'lobby' && roomId && playerId) {
      try {
        await leaveLobby(roomId, playerId)
      } catch {
        // Still return home so user is not stuck; room may already be gone
      }
    }
    setHomeNotice('')
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
        onBack={() => void handleBack()}
        onRemovedFromLobby={handleRemovedFromLobby}
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
        onPlayAgain={() => void handleBack()}
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
      notice={homeNotice}
      onClearNotice={() => setHomeNotice('')}
      showRestoreBanner={failedInitialRestore && loadSession() != null}
      onRetryRestore={handleRetryInitialRestore}
      onEnterLobby={handleEnterLobby}
      onReconnect={handleReconnect}
    />
  )
}
