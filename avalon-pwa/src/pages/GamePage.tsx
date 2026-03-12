import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import {
  advanceFromRoundResult,
  getVisiblePlayerIds,
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <p>Loading…</p>
      </div>
    )
  }

  const players = room.players ?? {}
  const playerOrder = Object.keys(players).sort()
  const leaderIndex = Number(room.leaderIndex) ?? 0
  const round = Number(room.round) ?? 1
  const teamSize = getMissionTeamSize(round, playerOrder.length)
  const isLeader = playerOrder[leaderIndex] === playerId

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
      <div className="min-h-screen flex flex-col p-4 max-w-md mx-auto">
        <RolePeekToggle room={room} playerId={playerId} />
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
    return (
      <div className="min-h-screen flex flex-col p-4 max-w-md mx-auto gap-4">
        <RolePeekToggle room={room} playerId={playerId} />
        <h2 className="text-xl font-semibold">Mission Result</h2>
        <p className={`text-lg font-bold ${success ? 'text-green-600' : 'text-red-600'}`}>
          {success ? '✔ SUCCESS' : '✗ FAIL'}
        </p>
        <h3 className="text-lg font-semibold">Score</h3>
        <p>Good: {score.good}</p>
        <p>Evil: {score.evil}</p>
        <button
          type="button"
          onClick={async () => {
            setRoundResultSaving(true)
            try {
              await advanceFromRoundResult(roomId)
            } finally {
              setRoundResultSaving(false)
            }
          }}
          disabled={roundResultSaving}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {roundResultSaving ? 'Continuing…' : 'Continue'}
        </button>
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
      <div className="min-h-screen flex flex-col p-4 max-w-md mx-auto">
        <RolePeekToggle room={room} playerId={playerId} />
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
      <div className="min-h-screen flex flex-col p-4 max-w-md mx-auto">
        <RolePeekToggle room={room} playerId={playerId} />
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
      <div className="min-h-screen flex flex-col p-4 max-w-md mx-auto">
        <RolePeekToggle room={room} playerId={playerId} />
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
      await saveTeam(roomId, selectedIds)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save team')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col p-4 max-w-md mx-auto"
      data-testid={isLeader ? 'team-selector-leader' : 'team-selector'}
    >
      <RolePeekToggle room={room} playerId={playerId} />
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
