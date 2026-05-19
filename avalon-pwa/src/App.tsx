import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { HomePage } from './pages/HomePage'
import { GameHubPage } from './pages/GameHubPage'
import { LobbyPage } from './pages/LobbyPage'
import { RolePage } from './pages/RolePage'
import { GamePage } from './pages/GamePage'
import { UndercoverHomePage } from './pages/UndercoverHomePage'
import { UndercoverLobbyPage } from './pages/UndercoverLobbyPage'
import { UndercoverGamePage } from './pages/UndercoverGamePage'
import { LiarsDiceGamePage } from './pages/LiarsDiceGamePage'
import { NinjaHomePage } from './pages/NinjaHomePage'
import { NinjaLobbyPage } from './pages/NinjaLobbyPage'
import { NinjaGamePage } from './pages/NinjaGamePage'
import { leaveLobby, reconnectByToken, reconnectRoom } from './services/gameEngine'
import {
  leaveUndercoverLobby,
  reconnectUndercoverByToken,
  reconnectUndercoverRoom,
} from './services/undercoverEngine'
import {
  leaveNinjaLobby,
  reconnectNinjaByToken,
  reconnectNinjaRoom,
} from './services/ninjaEngine'
import {
  clearSession,
  isReconnectPermanentFailure,
  loadSession,
  saveSession,
} from './utils/sessionStorage'
import {
  clearUndercoverSession,
  isUndercoverReconnectPermanentFailure,
  loadUndercoverSession,
  saveUndercoverSession,
} from './utils/undercoverSessionStorage'
import {
  clearNinjaSession,
  isNinjaReconnectPermanentFailure,
  loadNinjaSession,
  saveNinjaSession,
} from './utils/ninjaSessionStorage'
import './index.css'

type View =
  | 'hub'
  | 'home'
  | 'lobby'
  | 'roleReveal'
  | 'game'
  | 'undercoverHome'
  | 'undercoverLobby'
  | 'undercoverGame'
  | 'liarsDiceGame'
  | 'ninjaHome'
  | 'ninjaLobby'
  | 'ninjaGame'

function updateUrlRoom(roomId: string, token?: string, game?: 'avalon' | 'undercover' | 'ninja') {
  const url = new URL(window.location.href)
  if (roomId) {
    url.searchParams.set('room', roomId)
    if (token) url.searchParams.set('token', token)
    else url.searchParams.delete('token')
    if (game) url.searchParams.set('game', game)
    else url.searchParams.delete('game')
  } else {
    url.searchParams.delete('room')
    url.searchParams.delete('token')
    url.searchParams.delete('game')
  }
  window.history.replaceState(null, '', url.toString())
}

function clearUrlParams() {
  const url = new URL(window.location.href)
  url.searchParams.delete('room')
  url.searchParams.delete('token')
  url.searchParams.delete('game')
  window.history.replaceState(null, '', url.toString())
}

