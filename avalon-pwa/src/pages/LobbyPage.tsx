import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import {
  getRoleTemplates,
  kickPlayerFromLobby,
  setExpectedPlayerCount,
  setPlayerReady,
  startGame,
} from '../services/gameEngine'
import { LobbyRolePreview } from '../components/LobbyRolePreview'
import { PlayerList } from '../components/PlayerList'
import type { Player } from '../components/PlayerList'

type RoomData = {
  hostId: string
  state: string
  players: Record<string, Player>
  expectedPlayerCount?: number
}

type LobbyPageProps = {
  roomId: string
  playerId: string
  onBack: () => void
  /** Called when current user was removed from the room (kicked) or the room was deleted while in lobby. */
  onRemovedFromLobby?: () => void
  onEnterRoleReveal?: () => void
}

export function LobbyPage({ roomId, playerId, onBack, onRemovedFromLobby, onEnterRoleReveal }: LobbyPageProps) {
  const [room, setRoom] = useState<RoomData | null>(null)
  const [startError, setStartError] = useState('')
  const [starting, setStarting] = useState(false)
  const [countError, setCountError] = useState('')
  const [settingCount, setSettingCount] = useState(false)
  const [kickError, setKickError] = useState('')
  const [kickingId, setKickingId] = useState<string | null>(null)
  const [readyError, setReadyError] = useState('')
  const wasInLobbyWithSelf = useRef(false)

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        setRoom(null)
        return
      }
      setRoom(snapshot.val())
    })
    return () => unsubscribe()
  }, [roomId])

  useLayoutEffect(() => {
    if (!room) {
      if (wasInLobbyWithSelf.current) {
        wasInLobbyWithSelf.current = false
        onRemovedFromLobby?.()
      }
      return
    }
    if (room.state !== 'LOBBY') {
      wasInLobbyWithSelf.current = false
      return
    }
    const me = room.players?.[playerId]
    if (me) {
      wasInLobbyWithSelf.current = true
      return
    }
    if (wasInLobbyWithSelf.current) {
      wasInLobbyWithSelf.current = false
      onRemovedFromLobby?.()
    }
  }, [room, playerId, onRemovedFromLobby])

  useEffect(() => {
    if (room?.state === 'ROLE_REVEAL') onEnterRoleReveal?.()
  }, [room?.state, onEnterRoleReveal])

  const isHost = room != null && room.hostId === playerId

  const players = room?.players ?? {}
  const playerIds = Object.keys(players).sort()
  const rawExpected = room?.expectedPlayerCount
  const hasFixedExpected =
    rawExpected != null && String(rawExpected).trim() !== ''
  const expectedCount = hasFixedExpected ? Number(rawExpected) : 5
  const previewCount = hasFixedExpected
    ? expectedCount
    : Math.min(Math.max(playerIds.length || 5, 5), 10)
  const allReady =
    playerIds.length >= 5 &&
    playerIds.length <= 10 &&
    playerIds.every((id) => players[id]?.ready === true) &&
    (hasFixedExpected ? playerIds.length === expectedCount : true)
  const notReadyNames = playerIds.filter((id) => !players[id]?.ready).map((id) => players[id]?.name ?? id)
  const myReady = players[playerId]?.ready ?? false
  const roleTemplates = getRoleTemplates(previewCount)

  function handleReady() {
    setReadyError('')
    setPlayerReady(roomId, playerId, !myReady).catch((e) => {
      setReadyError(e instanceof Error ? e.message : '操作失败')
    })
  }

  async function handleStartGame() {
    if (!isHost) return
    setStartError('')
    setStarting(true)
    try {
      await startGame(roomId)
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Failed to start game')
    } finally {
      setStarting(false)
    }
  }

  async function handlePickCount(n: number) {
    if (!isHost) return
    setCountError('')
    setSettingCount(true)
    try {
      await setExpectedPlayerCount(roomId, playerId, n)
    } catch (e) {
      setCountError(e instanceof Error ? e.message : '设置失败')
    } finally {
      setSettingCount(false)
    }
  }

  async function handleKick(targetId: string) {
    if (!isHost) return
    setKickError('')
    setKickingId(targetId)
    try {
      await kickPlayerFromLobby(roomId, playerId, targetId)
    } catch (e) {
      setKickError(e instanceof Error ? e.message : '踢人失败')
    } finally {
      setKickingId(null)
    }
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <p className="text-slate-400">加载房间…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col p-5 max-w-md mx-auto animate-fade-in gap-6">
      <button
        type="button"
        onClick={onBack}
        className="self-start min-h-[44px] flex items-center text-blue-400 font-medium -ml-1"
      >
        ← 返回
      </button>
      <div className="avalon-card p-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">房间码</p>
        <p className="text-xl font-mono font-bold text-slate-100" data-testid="room-code">
          {roomId}
        </p>
      </div>
      <div className="p-3 avalon-card inline-block self-start">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : '')}`}
          alt="Scan to join room"
          width={120}
          height={120}
          className="block rounded-lg"
        />
        <p className="text-xs text-slate-500 mt-2">扫码加入</p>
      </div>
      <div className="avalon-card p-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">本局人数与角色</h2>
        <p className="text-sm text-slate-300 mb-3">
          当前进房 {playerIds.length} 人
          {hasFixedExpected ? (
            <>
              {' '}
              / 本局设定 <span className="font-semibold text-slate-100">{expectedCount}</span> 人
            </>
          ) : (
            <span className="text-slate-500">（旧房间：人满 5～10 且准备即可开局）</span>
          )}
          {hasFixedExpected && playerIds.length !== expectedCount && (
            <span className="text-amber-400 block mt-1">
              {playerIds.length < expectedCount ? '还差人，可继续分享房间码' : '人数多于设定，请房主提高人数或有人离开后再开'}
            </span>
          )}
        </p>
        {isHost && (
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500 mb-2">房主：选择本局人数</p>
            <div className="flex flex-wrap gap-2">
              {[5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={settingCount}
                  onClick={() => handlePickCount(n)}
                  className={`min-h-[44px] min-w-[44px] rounded-xl px-3 font-semibold transition-colors ${
                    n === expectedCount
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-200 border border-slate-600 active:bg-slate-700'
                  } disabled:opacity-50`}
                >
                  {n}
                </button>
              ))}
            </div>
            {countError && <p className="text-red-400 text-sm mt-2">{countError}</p>}
          </div>
        )}
        <LobbyRolePreview goodRoles={roleTemplates.good} evilRoles={roleTemplates.evil} />
      </div>
      <div className="avalon-card overflow-hidden">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide px-4 pt-4 pb-2">玩家列表</h2>
        <div className="px-4 pb-4">
          {isHost && (
            <p className="text-xs text-slate-500 mb-2">房主可将占坑或离线的玩家踢出，被踢者需重新加入房间。</p>
          )}
          {kickError && <p className="text-red-400 text-sm mb-2">{kickError}</p>}
          <PlayerList
            players={room.players ?? {}}
            hostId={room.hostId}
            canKick={isHost}
            viewerPlayerId={playerId}
            onKick={handleKick}
            kickingId={kickingId}
          />
        </div>
      </div>
      {readyError && <p className="text-red-400 text-sm">{readyError}</p>}
      <button
        type="button"
        onClick={handleReady}
        disabled={!room.players?.[playerId]}
        className={`w-full min-h-[48px] rounded-xl px-4 py-3 font-semibold ${myReady ? 'bg-slate-600' : 'bg-blue-600'} text-white active:opacity-90 transition-opacity disabled:opacity-50`}
      >
        {myReady ? '取消准备' : '准备'}
      </button>
      {startError && <p className="text-red-400 text-sm">{startError}</p>}
      {isHost && (
        <>
          {!allReady && hasFixedExpected && playerIds.length === expectedCount && notReadyNames.length > 0 && (
            <p className="text-amber-400 text-sm">等待准备：{notReadyNames.join('、')}</p>
          )}
          {!allReady && hasFixedExpected && playerIds.length !== expectedCount && (
            <p className="text-amber-400 text-sm">
              需 {expectedCount} 人齐且全员准备后才能开始（当前 {playerIds.length} 人）
            </p>
          )}
          {!allReady && !hasFixedExpected && playerIds.length < 5 && (
            <p className="text-amber-400 text-sm">至少 5 人才能开始（当前 {playerIds.length} 人）</p>
          )}
          {!allReady && !hasFixedExpected && playerIds.length >= 5 && notReadyNames.length > 0 && (
            <p className="text-amber-400 text-sm">等待准备：{notReadyNames.join('、')}</p>
          )}
          <button
            type="button"
            onClick={handleStartGame}
            disabled={starting || !allReady}
            className="w-full min-h-[48px] bg-emerald-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
          >
            {starting ? '开始中…' : allReady ? '开始游戏' : '等待人满且全员准备'}
          </button>
        </>
      )}
    </div>
  )
}
