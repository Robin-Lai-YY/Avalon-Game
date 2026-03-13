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

/**
 * Team selection and mission flow. TeamSelector for TEAM_SELECTION state.
 */
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
      <div className="min-h-screen flex items-center justify-center p-5">
        <p className="text-gray-500">加载中…</p>
      </div>
    )
  }

  const players = room.players ?? {}
  const playerOrder = Object.keys(players).sort()
  const leaderIndex = Number(room.leaderIndex) ?? 0
  const round = Number(room.round) ?? 1
  const teamSize = getMissionTeamSize(round, playerOrder.length)
  const isLeader = playerOrder[leaderIndex] === playerId

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
      <div className="min-h-screen flex flex-col p-5 max-w-md mx-auto gap-5">
        <RolePeekToggle room={room} playerId={playerId} />
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
    const score = room.score ?? { good: 0, evil: 0 }
    const acks = room.roundResultAck ?? {}
    const playerIds = Object.keys(room.players ?? {}).sort()
    const ackCount = playerIds.filter((id) => acks[id] === true).length
    const totalCount = playerIds.length
    const iHaveAcked = acks[playerId] === true
    return (
      <div className="min-h-screen flex flex-col p-5 max-w-md mx-auto gap-6">
        <RolePeekToggle room={room} playerId={playerId} />
        {voteHistoryEl}
        <div
          className={`rounded-2xl p-6 text-center animate-result-reveal ${
            success
              ? 'bg-green-50 border-2 border-green-200 animate-success-pulse'
              : 'bg-red-50 border-2 border-red-200 animate-fail-shake'
          }`}
        >
          <p className={`text-2xl font-bold ${success ? 'text-green-700' : 'text-red-700'}`}>
            {success ? '✔ 任务成功' : '✗ 任务失败'}
          </p>
          <p className={`mt-1 text-base ${success ? 'text-green-600' : 'text-red-600'}`}>
            {success ? 'Mission Success' : 'Mission Failed'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 section-spacing">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">当前比分</h3>
          <div className="flex justify-between text-lg">
            <span className="text-green-700 font-medium">好人 {score.good}</span>
            <span className="text-red-700 font-medium">坏人 {score.evil}</span>
          </div>
        </div>
        {iHaveAcked ? (
          <div className="rounded-xl border border-gray-200 bg-gray-100 p-4 text-center text-gray-600">
            <p className="font-medium">已确认，等待其他人…</p>
            <p className="text-sm mt-1">{ackCount}/{totalCount} 已点继续</p>
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
            className="w-full min-h-[48px] bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
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
      <div className="min-h-screen flex flex-col p-5 max-w-md mx-auto gap-5">
        <RolePeekToggle room={room} playerId={playerId} />
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
      <div className="min-h-screen flex flex-col p-5 max-w-md mx-auto gap-5">
        <RolePeekToggle room={room} playerId={playerId} />
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
      <div className="min-h-screen flex flex-col p-5 max-w-md mx-auto gap-5">
        <RolePeekToggle room={room} playerId={playerId} />
        {voteHistoryEl}
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-gray-600">State: {room.state}</p>
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
      className="min-h-screen flex flex-col p-5 max-w-md mx-auto gap-5"
      data-testid={isLeader ? 'team-selector-leader' : 'team-selector'}
    >
      <RolePeekToggle room={room} playerId={playerId} />
      {voteHistoryEl}
      {saveError && <p className="text-red-600 text-sm mb-2">{saveError}</p>}
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