export default function App() {
  const [view, setView] = useState<View>('hub')
  const [roomId, setRoomId] = useState('') // avalon
  const [playerId, setPlayerId] = useState('') // avalon
  const [undercoverRoomId, setUndercoverRoomId] = useState('')
  const [undercoverPlayerId, setUndercoverPlayerId] = useState('')
  const [ninjaRoomId, setNinjaRoomId] = useState('')
  const [ninjaPlayerId, setNinjaPlayerId] = useState('')
  const [liarsDiceCount, setLiarsDiceCount] = useState(5)
  const [restoring, setRestoring] = useState(true)
  const [homeNotice, setHomeNotice] = useState('')
  const [undercoverNotice, setUndercoverNotice] = useState('')
  const [ninjaNotice, setNinjaNotice] = useState('')
  const [failedInitialRestore, setFailedInitialRestore] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const game = params.get('game')?.trim().toLowerCase()
    const urlRoom = params.get('room')?.trim().toUpperCase()
    const urlToken = params.get('token')?.trim()

    if (urlRoom && urlToken) {
      if (game === 'undercover') {
        reconnectUndercoverByToken(urlRoom, urlToken)
          .then(({ roomId: rid, playerId: pid, isHost: host, state, reconnectToken: newToken }) => {
            saveUndercoverSession(rid, pid, host, newToken)
            setUndercoverRoomId(rid)
            setUndercoverPlayerId(pid)
            setUndercoverNotice('')
            updateUrlRoom(rid, newToken, 'undercover')
            if (state === 'LOBBY') setView('undercoverLobby')
            else setView('undercoverGame')
          })
          .catch((e) => {
            if (isUndercoverReconnectPermanentFailure(e)) clearUndercoverSession()
            setUndercoverNotice('卧底重连链接无效或已过期，请重新加入房间。')
          })
          .finally(() => setRestoring(false))
        return
      }

      if (game === 'ninja') {
        reconnectNinjaByToken(urlRoom, urlToken)
          .then(({ roomId: rid, playerId: pid, isHost: host, state, reconnectToken: newToken }) => {
            saveNinjaSession(rid, pid, host, newToken)
            setNinjaRoomId(rid)
            setNinjaPlayerId(pid)
            setNinjaNotice('')
            updateUrlRoom(rid, newToken, 'ninja')
            if (state === 'LOBBY') setView('ninjaLobby')
            else setView('ninjaGame')
          })
          .catch((e) => {
            if (isNinjaReconnectPermanentFailure(e)) clearNinjaSession()
            setNinjaNotice('忍者之夜重连链接无效或已过期，请重新加入房间。')
          })
          .finally(() => setRestoring(false))
        return
      }

      reconnectByToken(urlRoom, urlToken)
        .then(({ roomId: rid, playerId: pid, isHost: host, state, reconnectToken: newToken }) => {
          saveSession(rid, pid, host, newToken)
          setRoomId(rid)
          setPlayerId(pid)
          setFailedInitialRestore(false)
          updateUrlRoom(rid, newToken, 'avalon')
          if (state === 'LOBBY') setView('lobby')
          else if (state === 'ROLE_REVEAL') setView('roleReveal')
          else setView('game')
        })
        .catch((e) => {
          if (isReconnectPermanentFailure(e)) {
            clearSession()
          }
          setFailedInitialRestore(false)
          setHomeNotice('重连链接无效或已过期，请使用新的链接或手动加入。')
        })
        .finally(() => setRestoring(false))
      return
    }

    const avalonSession = loadSession()
    const undercoverSession = loadUndercoverSession()
    const ninjaSession = loadNinjaSession()
    const activeSessionCount =
      (avalonSession ? 1 : 0) + (undercoverSession ? 1 : 0) + (ninjaSession ? 1 : 0)

    if (avalonSession && activeSessionCount === 1) {
      reconnectRoom(avalonSession.roomId, avalonSession.playerId)
        .then(({ roomId: rid, playerId: pid, isHost: host, state }) => {
          saveSession(rid, pid, host, avalonSession.reconnectToken)
          setRoomId(rid)
          setPlayerId(pid)
          setFailedInitialRestore(false)
          updateUrlRoom(rid, avalonSession.reconnectToken, 'avalon')
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
      return
    }

    if (undercoverSession && activeSessionCount === 1) {
      reconnectUndercoverRoom(undercoverSession.roomId, undercoverSession.playerId)
        .then(({ roomId: rid, playerId: pid, isHost: host, state }) => {
          saveUndercoverSession(rid, pid, host, undercoverSession.reconnectToken)
          setUndercoverRoomId(rid)
          setUndercoverPlayerId(pid)
          setUndercoverNotice('')
          updateUrlRoom(rid, undercoverSession.reconnectToken, 'undercover')
          if (state === 'LOBBY') setView('undercoverLobby')
          else setView('undercoverGame')
        })
        .catch((e) => {
          if (isUndercoverReconnectPermanentFailure(e)) {
            clearUndercoverSession()
          }
          setUndercoverNotice('未能恢复卧底对局，请重新加入。')
        })
        .finally(() => setRestoring(false))
      return
    }

    if (ninjaSession && activeSessionCount === 1) {
      reconnectNinjaRoom(ninjaSession.roomId, ninjaSession.playerId)
        .then(({ roomId: rid, playerId: pid, isHost: host, state }) => {
          saveNinjaSession(rid, pid, host, ninjaSession.reconnectToken)
          setNinjaRoomId(rid)
          setNinjaPlayerId(pid)
          setNinjaNotice('')
          updateUrlRoom(rid, ninjaSession.reconnectToken, 'ninja')
          if (state === 'LOBBY') setView('ninjaLobby')
          else setView('ninjaGame')
        })
        .catch((e) => {
          if (isNinjaReconnectPermanentFailure(e)) {
            clearNinjaSession()
          }
          setNinjaNotice('未能恢复忍者之夜对局，请重新加入。')
        })
        .finally(() => setRestoring(false))
      return
    }

    if (activeSessionCount > 1) {
      setHomeNotice('检测到多个游戏会话，请从游戏大厅选择需要恢复的对局。')
      setRestoring(false)
      return
    }

    setRestoring(false)
  }, [])

  async function handleRetryRestore() {
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
      saveSession(rid, pid, host, session.reconnectToken)
      setRoomId(rid)
      setPlayerId(pid)
      setFailedInitialRestore(false)
      updateUrlRoom(rid, session.reconnectToken, 'avalon')
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

  function handleEnterLobby(rid: string, pid: string, host: boolean, reconnectToken?: string) {
    setHomeNotice('')
    setFailedInitialRestore(false)
    setRoomId(rid)
    setPlayerId(pid)
    setView('lobby')
    saveSession(rid, pid, host, reconnectToken)
    updateUrlRoom(rid, reconnectToken, 'avalon')
  }

  function handleReconnect(rid: string, pid: string, host: boolean, state: string, reconnectToken?: string) {
    setFailedInitialRestore(false)
    setRoomId(rid)
    setPlayerId(pid)
    saveSession(rid, pid, host, reconnectToken)
    updateUrlRoom(rid, reconnectToken, 'avalon')
    if (state === 'LOBBY') setView('lobby')
    else if (state === 'ROLE_REVEAL') setView('roleReveal')
    else setView('game')
  }

  const handleRemovedFromLobby = useCallback(() => {
    setHomeNotice('你已被移出房间，或房间已解散。可重新加入其他对局。')
    setView('home')
    setRoomId('')
    setPlayerId('')
    clearSession()
    clearUrlParams()
  }, [])

  function wrap(node: ReactNode) {
    return <div className="avalon-app">{node}</div>
  }

  function handleEnterUndercoverLobby(
    rid: string,
    pid: string,
    host: boolean,
    reconnectToken?: string
  ) {
    setUndercoverNotice('')
    setUndercoverRoomId(rid)
    setUndercoverPlayerId(pid)
    setView('undercoverLobby')
    saveUndercoverSession(rid, pid, host, reconnectToken)
    updateUrlRoom(rid, reconnectToken, 'undercover')
  }

  function handleUndercoverReconnect(
    rid: string,
    pid: string,
    host: boolean,
    state: string,
    reconnectToken?: string
  ) {
    setUndercoverRoomId(rid)
    setUndercoverPlayerId(pid)
    setUndercoverNotice('')
    saveUndercoverSession(rid, pid, host, reconnectToken)
    updateUrlRoom(rid, reconnectToken, 'undercover')
    if (state === 'LOBBY') setView('undercoverLobby')
    else setView('undercoverGame')
  }

  const handleRemovedFromUndercoverLobby = useCallback(() => {
    setUndercoverNotice('你已被移出房间，或房间已解散。')
    setView('undercoverHome')
    setUndercoverRoomId('')
    setUndercoverPlayerId('')
    clearUndercoverSession()
    clearUrlParams()
  }, [])

  async function handleAvalonBack() {
    if (view === 'lobby' && roomId && playerId) {
      try {
        await leaveLobby(roomId, playerId)
      } catch {
        // Still return home so user is not stuck
      }
    }
    setHomeNotice('')
    setView('hub')
    setRoomId('')
    setPlayerId('')
    clearSession()
    clearUrlParams()
  }

  async function handleUndercoverBack() {
    if (view === 'undercoverLobby' && undercoverRoomId && undercoverPlayerId) {
      try {
        await leaveUndercoverLobby(undercoverRoomId, undercoverPlayerId)
      } catch {
        // Still return hub so user is not stuck
      }
    }
    setUndercoverNotice('')
    setView('hub')
    setUndercoverRoomId('')
    setUndercoverPlayerId('')
    clearUndercoverSession()
    clearUrlParams()
  }

  function handleEnterNinjaLobby(
    rid: string,
    pid: string,
    host: boolean,
    reconnectToken?: string
  ) {
    setNinjaNotice('')
    setNinjaRoomId(rid)
    setNinjaPlayerId(pid)
    setView('ninjaLobby')
    saveNinjaSession(rid, pid, host, reconnectToken)
    updateUrlRoom(rid, reconnectToken, 'ninja')
  }

  function handleNinjaReconnect(
    rid: string,
    pid: string,
    host: boolean,
    state: string,
    reconnectToken?: string
  ) {
    setNinjaRoomId(rid)
    setNinjaPlayerId(pid)
    setNinjaNotice('')
    saveNinjaSession(rid, pid, host, reconnectToken)
    updateUrlRoom(rid, reconnectToken, 'ninja')
    if (state === 'LOBBY') setView('ninjaLobby')
    else setView('ninjaGame')
  }

  const handleRemovedFromNinjaLobby = useCallback(() => {
    setNinjaNotice('你已被移出房间，或房间已解散。')
    setView('ninjaHome')
    setNinjaRoomId('')
    setNinjaPlayerId('')
    clearNinjaSession()
    clearUrlParams()
  }, [])

  async function handleNinjaBack() {
    if (view === 'ninjaLobby' && ninjaRoomId && ninjaPlayerId) {
      try {
        await leaveNinjaLobby(ninjaRoomId, ninjaPlayerId)
      } catch {
        // Still return hub
      }
    }
    setNinjaNotice('')
    setView('hub')
    setNinjaRoomId('')
    setNinjaPlayerId('')
    clearNinjaSession()
    clearUrlParams()
  }

  if (view === 'lobby') {
    return wrap(
      <LobbyPage
        roomId={roomId}
        playerId={playerId}
        onBack={() => void handleAvalonBack()}
        onRemovedFromLobby={handleRemovedFromLobby}
        onEnterRoleReveal={() => setView('roleReveal')}
      />
    )
  }

  if (view === 'roleReveal') {
    return wrap(
      <RolePage
        roomId={roomId}
        playerId={playerId}
        onContinue={() => setView('game')}
      />
    )
  }

  if (view === 'game') {
    return wrap(
      <GamePage
        roomId={roomId}
        playerId={playerId}
        onPlayAgain={() => void handleAvalonBack()}
        onForceExit={() => void handleAvalonBack()}
        onReturnToLobby={() => setView('lobby')}
      />
    )
  }

  if (view === 'undercoverLobby') {
    return wrap(
      <UndercoverLobbyPage
        roomId={undercoverRoomId}
        playerId={undercoverPlayerId}
        onBack={() => void handleUndercoverBack()}
        onRemovedFromLobby={handleRemovedFromUndercoverLobby}
        onEnterGame={() => setView('undercoverGame')}
      />
    )
  }

  if (view === 'undercoverGame') {
    return wrap(
      <UndercoverGamePage
        roomId={undercoverRoomId}
        playerId={undercoverPlayerId}
        onExit={() => void handleUndercoverBack()}
        onReturnToLobby={() => setView('undercoverLobby')}
      />
    )
  }

  if (view === 'liarsDiceGame') {
    return wrap(
      <LiarsDiceGamePage
        diceCount={liarsDiceCount}
        onDiceCountChange={setLiarsDiceCount}
        onBackToHub={() => setView('hub')}
      />
    )
  }

  if (view === 'ninjaLobby') {
    return wrap(
      <NinjaLobbyPage
        roomId={ninjaRoomId}
        playerId={ninjaPlayerId}
        onBack={() => void handleNinjaBack()}
        onRemovedFromLobby={handleRemovedFromNinjaLobby}
        onEnterGame={() => setView('ninjaGame')}
      />
    )
  }

  if (view === 'ninjaGame') {
    return wrap(
      <NinjaGamePage
        roomId={ninjaRoomId}
        playerId={ninjaPlayerId}
        onExit={() => void handleNinjaBack()}
        onReturnToLobby={() => setView('ninjaLobby')}
      />
    )
  }

  if (restoring) {
    return wrap(
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="flex gap-1.5">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      </div>
    )
  }

  if (view === 'hub') {
    return wrap(
      <GameHubPage
        onEnterAvalon={() => setView('home')}
        onEnterUndercover={() => setView('undercoverHome')}
        onEnterLiarsDice={() => setView('liarsDiceGame')}
        onEnterNinja={() => setView('ninjaHome')}
      />
    )
  }

  if (view === 'undercoverHome') {
    return wrap(
      <UndercoverHomePage
        onBackToHub={() => setView('hub')}
        notice={undercoverNotice}
        onClearNotice={() => setUndercoverNotice('')}
        onEnterLobby={handleEnterUndercoverLobby}
        onReconnect={handleUndercoverReconnect}
      />
    )
  }

  if (view === 'ninjaHome') {
    return wrap(
      <NinjaHomePage
        onBackToHub={() => setView('hub')}
        notice={ninjaNotice}
        onClearNotice={() => setNinjaNotice('')}
        onEnterLobby={handleEnterNinjaLobby}
        onReconnect={handleNinjaReconnect}
      />
    )
  }

  return wrap(
    <HomePage
      onBackToHub={() => setView('hub')}
      notice={homeNotice}
      onClearNotice={() => setHomeNotice('')}
      showRestoreBanner={failedInitialRestore}
      onRetryRestore={handleRetryRestore}
      onEnterLobby={handleEnterLobby}
      onReconnect={handleReconnect}
    />
  )
}
