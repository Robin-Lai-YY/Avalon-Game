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
import {
  clearActiveGame,
  getActiveGame,
  type ActiveGameEntry,
  type ActiveGameType,
} from './services/activeGames'
import { ensureAnonymousAuth } from './services/auth'
import { leaveLobby, reconnectByToken, reconnectByUid, reconnectRoom } from './services/gameEngine'
import {
  leaveUndercoverLobby,
  reconnectUndercoverByToken,
  reconnectUndercoverByUid,
  reconnectUndercoverRoom,
} from './services/undercoverEngine'
import {
  leaveNinjaLobby,
  reconnectNinjaByToken,
  reconnectNinjaByUid,
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

function routeAvalonState(state: string): View {
  if (state === 'LOBBY') return 'lobby'
  if (state === 'ROLE_REVEAL') return 'roleReveal'
  return 'game'
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
  const [hubNotice, setHubNotice] = useState('')
  const [continueLoadingKey, setContinueLoadingKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        await ensureAnonymousAuth()
        if (cancelled) return

        const params = new URLSearchParams(window.location.search)
        const game = params.get('game')?.trim().toLowerCase()
        const urlRoom = params.get('room')?.trim().toUpperCase()
        const urlToken = params.get('token')?.trim()

        // 1) Token deep-link reconnect
        if (urlRoom && urlToken) {
          if (game === 'undercover') {
            try {
              const { roomId: rid, playerId: pid, isHost: host, state, reconnectToken: newToken, seatGeneration } =
                await reconnectUndercoverByToken(urlRoom, urlToken)
              if (cancelled) return
              if (state === 'END') {
                clearUndercoverSession()
                await clearActiveGame('undercover', rid)
                clearUrlParams()
                setUndercoverNotice('上次谁是卧底对局已结束，请创建或加入新房间。')
                setView('undercoverHome')
                return
              }
              saveUndercoverSession(rid, pid, host, newToken, seatGeneration)
              setUndercoverRoomId(rid)
              setUndercoverPlayerId(pid)
              setUndercoverNotice('')
              updateUrlRoom(rid, newToken, 'undercover')
              setView(state === 'LOBBY' ? 'undercoverLobby' : 'undercoverGame')
            } catch (e) {
              if (isUndercoverReconnectPermanentFailure(e)) clearUndercoverSession()
              setUndercoverNotice('卧底重连链接无效或已过期，请重新加入房间。')
              setView('undercoverHome')
            }
            return
          }

          if (game === 'ninja') {
            try {
              const { roomId: rid, playerId: pid, isHost: host, state, reconnectToken: newToken, seatGeneration } =
                await reconnectNinjaByToken(urlRoom, urlToken)
              if (cancelled) return
              if (state === 'GAME_END') {
                clearNinjaSession()
                await clearActiveGame('ninja', rid)
                clearUrlParams()
                setNinjaNotice('上次忍者之夜对局已结束，请创建或加入新房间。')
                setView('ninjaHome')
                return
              }
              saveNinjaSession(rid, pid, host, newToken, seatGeneration)
              setNinjaRoomId(rid)
              setNinjaPlayerId(pid)
              setNinjaNotice('')
              updateUrlRoom(rid, newToken, 'ninja')
              setView(state === 'LOBBY' ? 'ninjaLobby' : 'ninjaGame')
            } catch (e) {
              if (isNinjaReconnectPermanentFailure(e)) clearNinjaSession()
              setNinjaNotice('忍者之夜重连链接无效或已过期，请重新加入房间。')
              setView('ninjaHome')
            }
            return
          }

          try {
            const { roomId: rid, playerId: pid, isHost: host, state, reconnectToken: newToken, seatGeneration } =
              await reconnectByToken(urlRoom, urlToken)
            if (cancelled) return
            if (state === 'GAME_END') {
              clearSession()
              await clearActiveGame('avalon', rid)
              clearUrlParams()
              setHomeNotice('上次阿瓦隆对局已结束，请创建或加入新房间。')
              setView('home')
              return
            }
            saveSession(rid, pid, host, newToken, seatGeneration)
            setRoomId(rid)
            setPlayerId(pid)
            setFailedInitialRestore(false)
            updateUrlRoom(rid, newToken, 'avalon')
            setView(routeAvalonState(state))
          } catch (e) {
            if (isReconnectPermanentFailure(e)) clearSession()
            setFailedInitialRestore(false)
            setHomeNotice('重连链接无效或已过期，请使用新的链接或手动加入。')
            setView('home')
          }
          return
        }

        // 2) Room-only invite: reconnect if this account already has a seat
        if (urlRoom && !urlToken) {
          const inviteGame: ActiveGameType =
            game === 'ninja' ? 'ninja' : game === 'undercover' ? 'undercover' : 'avalon'

          const localMatch =
            inviteGame === 'avalon'
              ? loadSession()?.roomId === urlRoom
                ? loadSession()
                : null
              : inviteGame === 'undercover'
                ? loadUndercoverSession()?.roomId === urlRoom
                  ? loadUndercoverSession()
                  : null
                : loadNinjaSession()?.roomId === urlRoom
                  ? loadNinjaSession()
                  : null

          const indexed = await getActiveGame(inviteGame, urlRoom)

          if (localMatch || indexed) {
            try {
              if (inviteGame === 'undercover') {
                const recon = indexed
                  ? await reconnectUndercoverByUid(urlRoom)
                  : await reconnectUndercoverRoom(urlRoom, localMatch!.playerId)
                if (cancelled) return
                if (recon.state === 'END') {
                  clearUndercoverSession()
                  await clearActiveGame('undercover', urlRoom)
                  clearUrlParams()
                  setUndercoverNotice('上次谁是卧底对局已结束，请创建或加入新房间。')
                  setView('undercoverHome')
                  return
                }
                saveUndercoverSession(
                  recon.roomId,
                  recon.playerId,
                  recon.isHost,
                  recon.reconnectToken ?? localMatch?.reconnectToken,
                  recon.seatGeneration
                )
                setUndercoverRoomId(recon.roomId)
                setUndercoverPlayerId(recon.playerId)
                setUndercoverNotice('')
                updateUrlRoom(recon.roomId, recon.reconnectToken ?? localMatch?.reconnectToken, 'undercover')
                setView(recon.state === 'LOBBY' ? 'undercoverLobby' : 'undercoverGame')
                return
              }
              if (inviteGame === 'ninja') {
                const recon = indexed
                  ? await reconnectNinjaByUid(urlRoom)
                  : await reconnectNinjaRoom(urlRoom, localMatch!.playerId)
                if (cancelled) return
                if (recon.state === 'GAME_END') {
                  clearNinjaSession()
                  await clearActiveGame('ninja', urlRoom)
                  clearUrlParams()
                  setNinjaNotice('上次忍者之夜对局已结束，请创建或加入新房间。')
                  setView('ninjaHome')
                  return
                }
                saveNinjaSession(
                  recon.roomId,
                  recon.playerId,
                  recon.isHost,
                  recon.reconnectToken ?? localMatch?.reconnectToken,
                  recon.seatGeneration
                )
                setNinjaRoomId(recon.roomId)
                setNinjaPlayerId(recon.playerId)
                setNinjaNotice('')
                updateUrlRoom(recon.roomId, recon.reconnectToken ?? localMatch?.reconnectToken, 'ninja')
                setView(recon.state === 'LOBBY' ? 'ninjaLobby' : 'ninjaGame')
                return
              }
              const recon = indexed
                ? await reconnectByUid(urlRoom)
                : await reconnectRoom(urlRoom, localMatch!.playerId)
              if (cancelled) return
              if (recon.state === 'GAME_END') {
                clearSession()
                await clearActiveGame('avalon', urlRoom)
                clearUrlParams()
                setHomeNotice('上次阿瓦隆对局已结束，请创建或加入新房间。')
                setView('home')
                return
              }
              saveSession(
                recon.roomId,
                recon.playerId,
                recon.isHost,
                recon.reconnectToken ?? localMatch?.reconnectToken,
                recon.seatGeneration
              )
              setRoomId(recon.roomId)
              setPlayerId(recon.playerId)
              setFailedInitialRestore(false)
              updateUrlRoom(recon.roomId, recon.reconnectToken ?? localMatch?.reconnectToken, 'avalon')
              setView(routeAvalonState(recon.state))
              return
            } catch {
              // Fall through to join screen without clearing other games' sessions
            }
          }

          if (inviteGame === 'ninja') {
            setNinjaNotice('')
            setView('ninjaHome')
            return
          }
          if (inviteGame === 'undercover') {
            setUndercoverNotice('')
            setView('undercoverHome')
            return
          }
          setHomeNotice('')
          setView('home')
          return
        }

        // 3) Local single-session auto-restore
        const avalonSession = loadSession()
        const undercoverSession = loadUndercoverSession()
        const ninjaSession = loadNinjaSession()
        const activeSessionCount =
          (avalonSession ? 1 : 0) + (undercoverSession ? 1 : 0) + (ninjaSession ? 1 : 0)

        if (avalonSession && activeSessionCount === 1) {
          try {
            const { roomId: rid, playerId: pid, isHost: host, state, reconnectToken, seatGeneration } =
              await reconnectRoom(avalonSession.roomId, avalonSession.playerId)
            if (cancelled) return
            if (state === 'GAME_END') {
              clearSession()
              await clearActiveGame('avalon', rid)
              clearUrlParams()
              setHomeNotice('上次阿瓦隆对局已结束，请创建或加入新房间。')
              setView('home')
              return
            }
            const token = reconnectToken ?? avalonSession.reconnectToken
            saveSession(rid, pid, host, token, seatGeneration)
            setRoomId(rid)
            setPlayerId(pid)
            setFailedInitialRestore(false)
            updateUrlRoom(rid, token, 'avalon')
            setView(routeAvalonState(state))
          } catch (e) {
            if (isReconnectPermanentFailure(e)) {
              clearSession()
              await clearActiveGame('avalon', avalonSession.roomId).catch(() => {})
              setFailedInitialRestore(false)
            } else {
              setFailedInitialRestore(true)
              setView('home')
            }
          }
          return
        }

        if (undercoverSession && activeSessionCount === 1) {
          try {
            const { roomId: rid, playerId: pid, isHost: host, state, reconnectToken, seatGeneration } =
              await reconnectUndercoverRoom(undercoverSession.roomId, undercoverSession.playerId)
            if (cancelled) return
            if (state === 'END') {
              clearUndercoverSession()
              await clearActiveGame('undercover', rid)
              clearUrlParams()
              setUndercoverNotice('上次谁是卧底对局已结束，请创建或加入新房间。')
              setView('undercoverHome')
              return
            }
            const token = reconnectToken ?? undercoverSession.reconnectToken
            saveUndercoverSession(rid, pid, host, token, seatGeneration)
            setUndercoverRoomId(rid)
            setUndercoverPlayerId(pid)
            setUndercoverNotice('')
            updateUrlRoom(rid, token, 'undercover')
            setView(state === 'LOBBY' ? 'undercoverLobby' : 'undercoverGame')
          } catch (e) {
            if (isUndercoverReconnectPermanentFailure(e)) {
              clearUndercoverSession()
              await clearActiveGame('undercover', undercoverSession.roomId).catch(() => {})
            }
            setUndercoverNotice('未能恢复卧底对局，请从大厅继续或重新加入。')
            setView('hub')
          }
          return
        }

        if (ninjaSession && activeSessionCount === 1) {
          try {
            const { roomId: rid, playerId: pid, isHost: host, state, reconnectToken, seatGeneration } =
              await reconnectNinjaRoom(ninjaSession.roomId, ninjaSession.playerId)
            if (cancelled) return
            if (state === 'GAME_END') {
              clearNinjaSession()
              await clearActiveGame('ninja', rid)
              clearUrlParams()
              setNinjaNotice('上次忍者之夜对局已结束，请创建或加入新房间。')
              setView('ninjaHome')
              return
            }
            const token = reconnectToken ?? ninjaSession.reconnectToken
            saveNinjaSession(rid, pid, host, token, seatGeneration)
            setNinjaRoomId(rid)
            setNinjaPlayerId(pid)
            setNinjaNotice('')
            updateUrlRoom(rid, token, 'ninja')
            setView(state === 'LOBBY' ? 'ninjaLobby' : 'ninjaGame')
          } catch (e) {
            if (isNinjaReconnectPermanentFailure(e)) {
              clearNinjaSession()
              await clearActiveGame('ninja', ninjaSession.roomId).catch(() => {})
            }
            setNinjaNotice('未能恢复忍者之夜对局，请从大厅继续或重新加入。')
            setView('hub')
          }
          return
        }

        // 4) Multiple sessions or none → hub (shows activeGames list)
        if (activeSessionCount > 1) {
          setHubNotice('检测到多个进行中的对局，请选择要继续的一局。')
        }
        setView('hub')
      } catch {
        setHubNotice('登录失败，请刷新页面重试。')
        setView('hub')
      } finally {
        if (!cancelled) setRestoring(false)
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRetryRestore() {
    const session = loadSession()
    if (!session) {
      setFailedInitialRestore(false)
      return
    }
    try {
      const { roomId: rid, playerId: pid, isHost: host, state, reconnectToken, seatGeneration } =
        await reconnectRoom(session.roomId, session.playerId)
      const token = reconnectToken ?? session.reconnectToken
      saveSession(rid, pid, host, token, seatGeneration)
      setRoomId(rid)
      setPlayerId(pid)
      setFailedInitialRestore(false)
      updateUrlRoom(rid, token, 'avalon')
      setView(routeAvalonState(state))
    } catch (e) {
      if (isReconnectPermanentFailure(e)) {
        clearSession()
        await clearActiveGame('avalon', session.roomId).catch(() => {})
        setFailedInitialRestore(false)
      }
    }
  }

  async function handleContinueActiveGame(entry: ActiveGameEntry) {
    const key = `${entry.game}_${entry.roomId}`
    setContinueLoadingKey(key)
    setHubNotice('')
    try {
      if (entry.game === 'avalon') {
        const recon = await reconnectRoom(entry.roomId, entry.playerId).catch(() =>
          reconnectByUid(entry.roomId)
        )
        if (recon.state === 'GAME_END') {
          clearSession()
          await clearActiveGame('avalon', entry.roomId)
          setHubNotice('该阿瓦隆对局已结束。')
          return
        }
        saveSession(recon.roomId, recon.playerId, recon.isHost, recon.reconnectToken, recon.seatGeneration)
        setRoomId(recon.roomId)
        setPlayerId(recon.playerId)
        updateUrlRoom(recon.roomId, recon.reconnectToken, 'avalon')
        setView(routeAvalonState(recon.state))
        return
      }
      if (entry.game === 'undercover') {
        const recon = await reconnectUndercoverRoom(entry.roomId, entry.playerId).catch(() =>
          reconnectUndercoverByUid(entry.roomId)
        )
        if (recon.state === 'END') {
          clearUndercoverSession()
          await clearActiveGame('undercover', entry.roomId)
          setHubNotice('该谁是卧底对局已结束。')
          return
        }
        saveUndercoverSession(
          recon.roomId,
          recon.playerId,
          recon.isHost,
          recon.reconnectToken,
          recon.seatGeneration
        )
        setUndercoverRoomId(recon.roomId)
        setUndercoverPlayerId(recon.playerId)
        updateUrlRoom(recon.roomId, recon.reconnectToken, 'undercover')
        setView(recon.state === 'LOBBY' ? 'undercoverLobby' : 'undercoverGame')
        return
      }
      const recon = await reconnectNinjaRoom(entry.roomId, entry.playerId).catch(() =>
        reconnectNinjaByUid(entry.roomId)
      )
      if (recon.state === 'GAME_END') {
        clearNinjaSession()
        await clearActiveGame('ninja', entry.roomId)
        setHubNotice('该忍者之夜对局已结束。')
        return
      }
      saveNinjaSession(
        recon.roomId,
        recon.playerId,
        recon.isHost,
        recon.reconnectToken,
        recon.seatGeneration
      )
      setNinjaRoomId(recon.roomId)
      setNinjaPlayerId(recon.playerId)
      updateUrlRoom(recon.roomId, recon.reconnectToken, 'ninja')
      setView(recon.state === 'LOBBY' ? 'ninjaLobby' : 'ninjaGame')
    } catch (e) {
      await clearActiveGame(entry.game, entry.roomId).catch(() => {})
      setHubNotice(e instanceof Error ? e.message : '无法继续该对局，条目已清除。')
    } finally {
      setContinueLoadingKey(null)
    }
  }

  function handleEnterLobby(
    rid: string,
    pid: string,
    host: boolean,
    reconnectToken?: string,
    seatGeneration?: number
  ) {
    setHomeNotice('')
    setFailedInitialRestore(false)
    setRoomId(rid)
    setPlayerId(pid)
    setView('lobby')
    saveSession(rid, pid, host, reconnectToken, seatGeneration)
    updateUrlRoom(rid, reconnectToken, 'avalon')
  }

  function handleReconnect(
    rid: string,
    pid: string,
    host: boolean,
    state: string,
    reconnectToken?: string,
    seatGeneration?: number
  ) {
    setFailedInitialRestore(false)
    setRoomId(rid)
    setPlayerId(pid)
    saveSession(rid, pid, host, reconnectToken, seatGeneration)
    updateUrlRoom(rid, reconnectToken, 'avalon')
    setView(routeAvalonState(state))
  }

  const handleRemovedFromLobby = useCallback(() => {
    setHomeNotice('你已被移出房间，或房间已解散。可重新加入其他对局。')
    setView('home')
    const rid = roomId
    setRoomId('')
    setPlayerId('')
    clearSession()
    clearUrlParams()
    if (rid) void clearActiveGame('avalon', rid).catch(() => {})
  }, [roomId])

  function wrap(node: ReactNode) {
    return <div className="avalon-app">{node}</div>
  }

  function handleEnterUndercoverLobby(
    rid: string,
    pid: string,
    host: boolean,
    reconnectToken?: string,
    seatGeneration?: number
  ) {
    setUndercoverNotice('')
    setUndercoverRoomId(rid)
    setUndercoverPlayerId(pid)
    setView('undercoverLobby')
    saveUndercoverSession(rid, pid, host, reconnectToken, seatGeneration)
    updateUrlRoom(rid, reconnectToken, 'undercover')
  }

  function handleUndercoverReconnect(
    rid: string,
    pid: string,
    host: boolean,
    state: string,
    reconnectToken?: string,
    seatGeneration?: number
  ) {
    setUndercoverRoomId(rid)
    setUndercoverPlayerId(pid)
    setUndercoverNotice('')
    saveUndercoverSession(rid, pid, host, reconnectToken, seatGeneration)
    updateUrlRoom(rid, reconnectToken, 'undercover')
    if (state === 'LOBBY') setView('undercoverLobby')
    else setView('undercoverGame')
  }

  const handleRemovedFromUndercoverLobby = useCallback(() => {
    setUndercoverNotice('你已被移出房间，或房间已解散。')
    setView('undercoverHome')
    const rid = undercoverRoomId
    setUndercoverRoomId('')
    setUndercoverPlayerId('')
    clearUndercoverSession()
    clearUrlParams()
    if (rid) void clearActiveGame('undercover', rid).catch(() => {})
  }, [undercoverRoomId])

  async function handleAvalonBack() {
    if (view === 'lobby' && roomId && playerId) {
      try {
        await leaveLobby(roomId, playerId)
      } catch {
        // Still return home so user is not stuck
      }
    } else if (roomId) {
      await clearActiveGame('avalon', roomId).catch(() => {})
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
    } else if (undercoverRoomId) {
      await clearActiveGame('undercover', undercoverRoomId).catch(() => {})
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
    reconnectToken?: string,
    seatGeneration?: number
  ) {
    setNinjaNotice('')
    setNinjaRoomId(rid)
    setNinjaPlayerId(pid)
    setView('ninjaLobby')
    saveNinjaSession(rid, pid, host, reconnectToken, seatGeneration)
    updateUrlRoom(rid, reconnectToken, 'ninja')
  }

  function handleNinjaReconnect(
    rid: string,
    pid: string,
    host: boolean,
    state: string,
    reconnectToken?: string,
    seatGeneration?: number
  ) {
    setNinjaRoomId(rid)
    setNinjaPlayerId(pid)
    setNinjaNotice('')
    saveNinjaSession(rid, pid, host, reconnectToken, seatGeneration)
    updateUrlRoom(rid, reconnectToken, 'ninja')
    if (state === 'LOBBY') setView('ninjaLobby')
    else setView('ninjaGame')
  }

  const handleRemovedFromNinjaLobby = useCallback(() => {
    setNinjaNotice('你已被移出房间，或房间已解散。')
    setView('ninjaHome')
    const rid = ninjaRoomId
    setNinjaRoomId('')
    setNinjaPlayerId('')
    clearNinjaSession()
    clearUrlParams()
    if (rid) void clearActiveGame('ninja', rid).catch(() => {})
  }, [ninjaRoomId])

  async function handleNinjaBack() {
    if (view === 'ninjaLobby' && ninjaRoomId && ninjaPlayerId) {
      try {
        await leaveNinjaLobby(ninjaRoomId, ninjaPlayerId)
      } catch {
        // Still return hub
      }
    } else if (ninjaRoomId) {
      await clearActiveGame('ninja', ninjaRoomId).catch(() => {})
    }
    setNinjaNotice('')
    setView('hub')
    setNinjaRoomId('')
    setNinjaPlayerId('')
    clearNinjaSession()
    clearUrlParams()
  }

  function handleAvalonSeatTakenOver() {
    setHomeNotice('座位已在其他设备恢复，本端已退出。用原昵称加入即可再次回到座位。')
    setView('home')
    setRoomId('')
    setPlayerId('')
    clearSession()
    clearUrlParams()
  }

  function handleUndercoverSeatTakenOver() {
    setUndercoverNotice('座位已在其他设备恢复，本端已退出。用原昵称加入即可再次回到座位。')
    setView('undercoverHome')
    setUndercoverRoomId('')
    setUndercoverPlayerId('')
    clearUndercoverSession()
    clearUrlParams()
  }

  function handleNinjaSeatTakenOver() {
    setNinjaNotice('座位已在其他设备恢复，本端已退出。用原昵称加入即可再次回到座位。')
    setView('ninjaHome')
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
        onSeatTakenOver={handleAvalonSeatTakenOver}
      />
    )
  }

  if (view === 'roleReveal') {
    return wrap(
      <RolePage
        roomId={roomId}
        playerId={playerId}
        onContinue={() => setView('game')}
        onSeatTakenOver={handleAvalonSeatTakenOver}
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
        onSeatTakenOver={handleAvalonSeatTakenOver}
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
        onSeatTakenOver={handleUndercoverSeatTakenOver}
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
        onSeatTakenOver={handleUndercoverSeatTakenOver}
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
        onSeatTakenOver={handleNinjaSeatTakenOver}
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
        onSeatTakenOver={handleNinjaSeatTakenOver}
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
        notice={hubNotice}
        onClearNotice={() => setHubNotice('')}
        continueLoadingKey={continueLoadingKey}
        onContinueGame={(entry) => void handleContinueActiveGame(entry)}
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
