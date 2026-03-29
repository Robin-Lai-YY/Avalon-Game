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
      <div className="min-h-dvh flex items-center justify-center p-5">
        <div className="flex gap-1.5">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] flex items-center gap-1 text-slate-400 font-medium text-sm transition-colors active:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          返回
        </button>
      </div>

      <div className="flex flex-col gap-5 stagger-children">
        {/* Room Code Card */}
        <div className="avalon-card p-5">
          <p className="section-label mb-1.5">房间码</p>
          <p className="text-2xl font-mono font-bold text-white tracking-wider" data-testid="room-code">
            {roomId}
          </p>
        </div>

        {/* QR Code */}
        <div className="avalon-card p-4 inline-flex flex-col items-center self-start">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : '')}`}
            alt="Scan to join room"
            width={120}
            height={120}
            className="block rounded-lg"
          />
          <p className="text-[0.6875rem] text-slate-500 mt-2.5 tracking-wide">扫码加入</p>
        </div>

        {/* Player Count & Roles */}
        <div className="avalon-card p-5">
          <h2 className="section-label mb-3">本局人数与角色</h2>
          <p className="text-sm text-slate-300/90 mb-3 leading-relaxed">
            当前进房 <span className="font-semibold text-white">{playerIds.length}</span> 人
            {hasFixedExpected ? (
              <> / 本局设定 <span className="font-semibold text-white">{expectedCount}</span> 人</>
            ) : (
              <span className="text-slate-500">（人满 5～10 且准备即可开局）</span>
            )}
          </p>
          {hasFixedExpected && playerIds.length !== expectedCount && (
            <p className="text-amber-400/90 text-[0.8125rem] mb-3">
              {playerIds.length < expectedCount ? '还差人，可继续分享房间码' : '人数多于设定，请房主提高人数或有人离开后再开'}
            </p>
          )}
          {isHost && (
            <div className="mb-5">
              <p className="text-[0.6875rem] font-medium text-slate-500 mb-2.5">房主：选择本局人数</p>
              <div className="flex flex-wrap gap-2">
                {[5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={settingCount}
                    onClick={() => handlePickCount(n)}
                    className={`min-h-[42px] min-w-[42px] rounded-xl px-3 font-semibold text-sm transition-all duration-200 ${
                      n === expectedCount
                        ? 'btn-primary text-white shadow-md shadow-indigo-500/20'
                        : 'bg-white/[0.04] text-slate-300 border border-white/[0.08] active:bg-white/[0.08]'
                    } disabled:opacity-50`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {countError && <p className="text-red-400/90 text-sm mt-2">{countError}</p>}
            </div>
          )}
          <LobbyRolePreview goodRoles={roleTemplates.good} evilRoles={roleTemplates.evil} />
        </div>

        {/* Player List */}
        <div className="avalon-card overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <h2 className="section-label">玩家列表</h2>
            <span className="text-[0.6875rem] text-slate-500">{playerIds.length} 人</span>
          </div>
          <div className="px-5 pb-4">
            {isHost && (
              <p className="text-[0.6875rem] text-slate-500 mb-2.5">房主可将占坑或离线的玩家踢出</p>
            )}
            {kickError && <p className="text-red-400/90 text-sm mb-2">{kickError}</p>}
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

        {/* Ready Button */}
        {readyError && <p className="text-red-400/90 text-sm">{readyError}</p>}
        <button
          type="button"
          onClick={handleReady}
          disabled={!room.players?.[playerId]}
          className={`w-full min-h-[48px] rounded-[0.875rem] px-4 py-3 font-semibold text-white transition-all duration-300 disabled:opacity-50 ${
            myReady
              ? 'bg-white/[0.06] border border-white/[0.1]'
              : 'btn-primary'
          }`}
        >
          {myReady ? '取消准备' : '准备'}
        </button>

        {/* Start Game */}
        {startError && <p className="text-red-400/90 text-sm">{startError}</p>}
        {isHost && (
          <>
            {!allReady && hasFixedExpected && playerIds.length === expectedCount && notReadyNames.length > 0 && (
              <p className="text-amber-400/80 text-[0.8125rem]">等待准备：{notReadyNames.join('、')}</p>
            )}
            {!allReady && hasFixedExpected && playerIds.length !== expectedCount && (
              <p className="text-amber-400/80 text-[0.8125rem]">
                需 {expectedCount} 人齐且全员准备后才能开始（当前 {playerIds.length} 人）
              </p>
            )}
            {!allReady && !hasFixedExpected && playerIds.length < 5 && (
              <p className="text-amber-400/80 text-[0.8125rem]">至少 5 人才能开始（当前 {playerIds.length} 人）</p>
            )}
            {!allReady && !hasFixedExpected && playerIds.length >= 5 && notReadyNames.length > 0 && (
              <p className="text-amber-400/80 text-[0.8125rem]">等待准备：{notReadyNames.join('、')}</p>
            )}
            <button
              type="button"
              onClick={handleStartGame}
              disabled={starting || !allReady}
              className="w-full min-h-[48px] btn-success text-white rounded-[0.875rem] px-4 py-3 font-semibold disabled:opacity-40 transition-opacity text-[0.9375rem]"
            >
              {starting ? '开始中…' : allReady ? '开始游戏' : '等待人满且全员准备'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
