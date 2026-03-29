import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import {
  ackRoundResult,
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
import { ResultPage } from './ResultPage'
import { getMissionTeamSize } from '../utils/missionRules'

type RoomData = {
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
}

type GamePageProps = {
  roomId: string
  playerId: string
  onPlayAgain?: () => void
}

export function GamePage({ roomId, playerId, onPlayAgain }: GamePageProps) {
  const [room, setRoom] = useState<RoomData | null>(null)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [roundResultSaving, setRoundResultSaving] = useState(false)

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.val())
    })
    return () => unsubscribe()
  }, [roomId])

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

  if (room.state === 'MISSION_VOTING') {
    const teamIds = teamIdsFromRoom(room)
    const isOnMission = teamIds.includes(playerId)
    const myMissionVote = room.missionVotes?.[playerId] ?? null
    const myRole = room.roles?.[playerId] ?? ''
    return (
      <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-5 animate-page-enter">
        <RolePeekToggle room={room} playerId={playerId} />
        {scoreBar}
        {voteHistoryEl}
        <MissionPanel
          isOnMission={isOnMission}
          myVote={myMissionVote}
          canVoteFail={isEvilRole(myRole)}
          onVote={handleMissionVote}
        />
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
        <RolePeekToggle room={room} playerId={playerId} />
        {scoreBar}
        {voteHistoryEl}
        <div
          className={`rounded-2xl p-6 text-center animate-result-reveal ${
            success
              ? 'bg-gradient-to-b from-emerald-950/40 to-transparent border border-emerald-500/20 avalon-card-glow-good animate-success-pulse'
              : 'bg-gradient-to-b from-red-950/40 to-transparent border border-red-500/20 avalon-card-glow-evil animate-fail-shake'
          }`}
          style={{ backdropFilter: 'blur(16px)' }}
        >
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
        <RolePeekToggle room={room} playerId={playerId} />
        {scoreBar}
        {voteHistoryEl}
        <AssassinPanel
          assassinId={assassinId}
          players={players}
          targetIds={targetIds}
          onConfirm={(targetId) => submitAssassinChoice(roomId, playerId, targetId)}
          isAssassin={isAssassin}
        />
      </div>
    )
  }

  if (room.state === 'TEAM_VOTING') {
    const teamIds = teamIdsFromRoom(room)
    const myVote = room.votes?.[playerId] ?? null
    return (
      <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-5 animate-page-enter">
        <RolePeekToggle room={room} playerId={playerId} />
        {scoreBar}
        {voteHistoryEl}
        <VotePanel
          teamIds={teamIds}
          players={players}
          myVote={myVote}
          onVote={handleVote}
        />
      </div>
    )
  }

  if (room.state !== 'TEAM_SELECTION') {
    return (
      <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-5">
        <RolePeekToggle room={room} playerId={playerId} />
        {voteHistoryEl}
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-slate-500 text-sm">State: {room.state}</p>
        </div>
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
      <RolePeekToggle room={room} playerId={playerId} />
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
      />
    </div>
  )
}
