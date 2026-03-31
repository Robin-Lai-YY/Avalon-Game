import { useEffect, useRef, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import {
  ackRoundResult,
  abortToLobby,
  isEvilRole,
  resolveMissionResult,
  resolveTeamVote,
  saveTeam,
  submitAssassinChoice,
  submitMissionVote,
  submitVote,
} from '../services/gameEngine'
import { TeamSelector } from '../components/TeamSelector'
import { VotePanel } from '../components/VotePanel'
import { MissionPanel } from '../components/MissionPanel'
import { AssassinPanel } from '../components/AssassinPanel'
import { RolePeekToggle } from '../components/RolePeekToggle'
import { VoteHistoryPanel } from '../components/VoteHistoryPanel'
import { GameRulesSheet } from '../components/GameRulesSheet'
import { ResultPage } from './ResultPage'
import { getMissionTeamSize } from '../utils/missionRules'

type RoomData = {
  hostId?: string
  state: string
  round: number
  leaderIndex: number
  players: Record<string, { name: string }>
  roles?: Record<string, string>
  team?: string[] | Record<string, string>
  votes?: Record<string, 'approve' | 'reject'>
  missionVotes?: Record<string, 'success' | 'fail'>
  missionSuccess?: boolean
  score?: { good: number; evil: number }
  history?: Array<{ round: number; success: boolean; successCount?: number; failCount?: number }>
  teamVoteHistory?: Array<{
    round: number
    leaderIndex: number
    teamIds: string[]
    votes: Record<string, 'approve' | 'reject'>
    result: 'approved' | 'rejected'
  }>
  roundResultAck?: Record<string, boolean>
  consecutiveRejects?: number
}

type GamePageProps = {
  roomId: string
  playerId: string
  onPlayAgain?: () => void
  onForceExit?: () => void
  onReturnToLobby?: () => void
}

export function GamePage({ roomId, playerId, onPlayAgain, onForceExit, onReturnToLobby }: GamePageProps) {
  const [room, setRoom] = useState<RoomData | null>(null)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [roundResultSaving, setRoundResultSaving] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [abortError, setAbortError] = useState('')
  const [aborting, setAborting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.val())
    })
    return () => unsubscribe()
  }, [roomId])

  useEffect(() => {
    if (room?.state === 'LOBBY') {
      onReturnToLobby?.()
    }
  }, [room?.state, onReturnToLobby])

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

  const players = room.players ?? {}
  const playerOrder = Object.keys(players).sort()
  const leaderIndex = Number(room.leaderIndex) ?? 0
  const round = Number(room.round) ?? 1
  const teamSize = getMissionTeamSize(round, playerOrder.length)
  const isLeader = playerOrder[leaderIndex] === playerId
  const score = room.score ?? { good: 0, evil: 0 }
  const consecutiveRejects = Number(room.consecutiveRejects) || 0
  const myRole = room.roles?.[playerId] ?? ''
  const isHost = room.hostId === playerId

  const scoreBar = (
    <div className="avalon-card p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-400" />
        <span className="text-sm font-semibold text-blue-300">{score.good}</span>
      </div>
      <div className="flex-1 mx-4 h-1 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
          style={{ width: `${((score.good) / Math.max(score.good + score.evil, 1)) * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-red-300">{score.evil}</span>
        <span className="w-2 h-2 rounded-full bg-red-400" />
      </div>
    </div>
  )

  const voteHistoryEl = (
    <VoteHistoryPanel
      teamVoteHistory={room.teamVoteHistory ?? []}
      missionHistory={(room.history ?? []).map((h) => ({
        round: h.round,
        success: h.success,
        successCount: h.successCount,
        failCount: h.failCount,
      }))}
      players={players}
      playerOrder={playerOrder}
    />
  )
  const rulesEntryButton = (
    <button
      type="button"
      onClick={() => setRulesOpen(true)}
      className="min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 active:text-slate-200 transition-all duration-200"
    >
      <span className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-50">
          <path d="M3.5 2h5a1.5 1.5 0 011.5 1.5v8a.5.5 0 01-.8.4L6.5 10H3.5A1.5 1.5 0 012 8.5v-5A1.5 1.5 0 013.5 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4.5 5h3M4.5 7h2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        查看规则
      </span>
    </button>
  )
  const topTools = (
    <div className="mb-1 flex items-start justify-between gap-2">
      <RolePeekToggle room={room} playerId={playerId} />
      <div ref={menuRef} className="shrink-0 flex items-center gap-1.5 relative">
        {rulesEntryButton}
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
          <div className="absolute top-full right-0 mt-1.5 min-w-[148px] rounded-xl border border-white/[0.08] bg-[#0c101e]/95 backdrop-blur-sm p-1.5 z-20 shadow-xl">
            {abortError && <p className="px-2 py-1 text-[0.6875rem] text-red-400/90">{abortError}</p>}
            {isHost && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  void handleAbortToLobby()
                }}
                disabled={aborting}
                className="w-full text-left min-h-[34px] px-2.5 rounded-lg text-xs font-medium text-amber-300/90 bg-amber-500/10 border border-amber-500/25 disabled:opacity-50"
              >
                {aborting ? '结束中…' : '结束本局'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                handleForceExit()
              }}
              className="w-full text-left min-h-[34px] px-2.5 rounded-lg text-xs font-medium text-slate-300/90 active:bg-white/[0.05]"
            >
              退出游戏
            </button>
          </div>
        )}
      </div>
    </div>
  )

  function teamIdsFromRoom(r: RoomData): string[] {
    const t = r.team
    if (Array.isArray(t)) return t
    if (t && typeof t === 'object') {
      const keys = Object.keys(t).sort((a, b) => Number(a) - Number(b))
      return keys.map((k) => (t as Record<string, string>)[k]).filter(Boolean)
    }
    return []
  }

  async function handleVote(vote: 'approve' | 'reject') {
    await submitVote(roomId, playerId, vote)
    await resolveTeamVote(roomId)
  }

  async function handleMissionVote(vote: 'success' | 'fail') {
    await submitMissionVote(roomId, playerId, vote)
    await resolveMissionResult(roomId)
  }

  async function handleAbortToLobby() {
    if (!isHost) return
    const confirmed = window.confirm('结束当前对局并返回大厅？所有人会回到准备状态。')
    if (!confirmed) return
    setAbortError('')
    setAborting(true)
    try {
      await abortToLobby(roomId, playerId)
    } catch (e) {
      setAbortError(e instanceof Error ? e.message : '结束本局失败')
    } finally {
      setAborting(false)
    }
  }

  function handleForceExit() {
    const confirmed = window.confirm('退出并清除本机重连记录？你将返回首页。')
    if (!confirmed) return
    onForceExit?.()
  }

  if (room.state === 'MISSION_VOTING') {
    const teamIds = teamIdsFromRoom(room)
    const isOnMission = teamIds.includes(playerId)
    const myMissionVote = room.missionVotes?.[playerId] ?? null
    const myRole = room.roles?.[playerId] ?? ''
    return (
      <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-5 animate-page-enter">
        {topTools}
        {scoreBar}
        {voteHistoryEl}
        <MissionPanel
          isOnMission={isOnMission}
          myVote={myMissionVote}
          canVoteFail={isEvilRole(myRole)}
          onVote={handleMissionVote}
        />
        <GameRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} currentRole={myRole} />
      </div>
    )
  }

  if (room.state === 'ROUND_RESULT') {
    const success = room.missionSuccess === true
    const acks = room.roundResultAck ?? {}
    const playerIds = Object.keys(room.players ?? {}).sort()
    const ackCount = playerIds.filter((id) => acks[id] === true).length
    const totalCount = playerIds.length
    const iHaveAcked = acks[playerId] === true
    return (
      <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-5">
        {topTools}
        {scoreBar}
        {voteHistoryEl}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
          <span
            className={`absolute top-0 bottom-0 w-[44%] ${
              success
                ? 'bg-gradient-to-r from-transparent via-emerald-300/16 to-transparent animate-screen-sweep-good'
                : 'bg-gradient-to-l from-transparent via-red-300/14 to-transparent animate-screen-sweep-evil'
            }`}
          />
        </div>
        <div
          className={`relative overflow-hidden rounded-2xl p-6 text-center animate-result-reveal ${
            success
              ? 'bg-gradient-to-b from-emerald-950/40 to-transparent border border-emerald-500/20 avalon-card-glow-good animate-success-pulse'
              : 'bg-gradient-to-b from-red-950/40 to-transparent border border-red-500/20 avalon-card-glow-evil animate-fail-shake animate-impact-shake'
          }`}
          style={{ backdropFilter: 'blur(16px)' }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
            <span
              className={`absolute inset-2 rounded-2xl border ${
                success ? 'border-emerald-300/35 animate-burst-good' : 'border-red-300/30 animate-burst-evil'
              }`}
            />
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`absolute w-1.5 h-1.5 rounded-full ${
                  success ? 'bg-emerald-300/80 animate-spark-float' : 'bg-red-300/80 animate-ember-fall'
                }`}
                style={{
                  left: `${18 + i * 16}%`,
                  bottom: success ? '28%' : undefined,
                  top: success ? undefined : '20%',
                  animationDelay: `${i * 70}ms`,
                }}
              />
            ))}
          </div>
          <div className={`text-4xl mb-2 ${success ? 'animate-win-glow-good' : 'animate-win-glow-evil'}`}>
            {success ? '✦' : '✧'}
          </div>
          <p className={`text-xl font-bold ${success ? 'text-emerald-300' : 'text-red-300'}`}>
            {success ? '任务成功' : '任务失败'}
          </p>
          <p className={`mt-1 text-sm ${success ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
            {success ? 'Mission Success' : 'Mission Failed'}
          </p>
        </div>

        {iHaveAcked ? (
          <div className="avalon-card p-4 text-center">
            <p className="font-medium text-slate-300 text-sm">已确认，等待其他人…</p>
            <p className="text-xs text-slate-500 mt-1">{ackCount}/{totalCount} 已点继续</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={async () => {
              setRoundResultSaving(true)
              try {
                await ackRoundResult(roomId, playerId)
              } finally {
                setRoundResultSaving(false)
              }
            }}
            disabled={roundResultSaving}
            className="w-full min-h-[48px] btn-primary px-4 py-3 font-semibold disabled:opacity-50 text-[0.9375rem]"
          >
            {roundResultSaving ? '提交中…' : '继续'}
          </button>
        )}
        <GameRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} currentRole={myRole} />
      </div>
    )
  }

  if (room.state === 'GAME_END') {
    return <ResultPage roomId={roomId} onPlayAgain={onPlayAgain ?? (() => {})} />
  }

  if (room.state === 'ASSASSINATION') {
    const roles = room.roles ?? {}
    const assassinId = playerOrder.find((id) => roles[id] === 'ASSASSIN') ?? ''
    const targetIds = playerOrder.filter((id) => id !== assassinId)
    const isAssassin = roles[playerId] === 'ASSASSIN'
    return (
      <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-5 animate-page-enter">
        {topTools}
        {scoreBar}
        {voteHistoryEl}
        <AssassinPanel
          assassinId={assassinId}
          players={players}
          targetIds={targetIds}
          onConfirm={(targetId) => submitAssassinChoice(roomId, playerId, targetId)}
          isAssassin={isAssassin}
        />
        <GameRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} currentRole={myRole} />
      </div>
    )
  }

  if (room.state === 'TEAM_VOTING') {
    const teamIds = teamIdsFromRoom(room)
    const myVote = room.votes?.[playerId] ?? null
    return (
      <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-5 animate-page-enter">
        {topTools}
        {scoreBar}
        {voteHistoryEl}
        <VotePanel
          teamIds={teamIds}
          players={players}
          myVote={myVote}
          onVote={handleVote}
          consecutiveRejects={consecutiveRejects}
        />
        <GameRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} currentRole={myRole} />
      </div>
    )
  }

  if (room.state !== 'TEAM_SELECTION') {
    return (
      <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-5">
        {topTools}
        {voteHistoryEl}
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-slate-500 text-sm">State: {room.state}</p>
        </div>
        <GameRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} currentRole={myRole} />
      </div>
    )
  }

  async function handleConfirmTeam(selectedIds: string[]) {
    setSaveError('')
    setSaving(true)
    try {
      await saveTeam(roomId, playerId, selectedIds)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save team')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-5 animate-page-enter"
      data-testid={isLeader ? 'team-selector-leader' : 'team-selector'}
    >
      {topTools}
      {scoreBar}
      {voteHistoryEl}
      {saveError && <p className="text-red-400/90 text-sm">{saveError}</p>}
      <TeamSelector
        playerOrder={playerOrder}
        players={players}
        leaderIndex={leaderIndex}
        round={round}
        teamSize={teamSize}
        onConfirm={handleConfirmTeam}
        disabled={!isLeader || saving}
        consecutiveRejects={consecutiveRejects}
      />
      <GameRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} currentRole={myRole} />
    </div>
  )
}
