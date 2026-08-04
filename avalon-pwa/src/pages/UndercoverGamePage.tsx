import { useEffect, useMemo, useRef, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import {
  advanceTieSpeakToVoting,
  advanceToUndercoverVoting,
  restartUndercoverToLobby,
  resolveUndercoverVoteRound,
  submitUndercoverVote,
} from '../services/undercoverEngine'
import type { UndercoverRole, UndercoverRoom } from '../types/undercover'
import { UndercoverRulesSheet } from '../components/UndercoverRulesSheet'
import { useSeatPresence } from '../hooks/useSeatPresence'
import { loadUndercoverSession } from '../utils/undercoverSessionStorage'

type UndercoverGamePageProps = {
  roomId: string
  playerId: string
  onExit: () => void
  onReturnToLobby?: () => void
  onSeatTakenOver?: () => void
}

function winnerLabel(winner: UndercoverRoom['resultWinner']) {
  if (winner === 'CIVILIAN_WIN') return '平民胜利'
  if (winner === 'UNDERCOVER_WIN') return '卧底胜利'
  if (winner === 'BLANK_WIN') return '白板胜利'
  return '对局结束'
}

function roleLabel(role: UndercoverRole | '') {
  if (role === 'civilian') return '平民'
  if (role === 'undercover') return '卧底'
  if (role === 'blank') return '白板'
  return '未知'
}

export function UndercoverGamePage({
  roomId,
  playerId,
  onExit,
  onReturnToLobby,
  onSeatTakenOver,
}: UndercoverGamePageProps) {
  const [room, setRoom] = useState<UndercoverRoom | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [wordRevealed, setWordRevealed] = useState(false)
  const seatGeneration = loadUndercoverSession()?.seatGeneration ?? 0

  useSeatPresence({
    roomPath: `undercoverRooms/${roomId}`,
    playerId,
    seatGeneration,
    onSeatTakenOver: () => onSeatTakenOver?.(),
  })
  const [rulesOpen, setRulesOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const roomRef = ref(db, `undercoverRooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.exists() ? (snapshot.val() as UndercoverRoom) : null)
    })
    return () => unsubscribe()
  }, [roomId])

  useEffect(() => {
    // New round starts with word hidden to reduce窥屏 risk.
    setWordRevealed(false)
  }, [room?.round, room?.state])

  useEffect(() => {
    if (!menuOpen) return
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [menuOpen])

  useEffect(() => {
    if (room?.state === 'LOBBY') {
      onReturnToLobby?.()
    }
  }, [room?.state, onReturnToLobby])

  const playerIds = useMemo(() => Object.keys(room?.players ?? {}).sort(), [room?.players])
  const me = room?.players?.[playerId]
  const isHost = room?.hostId === playerId
  const aliveIds = playerIds.filter((id) => room?.players[id]?.isAlive)
  const tieSet = new Set(room?.tieCandidates ?? [])
  const inTieVoting = (room?.state === 'VOTING') && tieSet.size > 0
  const myVoteTarget = room?.votes?.[playerId]
  const myWordLabel =
    me?.word === null
      ? '白板'
      : typeof me?.word === 'string' && me.word.trim()
        ? me.word
        : '白板'
  const eliminatedName = room?.lastEliminatedId
    ? room.players[room.lastEliminatedId]?.name ?? room.lastEliminatedId
    : ''
  const eliminatedRole = room?.lastEliminatedRole ?? ''
  const eliminatedRoleText = roleLabel(eliminatedRole)
  const eliminatedTone =
    eliminatedRole === 'undercover'
      ? 'text-red-300 border-red-500/25 bg-red-950/30'
      : eliminatedRole === 'blank'
        ? 'text-amber-300 border-amber-500/25 bg-amber-950/30'
        : 'text-slate-200 border-slate-500/20 bg-slate-900/30'

  async function handleVote(targetId: string) {
    if (!room) return
    setLoading(true)
    setError('')
    try {
      await submitUndercoverVote(roomId, playerId, targetId)
      await resolveUndercoverVoteRound(roomId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '投票失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleStartVoting() {
    setLoading(true)
    setError('')
    try {
      await advanceToUndercoverVoting(roomId, playerId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '推进流程失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleStartTieVoting() {
    setLoading(true)
    setError('')
    try {
      await advanceTieSpeakToVoting(roomId, playerId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '推进流程失败')
    } finally {
      setLoading(false)
    }
  }

  async function handlePlayAgain() {
    if (!isHost) return
    setRestarting(true)
    setError('')
    try {
      await restartUndercoverToLobby(roomId, playerId)
      onReturnToLobby?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '再来一局失败')
    } finally {
      setRestarting(false)
    }
  }

  function handleExitGameConfirm() {
    if (!window.confirm('确定要退出卧底游戏吗？')) return
    onExit()
  }

  if (!room || !me) {
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
    <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-4 animate-page-enter">
      <div className="flex items-center justify-end">
        <div ref={menuRef} className="flex items-center gap-1.5 relative">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 active:text-slate-200 transition-all duration-200"
          >
            规则
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              menuOpen ? 'bg-white/[0.06] text-slate-200' : 'text-slate-400 active:text-slate-200'
            }`}
            aria-label="更多操作"
          >
            <span className="text-base leading-none">⋯</span>
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1.5 min-w-[132px] rounded-xl border border-white/[0.08] bg-[#0c101e]/95 backdrop-blur-sm p-1.5 z-20 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  handleExitGameConfirm()
                }}
                className="w-full text-left min-h-[34px] px-2.5 rounded-lg text-xs font-medium text-slate-300/90 active:bg-white/[0.05]"
              >
                退出游戏
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="avalon-card p-4 border border-indigo-500/25 animate-scale-bounce">
        <p className="section-label mb-1">当前回合</p>
        <p className="text-2xl font-bold text-indigo-200 tracking-wide">第 {room.round} 轮</p>
      </div>

      <div className="avalon-card p-4">
        <p className="section-label mb-2">你的词语</p>
        <button
          type="button"
          onClick={() => setWordRevealed((v) => !v)}
          className="w-full min-h-[52px] rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition-colors active:bg-white/[0.08]"
        >
          <p className="text-[0.6875rem] text-slate-500 mb-1">{wordRevealed ? '点击隐藏' : '点击揭露'}</p>
          <p className="text-lg font-semibold text-white tracking-wide">
            {wordRevealed ? myWordLabel : '••••••'}
          </p>
        </button>
        <p className="text-xs text-slate-500 mt-1">线下发言阶段请自行描述，不展示身份阵营。</p>
      </div>

      {room.lastEliminatedId && (
        <div
          key={`${room.round}-${room.lastEliminatedId}`}
          className={`avalon-card p-4 border animate-result-reveal ${eliminatedTone}`}
        >
          <p className="section-label mb-1">本轮淘汰</p>
          <p className="text-lg font-semibold">
            {eliminatedName} <span className="text-sm opacity-90">（{eliminatedRoleText}）</span>
          </p>
        </div>
      )}

      {room.state === 'WORD_REVEAL' && (
        <div className="avalon-card p-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            所有人已查看身份和词语后，由房主点击“进入投票阶段”。
          </p>
          {isHost && (
            <button
              type="button"
              onClick={handleStartVoting}
              disabled={loading}
              className="w-full mt-3 min-h-[44px] btn-primary rounded-xl font-semibold disabled:opacity-50"
            >
              进入投票阶段
            </button>
          )}
        </div>
      )}

      {room.state === 'TIE_SPEAK' && (
        <div className="avalon-card p-4">
          <p className="text-sm text-amber-300">平票：请以下玩家补充发言后再复投</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {room.tieCandidates.map((id) => (
              <span key={id} className="text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-200">
                {room.players[id]?.name ?? id}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            当前平票复投次数：{room.tieRevoteCount}/{room.maxTieRevotes}
          </p>
          {isHost && (
            <button
              type="button"
              onClick={handleStartTieVoting}
              disabled={loading}
              className="w-full mt-3 min-h-[44px] btn-primary rounded-xl font-semibold disabled:opacity-50"
            >
              补充发言完成，开始复投
            </button>
          )}
        </div>
      )}

      {room.state === 'VOTING' && (
        <div className="avalon-card p-4">
          <p className="section-label mb-2">{inTieVoting ? '平票候选复投' : '投票阶段'}</p>
          <p className="text-xs text-slate-400 mb-3">
            {Object.keys(room.votes ?? {}).length}/{aliveIds.length} 已投票
          </p>
          <div className="flex flex-col gap-2">
            {aliveIds
              .filter((id) => id !== playerId)
              .map((id) => {
              const disabled =
                loading ||
                (inTieVoting && !tieSet.has(id))
              const selected = myVoteTarget === id
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleVote(id)}
                  className={`min-h-[48px] flex items-center justify-between rounded-xl px-3 border transition-colors ${
                    selected
                      ? 'border-indigo-400/60 bg-indigo-500/15'
                      : 'border-white/[0.08] bg-white/[0.02] disabled:opacity-40'
                  }`}
                >
                  <span className="text-sm text-slate-200">{room.players[id]?.name ?? id}</span>
                  {selected && <span className="text-xs text-indigo-300">已投</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {room.state === 'END' && (
        <div className="avalon-card p-5">
          <p className="text-xl font-semibold text-white">{winnerLabel(room.resultWinner)}</p>
          {room.resultReason === 'RANDOM_TIE_BREAK' && (
            <p className="text-xs text-amber-300 mt-1">平票超过阈值，已随机淘汰平票候选人。</p>
          )}
          <div className="divider my-3" />
          <div className="flex flex-col gap-2">
            {playerIds.map((id) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span className={room.players[id]?.isAlive ? 'text-slate-200' : 'text-slate-500'}>
                  {room.players[id]?.name ?? id}
                </span>
                <span className="text-slate-300">{roleLabel(room.players[id]?.role ?? '')}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePlayAgain}
              disabled={!isHost || restarting}
              className="min-h-[44px] rounded-xl btn-primary font-semibold disabled:opacity-50"
            >
              {!isHost ? '仅房主可再来一局' : restarting ? '重置中…' : '再来一局'}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="min-h-[44px] rounded-xl bg-white/[0.04] border border-white/[0.08] font-semibold"
            >
              返回游戏大厅
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400/90">{error}</p>}
      <UndercoverRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}
