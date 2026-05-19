import { useEffect, useRef, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import {
  acknowledgeHouseReveal,
  acknowledgeNinjaReveal,
  expireReactiveWindow,
  finalizeRoundReveal,
  getEligibleThiefTargetIds,
  primeNightPhaseIfNeeded,
  restartNinjaToLobby,
  startNextNinjaRound,
  submitDraftPick,
  submitGravediggerPick,
  submitNightDeclaration,
  submitReactiveResponse,
  submitShapeshifterB,
  submitShapeshifterDecision,
  submitShinobiDecision,
  submitSpiritMerchantChoice,
  submitTarget,
  submitTroublemakerDecision,
  tryAdvanceResolution,
} from '../services/ninjaEngine'
import type {
  HouseCard,
  NinjaCard,
  NinjaCardKind,
  NinjaPrivateRoundState,
  NinjaRoom,
  TricksterVariant,
} from '../types/ninja'
import { NinjaRulesSheet } from '../components/NinjaRulesSheet'
import { HouseCardLabel, NinjaCardView, ninjaKindLabel } from '../components/NinjaCardView'
import { NinjaReactiveWindowView } from '../components/NinjaReactiveWindow'

type NinjaGamePageProps = {
  roomId: string
  playerId: string
  onExit: () => void
  onReturnToLobby?: () => void
}

const PHASE_LABEL: Record<NinjaRoom['state'], string> = {
  LOBBY: '等待开始',
  HOUSE_REVEAL: '查看流派牌',
  DRAFT_PICK_1: '轮抽 · 第 1 选',
  DRAFT_PICK_2: '轮抽 · 第 2 选',
  NIGHT_SPY: '夜晚 1 · 情报员',
  NIGHT_MYSTIC: '夜晚 2 · 灵媒',
  NIGHT_TRICKSTER: '夜晚 3 · 欺诈师',
  NIGHT_BLIND_ASSASSIN: '夜晚 4 · 盲眼刺客',
  NIGHT_SHINOBI: '夜晚 5 · 忍者',
  NIGHT_MASTERMIND: '夜晚 6 · 幕后黑手',
  REVEAL: '身份揭晓',
  GAME_END: '游戏结束',
}

const NIGHT_KIND_BY_STATE: Record<string, NinjaCardKind> = {
  NIGHT_SPY: 'spy',
  NIGHT_MYSTIC: 'mystic',
  NIGHT_TRICKSTER: 'trickster',
  NIGHT_BLIND_ASSASSIN: 'blind_assassin',
  NIGHT_SHINOBI: 'shinobi',
  NIGHT_MASTERMIND: 'mastermind',
}

const TRICKSTER_LABEL: Record<TricksterVariant, string> = {
  gravedigger: '盗墓者',
  shapeshifter: '变形者',
  spirit_merchant: '灵商',
  thief: '盗贼',
  troublemaker: '麻烦制造者',
  judgement: '审判',
}

export function NinjaGamePage({ roomId, playerId, onExit, onReturnToLobby }: NinjaGamePageProps) {
  const [room, setRoom] = useState<NinjaRoom | null>(null)
  const [privateState, setPrivateState] = useState<NinjaPrivateRoundState | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [houseRevealed, setHouseRevealed] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [smView, setSmView] = useState<'token' | 'house'>('house')
  const [smGiveId, setSmGiveId] = useState<string | null>(null)
  const [smTakeId, setSmTakeId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const roomRef = ref(db, `ninjaRooms/${roomId}`)
    const unsub = onValue(roomRef, (snap) => {
      setRoom(snap.exists() ? (snap.val() as NinjaRoom) : null)
    })
    return () => unsub()
  }, [roomId])

  useEffect(() => {
    const privRef = ref(db, `ninjaRooms/${roomId}/privateState/${playerId}/current`)
    const unsub = onValue(privRef, (snap) => {
      setPrivateState(snap.exists() ? (snap.val() as NinjaPrivateRoundState) : null)
    })
    return () => unsub()
  }, [roomId, playerId])

  useEffect(() => {
    setHouseRevealed(false)
  }, [room?.round])

  useEffect(() => {
    if (!menuOpen) return
    const handler = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [menuOpen])

  useEffect(() => {
    if (room?.state === 'LOBBY') onReturnToLobby?.()
  }, [room?.state, onReturnToLobby])

  // Auto-trigger phase priming whenever the state suggests we entered a NIGHT_* phase but currentNight is null.
  useEffect(() => {
    if (!room) return
    if (NIGHT_KIND_BY_STATE[room.state] && !room.currentNight) {
      primeNightPhaseIfNeeded(roomId).catch(() => {})
    }
    if (room.state === 'REVEAL' && !room.reveal) {
      finalizeRoundReveal(roomId).catch(() => {})
    }
  }, [room, roomId])

  // After all night declarations are locked, kick the resolution along.
  useEffect(() => {
    if (!room?.currentNight) return
    if (!room.currentNight.declarationsLocked) return
    if (room.currentNight.pendingAction) return
    if (room.currentNight.reactive) return
    tryAdvanceResolution(roomId).catch(() => {})
  }, [
    room?.currentNight?.declarationsLocked,
    room?.currentNight?.resolutionIndex,
    room?.currentNight?.pendingAction,
    room?.currentNight?.reactive,
    roomId,
    room?.currentNight,
  ])

  const me = room?.players?.[playerId]
  const isHost = room?.hostId === playerId
  const myHouseCard: HouseCard | null = room?.houseCardAssignments?.[playerId] ?? null
  const myHand: NinjaCard[] = me?.hand ?? []
  const myDraftHand: NinjaCard[] = me?.draftHand ?? []
  const myDraftPick = me?.draftPick ?? null
  const honorScore = (me?.honorTokens ?? []).reduce((s, t) => s + t.value, 0)
  const honorCount = (me?.honorTokens ?? []).length
  const currentKind = room ? NIGHT_KIND_BY_STATE[room.state] ?? null : null
  const myCardsThisPhase = currentKind ? myHand.filter((c) => c.kind === currentKind) : []
  const myUndeclared = myCardsThisPhase.filter((c) => me?.nightChoices?.[c.id] === undefined)

  // Reset spirit-merchant local UI when the action changes.
  const pa = room?.currentNight?.pendingAction
  useEffect(() => {
    if (pa?.step !== 'spirit_merchant_swap') {
      setSmView('house')
      setSmGiveId(null)
      setSmTakeId(null)
    }
  }, [pa?.step, pa?.cardId, pa?.spiritMerchantTargetId])

  async function safeRun<T>(fn: () => Promise<T>) {
    setLoading(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ninja] action failed', e)
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleAck() {
    void safeRun(() => acknowledgeHouseReveal(roomId, playerId))
  }
  async function handleDraftPick(cardId: string) {
    void safeRun(() => submitDraftPick(roomId, playerId, cardId))
  }
  async function handleNightChoice(cardId: string, choice: 'play' | 'hold') {
    void safeRun(() => submitNightDeclaration(roomId, playerId, cardId, choice))
  }
  async function handleTarget(targetId: string) {
    void safeRun(() => submitTarget(roomId, playerId, targetId))
  }
  async function handleShinobiDecision(kill: boolean) {
    void safeRun(() => submitShinobiDecision(roomId, playerId, kill))
  }
  async function handleGravedig(cardId: string | null) {
    void safeRun(() => submitGravediggerPick(roomId, playerId, cardId))
  }
  async function handleSpiritMerchant() {
    const swap = smGiveId && smTakeId ? { giveOwnTokenId: smGiveId, takeTargetTokenId: smTakeId } : null
    void safeRun(() => submitSpiritMerchantChoice(roomId, playerId, { viewKind: smView, swap }))
  }
  async function handleTroublemakerDecision(reveal: boolean) {
    void safeRun(() => submitTroublemakerDecision(roomId, playerId, reveal))
  }
  async function handleShapeshifterB(bId: string) {
    void safeRun(() => submitShapeshifterB(roomId, playerId, bId))
  }
  async function handleShapeshifterDecision(swap: boolean) {
    void safeRun(() => submitShapeshifterDecision(roomId, playerId, swap))
  }
  async function handleReactive(choice: 'monk' | 'martyr' | 'pass') {
    void safeRun(() => submitReactiveResponse(roomId, playerId, choice))
  }
  async function handleReactiveExpire() {
    void expireReactiveWindow(roomId).catch(() => {})
  }
  async function handleAckReveal() {
    void safeRun(() => acknowledgeNinjaReveal(roomId, playerId))
  }
  async function handleForceNextRound() {
    void safeRun(() => startNextNinjaRound(roomId, playerId))
  }
  async function handleRestart() {
    void safeRun(() => restartNinjaToLobby(roomId, playerId))
  }
  function handleExitConfirm() {
    if (!window.confirm('确定要退出忍者之夜游戏吗？')) return
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

  const phaseTitle = PHASE_LABEL[room.state] ?? room.state

  return (
    <div className="min-h-dvh flex flex-col px-5 pt-5 pb-10 max-w-md mx-auto gap-4 animate-page-enter">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs tracking-widest text-slate-400">{roomId}</p>
        <div ref={menuRef} className="flex items-center gap-1.5 relative">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 active:text-slate-200 transition-all"
          >
            规则
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-sm font-medium ${
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
                  handleExitConfirm()
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
        <p className="section-label mb-1">{phaseTitle}</p>
        <div className="flex items-baseline justify-between">
          <p className="text-xl font-bold text-indigo-200">第 {room.round || 1} 回合</p>
          <p className="text-xs text-slate-400">荣誉 {honorScore} 分 / {honorCount} 张</p>
        </div>
      </div>

      {/* My house card peek */}
      <div className="avalon-card p-4">
        <p className="section-label mb-2">你的流派牌</p>
        <button
          type="button"
          onClick={() => setHouseRevealed((v) => !v)}
          disabled={!myHouseCard || !me.canViewHouse}
          className="w-full min-h-[52px] rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left active:bg-white/[0.08] disabled:opacity-50"
        >
          <p className="text-[0.6875rem] text-slate-500 mb-1">
            {!me.canViewHouse
              ? '已被变形者交换，无法直接查看'
              : houseRevealed
                ? '点击隐藏'
                : '点击查看'}
          </p>
          <p className="text-lg font-semibold tracking-wide">
            {!myHouseCard
              ? '尚未发牌'
              : !me.canViewHouse
                ? '???'
                : houseRevealed
                  ? <HouseCardLabel card={myHouseCard} />
                  : '••••••'}
          </p>
        </button>
      </div>

      {/* Phase-specific UI */}
      {room.state === 'HOUSE_REVEAL' && (
        <div className="avalon-card p-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            查看完毕后请点击下方按钮。所有人确认后将进入轮抽。
          </p>
          <button
            type="button"
            onClick={handleAck}
            disabled={loading || me.hasAcknowledgedHouse}
            className="w-full mt-3 min-h-[44px] btn-primary rounded-xl font-semibold disabled:opacity-50"
          >
            {me.hasAcknowledgedHouse ? '已确认，等待其他玩家…' : '我已查看身份'}
          </button>
        </div>
      )}

      {(room.state === 'DRAFT_PICK_1' || room.state === 'DRAFT_PICK_2') && (
        <div className="avalon-card p-4">
          <p className="section-label mb-2">
            {room.state === 'DRAFT_PICK_1' ? '从 3 张中选 1 张保留，其余 2 张传给左邻' : '从 2 张中选 1 张保留，弃 1 张'}
          </p>
          <div className="flex flex-col gap-2">
            {myDraftHand.map((c) => (
              <NinjaCardView
                key={c.id}
                card={c}
                selected={myDraftPick === c.id}
                disabled={loading || myDraftPick !== null}
                onClick={() => handleDraftPick(c.id)}
              />
            ))}
          </div>
          {myDraftPick && (
            <p className="text-xs text-slate-400 mt-3">已选择，等待其他玩家…</p>
          )}
        </div>
      )}

      {currentKind && (
        <NightPhasePanel
          room={room}
          playerId={playerId}
          kind={currentKind}
          myCardsThisPhase={myCardsThisPhase}
          myUndeclared={myUndeclared}
          loading={loading}
          onChoice={handleNightChoice}
        />
      )}

      {pa && (
        <PendingActionPanel
          room={room}
          playerId={playerId}
          loading={loading}
          smView={smView}
          smGiveId={smGiveId}
          smTakeId={smTakeId}
          onSmView={setSmView}
          onSmGive={setSmGiveId}
          onSmTake={setSmTakeId}
          onTarget={handleTarget}
          onShinobiDecision={handleShinobiDecision}
          onGravedig={handleGravedig}
          onSpiritMerchant={handleSpiritMerchant}
          onTroublemakerDecision={handleTroublemakerDecision}
          onShapeshifterB={handleShapeshifterB}
          onShapeshifterDecision={handleShapeshifterDecision}
          peekedHouse={privateState?.shinobiPeek?.card ?? null}
          troublemakerPeek={privateState?.troublemakerPeek ?? null}
          shapeshifterPeeks={privateState?.shapeshifterPeeks ?? null}
        />
      )}

      {room.currentNight?.reactive && (
        <NinjaReactiveWindowView
          window={room.currentNight.reactive}
          myPlayerId={playerId}
          hasMonk={(myHand ?? []).some((c) => c.kind === 'mirror_monk')}
          hasMartyr={(myHand ?? []).some((c) => c.kind === 'martyr')}
          attackerName={room.players[room.currentNight.reactive.attackerId]?.name ?? ''}
          victimName={room.players[room.currentNight.reactive.victimId]?.name ?? ''}
          loading={loading}
          onMonk={() => handleReactive('monk')}
          onMartyr={() => handleReactive('martyr')}
          onPass={() => handleReactive('pass')}
          onExpire={handleReactiveExpire}
        />
      )}

      <PrivateRevealsCard privateState={privateState} room={room} />

      <PublicRevealsCard room={room} />

      <PlayerStatusList room={room} playerId={playerId} />

      <MyHandCard hand={myHand} />

      {room.state === 'REVEAL' && room.reveal && (
        <RevealCard
          room={room}
          playerId={playerId}
          isHost={isHost}
          loading={loading}
          onAck={handleAckReveal}
          onForceNext={handleForceNextRound}
        />
      )}

      {room.state === 'GAME_END' && (
        <GameEndCard room={room} isHost={isHost} loading={loading} onRestart={handleRestart} onExit={onExit} />
      )}

      {error && <p className="text-sm text-red-400/90">{error}</p>}
      <NinjaRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}

function NightPhasePanel({
  room,
  playerId,
  kind,
  myCardsThisPhase,
  myUndeclared,
  loading,
  onChoice,
}: {
  room: NinjaRoom
  playerId: string
  kind: NinjaCardKind
  myCardsThisPhase: NinjaCard[]
  myUndeclared: NinjaCard[]
  loading: boolean
  onChoice: (cardId: string, choice: 'play' | 'hold') => void
}) {
  const me = room.players?.[playerId]
  const players = room.players ?? {}
  const eligibleAlive = Object.entries(players)
    .filter(([, p]) => p.isAlive && (p.hand ?? []).some((c) => c.kind === kind))
    .map(([id]) => id)
  const declaredCount = eligibleAlive.filter((id) => {
    const p = players[id]!
    const cards = (p.hand ?? []).filter((c) => c.kind === kind)
    return cards.every((c) => p.nightChoices?.[c.id] !== undefined)
  }).length

  const locked = room.currentNight?.declarationsLocked === true
  const queue = room.currentNight?.resolutionQueue ?? []
  const idx = room.currentNight?.resolutionIndex ?? 0

  if (!me?.isAlive) {
    return (
      <div className="avalon-card p-4 border border-slate-500/20 bg-slate-900/30">
        <p className="text-sm text-slate-300">你已阵亡，无法在此阶段行动。</p>
      </div>
    )
  }

  return (
    <div className="avalon-card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="section-label">{ninjaKindLabel(kind)} 阶段</p>
        {!locked ? (
          <p className="text-xs text-slate-400">声明 {declaredCount}/{eligibleAlive.length}</p>
        ) : (
          <p className="text-xs text-slate-400">结算中 {Math.min(idx + 1, queue.length)}/{queue.length}</p>
        )}
      </div>

      {!locked && myCardsThisPhase.length === 0 && (
        <p className="text-sm text-slate-400">你没有该阶段的牌，等待其他玩家声明…</p>
      )}

      {!locked && myCardsThisPhase.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {myCardsThisPhase.map((c) => {
            const choice = me?.nightChoices?.[c.id]
            return (
              <div key={c.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <NinjaCardView card={c} compact />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={loading || choice !== undefined}
                    onClick={() => onChoice(c.id, 'play')}
                    className={`min-h-[40px] rounded-lg text-sm font-semibold ${
                      choice === 'play' ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/40' : 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/25'
                    } disabled:opacity-50`}
                  >
                    打出
                  </button>
                  <button
                    type="button"
                    disabled={loading || choice !== undefined}
                    onClick={() => onChoice(c.id, 'hold')}
                    className={`min-h-[40px] rounded-lg text-sm font-semibold ${
                      choice === 'hold' ? 'bg-slate-500/30 text-slate-100 border border-slate-400/40' : 'bg-white/[0.04] text-slate-300 border border-white/[0.08]'
                    } disabled:opacity-50`}
                  >
                    弃权
                  </button>
                </div>
                {choice && (
                  <p className="text-[0.6875rem] text-slate-400 mt-1">
                    已选择：{choice === 'play' ? '打出' : '弃权（本回合不可再用）'}
                  </p>
                )}
              </div>
            )
          })}
          {myUndeclared.length > 0 && (
            <p className="text-xs text-slate-400">还需对 {myUndeclared.length} 张做出决定。</p>
          )}
        </div>
      )}

      {locked && queue.length === 0 && (
        <p className="text-sm text-slate-300">所有玩家弃权，跳过此阶段。</p>
      )}
    </div>
  )
}

function PendingActionPanel({
  room,
  playerId,
  loading,
  smView,
  smGiveId,
  smTakeId,
  onSmView,
  onSmGive,
  onSmTake,
  onTarget,
  onShinobiDecision,
  onGravedig,
  onSpiritMerchant,
  onTroublemakerDecision,
  onShapeshifterB,
  onShapeshifterDecision,
  peekedHouse,
  troublemakerPeek,
  shapeshifterPeeks,
}: {
  room: NinjaRoom
  playerId: string
  loading: boolean
  smView: 'token' | 'house'
  smGiveId: string | null
  smTakeId: string | null
  onSmView: (v: 'token' | 'house') => void
  onSmGive: (id: string | null) => void
  onSmTake: (id: string | null) => void
  onTarget: (targetId: string) => void
  onShinobiDecision: (kill: boolean) => void
  onGravedig: (cardId: string | null) => void
  onSpiritMerchant: () => void
  onTroublemakerDecision: (reveal: boolean) => void
  onShapeshifterB: (bId: string) => void
  onShapeshifterDecision: (swap: boolean) => void
  peekedHouse: HouseCard | null
  troublemakerPeek: NinjaPrivateRoundState['troublemakerPeek']
  shapeshifterPeeks: NinjaPrivateRoundState['shapeshifterPeeks']
}) {
  const pa = room.currentNight?.pendingAction
  if (!pa) return null
  const isMine = pa.playerId === playerId

  if (!isMine) {
    const ownerName = room.players?.[pa.playerId]?.name ?? '某位玩家'
    const variantLabel = pa.variant ? TRICKSTER_LABEL[pa.variant] : ''
    return (
      <div className="avalon-card p-4 border border-amber-500/25 bg-amber-950/15">
        <p className="section-label mb-1 text-amber-200">等待 {ownerName} 行动…</p>
        <p className="text-sm text-amber-100/80">
          {ninjaKindLabel(pa.kind)}{variantLabel ? ` · ${variantLabel}` : ''}
        </p>
      </div>
    )
  }

  // Mine: show interactive UI per step.
  const players = room.players ?? {}
  const aliveOthers = Object.entries(players)
    .filter(([id, p]) => id !== playerId && p.isAlive)
    .map(([id]) => id)
  const aliveAny = Object.entries(players)
    .filter(([, p]) => p.isAlive)
    .map(([id]) => id)
  const variantLabel = pa.variant ? TRICKSTER_LABEL[pa.variant] : ''

  if (pa.step === 'pick_target') {
    // Determine eligible target ids per card type:
    //  - Shapeshifter (step 1 of 3): any alive player including self
    //  - Thief: only players with strictly more honor tokens than the thief
    //  - Default targeted cards: any other alive player
    let eligibleIds: string[] = aliveOthers
    let helpText: string | null = null
    if (pa.kind === 'trickster' && pa.variant === 'shapeshifter') {
      eligibleIds = aliveAny
      helpText = '选择第一名玩家（可包含你自己）'
    } else if (pa.kind === 'trickster' && pa.variant === 'thief') {
      eligibleIds = getEligibleThiefTargetIds(room, playerId)
      helpText = eligibleIds.length === 0
        ? '当前没有玩家的荣誉标记数比你多——盗贼无效，请稍候自动结算。'
        : '只能选择标记数比你多的玩家'
    } else if (pa.kind === 'trickster' && pa.variant === 'judgement') {
      helpText = '此击杀无视镜僧与殉道者，目标会直接死亡'
    }
    return (
      <div className="avalon-card p-4 border border-amber-500/30 bg-amber-950/15">
        <p className="section-label mb-2 text-amber-200">轮到你行动 · 选择目标</p>
        <p className="text-sm text-amber-100/85 mb-1">
          {ninjaKindLabel(pa.kind)}{variantLabel ? ` · ${variantLabel}` : ''}
        </p>
        {helpText && <p className="text-xs text-amber-100/60 mb-3">{helpText}</p>}
        <div className="flex flex-col gap-2">
          {eligibleIds.map((id) => (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => onTarget(id)}
              className="min-h-[44px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-left px-3 disabled:opacity-50 active:bg-white/[0.08]"
            >
              <span className="text-sm text-slate-200">
                {players[id]?.name ?? id}
                {id === playerId && <span className="text-[0.6875rem] text-slate-400 ml-1">(你)</span>}
              </span>
            </button>
          ))}
          {eligibleIds.length === 0 && pa.kind === 'trickster' && pa.variant === 'thief' && (
            <p className="text-xs text-slate-400">系统将自动跳过此牌结算。</p>
          )}
        </div>
      </div>
    )
  }

  if (pa.step === 'shinobi_decide') {
    return (
      <div className="avalon-card p-4 border border-emerald-500/30 bg-emerald-950/15">
        <p className="section-label mb-2 text-emerald-200">忍者偷窥 · 是否暗杀？</p>
        {peekedHouse && (
          <p className="text-sm text-emerald-100/90 mb-2">
            目标流派：<HouseCardLabel card={peekedHouse} />
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => onShinobiDecision(true)}
            className="min-h-[44px] rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 font-semibold disabled:opacity-50"
          >
            暗杀
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onShinobiDecision(false)}
            className="min-h-[44px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-200 font-semibold disabled:opacity-50"
          >
            放过
          </button>
        </div>
      </div>
    )
  }

  if (pa.step === 'gravedigger_pick') {
    const discard = room.ninjaDiscardPile ?? []
    const optionIds = pa.gravediggerOptionIds ?? []
    const options = optionIds
      .map((id) => discard.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
    return (
      <div className="avalon-card p-4 border border-amber-500/30 bg-amber-950/15">
        <p className="section-label mb-2 text-amber-200">盗墓者 · 从弃牌堆随机翻 2 张</p>
        {options.length === 0 ? (
          <p className="text-sm text-slate-300">弃牌堆为空，无牌可看。</p>
        ) : (
          <>
            <p className="text-xs text-amber-100/75 mb-2">
              系统从弃牌堆随机翻开下列 {options.length} 张牌，挑 1 张加入手牌（可选不取）。
            </p>
            <div className="flex flex-col gap-2">
              {options.map((c) => (
                <NinjaCardView key={c.id} card={c} compact onClick={() => onGravedig(c.id)} disabled={loading} />
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => onGravedig(null)}
          className="w-full mt-2 min-h-[40px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm disabled:opacity-50"
        >
          一张都不取
        </button>
      </div>
    )
  }

  if (pa.step === 'troublemaker_decide') {
    const targetId = pa.troublemakerTargetId
    const targetName = targetId ? players[targetId]?.name ?? targetId : '?'
    const card = troublemakerPeek?.card ?? null
    return (
      <div className="avalon-card p-4 border border-amber-500/30 bg-amber-950/15">
        <p className="section-label mb-2 text-amber-200">麻烦制造者 · 是否当众揭示？</p>
        <p className="text-sm text-amber-100/85 mb-2">
          目标：{targetName}
        </p>
        {card ? (
          <p className="text-sm text-amber-100/90 mb-3">
            你看到的流派牌：<HouseCardLabel card={card} />
          </p>
        ) : (
          <p className="text-xs text-slate-400 mb-3">读取目标流派牌中…</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading || !card}
            onClick={() => onTroublemakerDecision(true)}
            className="min-h-[44px] rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 font-semibold disabled:opacity-50"
          >
            当众揭示
          </button>
          <button
            type="button"
            disabled={loading || !card}
            onClick={() => onTroublemakerDecision(false)}
            className="min-h-[44px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-200 font-semibold disabled:opacity-50"
          >
            保持隐藏
          </button>
        </div>
      </div>
    )
  }

  if (pa.step === 'shapeshifter_pick_b') {
    const aId = pa.shapeshifterAId
    const aName = aId ? players[aId]?.name ?? aId : '?'
    return (
      <div className="avalon-card p-4 border border-amber-500/30 bg-amber-950/15">
        <p className="section-label mb-2 text-amber-200">变形者 · 选择第二名玩家</p>
        <p className="text-xs text-amber-100/70 mb-3">
          已选第一名：<span className="text-amber-100/95 font-semibold">{aName}</span>。
          现在选第二名玩家（可包含你自己），之后将看到两人的流派牌再决定是否交换。
        </p>
        <div className="flex flex-col gap-2">
          {aliveAny.filter((id) => id !== aId).map((id) => (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => onShapeshifterB(id)}
              className="min-h-[44px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-left px-3 disabled:opacity-50 active:bg-white/[0.08]"
            >
              <span className="text-sm text-slate-200">
                {players[id]?.name ?? id}
                {id === playerId && <span className="text-[0.6875rem] text-slate-400 ml-1">(你)</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (pa.step === 'shapeshifter_decide') {
    const aId = pa.shapeshifterAId ?? null
    const bId = pa.shapeshifterBId ?? null
    const aName = aId ? players[aId]?.name ?? aId : '?'
    const bName = bId ? players[bId]?.name ?? bId : '?'
    const aCard = shapeshifterPeeks?.aCard ?? null
    const bCard = shapeshifterPeeks?.bCard ?? null
    return (
      <div className="avalon-card p-4 border border-amber-500/30 bg-amber-950/15">
        <p className="section-label mb-2 text-amber-200">变形者 · 是否交换？</p>
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2">
            <p className="text-slate-400">{aName}</p>
            <p className="text-slate-100 font-semibold">
              {aCard ? <HouseCardLabel card={aCard} /> : '读取中…'}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2">
            <p className="text-slate-400">{bName}</p>
            <p className="text-slate-100 font-semibold">
              {bCard ? <HouseCardLabel card={bCard} /> : '读取中…'}
            </p>
          </div>
        </div>
        <p className="text-[0.6875rem] text-amber-100/60 mb-2">
          交换后，两人都将无法再自由查看自己的流派牌。
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading || !aCard || !bCard}
            onClick={() => onShapeshifterDecision(true)}
            className="min-h-[44px] rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 font-semibold disabled:opacity-50"
          >
            交换两人流派牌
          </button>
          <button
            type="button"
            disabled={loading || !aCard || !bCard}
            onClick={() => onShapeshifterDecision(false)}
            className="min-h-[44px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-200 font-semibold disabled:opacity-50"
          >
            不交换
          </button>
        </div>
      </div>
    )
  }

  if (pa.step === 'spirit_merchant_swap') {
    const targetId = pa.spiritMerchantTargetId
    const target = targetId ? room.players?.[targetId] : null
    const myTokens = room.players?.[playerId]?.honorTokens ?? []
    const targetTokens = target?.honorTokens ?? []
    return (
      <div className="avalon-card p-4 border border-amber-500/30 bg-amber-950/15">
        <p className="section-label mb-2 text-amber-200">灵商 · 查看与交换</p>
        {target && (
          <p className="text-sm text-amber-100/85 mb-2">目标：{target.name}</p>
        )}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => onSmView('house')}
            className={`min-h-[40px] rounded-lg text-sm ${
              smView === 'house' ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/40' : 'bg-white/[0.04] text-slate-300 border border-white/[0.08]'
            }`}
          >
            查看流派牌
          </button>
          <button
            type="button"
            onClick={() => onSmView('token')}
            className={`min-h-[40px] rounded-lg text-sm ${
              smView === 'token' ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/40' : 'bg-white/[0.04] text-slate-300 border border-white/[0.08]'
            }`}
          >
            查看一张荣誉标记
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[0.6875rem] text-slate-400 mb-1">给出我的标记</p>
            {myTokens.length === 0 && <p className="text-xs text-slate-500">无可用标记</p>}
            {myTokens.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSmGive(smGiveId === t.id ? null : t.id)}
                className={`w-full min-h-[36px] rounded-lg text-xs my-1 ${
                  smGiveId === t.id ? 'bg-amber-500/25 text-amber-100 border border-amber-400/40' : 'bg-white/[0.04] text-slate-300 border border-white/[0.08]'
                }`}
              >
                {t.value} 分（隐藏 id）
              </button>
            ))}
          </div>
          <div>
            <p className="text-[0.6875rem] text-slate-400 mb-1">取走对方标记</p>
            {targetTokens.length === 0 && <p className="text-xs text-slate-500">对方无标记</p>}
            {targetTokens.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSmTake(smTakeId === t.id ? null : t.id)}
                className={`w-full min-h-[36px] rounded-lg text-xs my-1 ${
                  smTakeId === t.id ? 'bg-amber-500/25 text-amber-100 border border-amber-400/40' : 'bg-white/[0.04] text-slate-300 border border-white/[0.08]'
                }`}
              >
                ???（盲选）
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={onSpiritMerchant}
          className="w-full mt-3 min-h-[44px] btn-primary rounded-xl font-semibold disabled:opacity-50"
        >
          {smGiveId && smTakeId ? '查看并交换' : '只查看不交换'}
        </button>
      </div>
    )
  }

  return null
}

function PrivateRevealsCard({ privateState, room }: { privateState: NinjaPrivateRoundState | null; room: NinjaRoom }) {
  const reveals = privateState
  const hasAny =
    !!reveals &&
    ((reveals.spyReveals?.length ?? 0) +
      (reveals.mysticReveals?.length ?? 0) +
      (reveals.spiritMerchantViews?.length ?? 0) > 0 ||
      reveals.shinobiPeek ||
      reveals.troublemakerPeek ||
      reveals.shapeshifterPeeks)
  if (!hasAny) return null
  const players = room.players ?? {}
  return (
    <div className="avalon-card p-4 border border-violet-500/25 bg-violet-950/15">
      <p className="section-label mb-2 text-violet-200">本回合见闻（仅自己可见）</p>
      <div className="flex flex-col gap-1.5 text-[0.8125rem]">
        {reveals?.spyReveals?.map((r, i) => (
          <p key={`spy-${i}`} className="text-violet-100/90">
            🕵️ {players[r.targetId]?.name ?? r.targetId} 的流派牌：<HouseCardLabel card={r.card} />
          </p>
        ))}
        {reveals?.mysticReveals?.map((r, i) => (
          <p key={`my-${i}`} className="text-violet-100/90">
            🔮 {players[r.targetId]?.name ?? r.targetId}：<HouseCardLabel card={r.card} />
            ；忍者牌随机偷看：{r.ninjaCardKind ? ninjaKindLabel(r.ninjaCardKind) : '(无)'}
          </p>
        ))}
        {reveals?.shinobiPeek && (
          <p className="text-violet-100/90">
            🥷 偷窥 {players[reveals.shinobiPeek.targetId]?.name ?? reveals.shinobiPeek.targetId} 的流派牌：
            <HouseCardLabel card={reveals.shinobiPeek.card} />
          </p>
        )}
        {reveals?.spiritMerchantViews?.map((r, i) => (
          <p key={`sm-${i}`} className="text-violet-100/90">
            💱 灵商查看 {players[r.targetId]?.name ?? r.targetId}：
            {r.card ? <HouseCardLabel card={r.card} /> : `荣誉标记 ${r.tokenValue ?? '?'} 分`}
          </p>
        ))}
        {reveals?.troublemakerPeek && (
          <p className="text-violet-100/90">
            🎭 麻烦制造者偷看 {players[reveals.troublemakerPeek.targetId]?.name ?? reveals.troublemakerPeek.targetId}：
            <HouseCardLabel card={reveals.troublemakerPeek.card} />
          </p>
        )}
        {reveals?.shapeshifterPeeks && (
          <p className="text-violet-100/90">
            🌀 变形者查看 {players[reveals.shapeshifterPeeks.aId]?.name ?? reveals.shapeshifterPeeks.aId}：
            <HouseCardLabel card={reveals.shapeshifterPeeks.aCard} />
            <span className="mx-2 text-violet-300/70">/</span>
            {players[reveals.shapeshifterPeeks.bId]?.name ?? reveals.shapeshifterPeeks.bId}：
            <HouseCardLabel card={reveals.shapeshifterPeeks.bCard} />
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Public reveals visible to all players: any house cards that have been
 * publicly outed this round (Troublemaker reveal / Thief / Judgement self-reveal).
 */
function PublicRevealsCard({ room }: { room: NinjaRoom }) {
  const ids = room.publiclyRevealedHouseIds ?? []
  if (ids.length === 0) return null
  const players = room.players ?? {}
  return (
    <div className="avalon-card p-4 border border-amber-500/25 bg-amber-950/10">
      <p className="section-label mb-2 text-amber-200">已公开的流派牌</p>
      <div className="flex flex-col gap-1.5 text-[0.8125rem]">
        {ids.map((id) => {
          const card = room.houseCardAssignments?.[id]
          return (
            <div key={id} className="flex items-center justify-between">
              <span className="text-slate-200">{players[id]?.name ?? id}</span>
              <span className="text-amber-100">
                {card ? <HouseCardLabel card={card} /> : '?'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlayerStatusList({ room, playerId }: { room: NinjaRoom; playerId: string }) {
  const ids = Object.keys(room.players ?? {}).sort()
  return (
    <div className="avalon-card p-4">
      <p className="section-label mb-2">座位状态</p>
      <div className="flex flex-col gap-1.5">
        {ids.map((id) => {
          const p = room.players?.[id]
          if (!p) return null
          const isMe = id === playerId
          return (
            <div
              key={id}
              className={`flex items-center justify-between text-sm ${
                p.isAlive ? 'text-slate-200' : 'text-slate-500 line-through'
              }`}
            >
              <span>
                {p.name}
                {isMe && <span className="text-[0.6875rem] text-slate-400 ml-1">(你)</span>}
                {room.hostId === id && <span className="text-[0.6875rem] text-amber-300 ml-1">房主</span>}
              </span>
              <span className="text-[0.75rem] text-slate-400">{p.isAlive ? '存活' : '阵亡'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MyHandCard({ hand }: { hand: NinjaCard[] }) {
  if (!hand.length) return null
  return (
    <div className="avalon-card p-4">
      <p className="section-label mb-2">你的手牌（{hand.length} 张）</p>
      <div className="flex flex-col gap-2">
        {hand.map((c) => (
          <NinjaCardView key={c.id} card={c} compact />
        ))}
      </div>
    </div>
  )
}

function RevealCard({
  room,
  playerId,
  isHost,
  loading,
  onAck,
  onForceNext,
}: {
  room: NinjaRoom
  playerId: string
  isHost: boolean
  loading: boolean
  onAck: () => void
  onForceNext: () => void
}) {
  const reveal = room.reveal!
  const players = room.players ?? {}
  const playerIds = Object.keys(players).sort()
  const me = players[playerId]
  const myAcked = me?.hasAcknowledgedReveal === true
  const ackedCount = playerIds.filter((id) => players[id]?.hasAcknowledgedReveal === true).length
  const totalCount = playerIds.length
  const allAcked = ackedCount >= totalCount && totalCount > 0
  const gameEnded = (room.resultWinnerIds?.length ?? 0) > 0
  return (
    <div className="avalon-card p-5 border border-emerald-500/25 bg-emerald-950/10 animate-result-reveal">
      <p className="section-label mb-1 text-emerald-200">回合结算</p>
      {reveal.mastermindBlocked ? (
        <>
          <p className="text-lg font-bold text-white">幕后黑手登场</p>
          <p className="text-xs text-amber-100/85 mt-1">
            {reveal.masterRevealedIds.map((id) => players[id]?.name ?? id).join('、')}
            {' '}独占本回合荣誉，其他流派玩家本回合不获得标记。
          </p>
        </>
      ) : (
        <p className="text-lg font-bold text-white">
          {reveal.winningHouse === 'crane' ? '鹤之流派获胜' :
           reveal.winningHouse === 'lotus' ? '莲之流派获胜' :
           reveal.winningHouse === 'tie' && reveal.perfectTie ? '完美平局（所有活人各得 1 标记）' :
           reveal.winningHouse === 'none' ? '场上无人存活' : '平局'}
        </p>
      )}
      {reveal.roninWasAlive && (
        <p className="text-xs text-purple-200 mt-1">浪人存活，独得 1 个荣誉标记。</p>
      )}
      <div className="divider my-3" />
      <div className="flex flex-col gap-1.5 text-[0.8125rem]">
        {playerIds.map((id) => {
          const p = players[id]!
          const card = room.houseCardAssignments?.[id]
          const drew = reveal.tokensDrawn?.[id] ?? []
          return (
            <div key={id} className="flex items-center justify-between">
              <span className={p.isAlive ? 'text-slate-200' : 'text-slate-500 line-through'}>
                {p.name}
                {!gameEnded && (
                  <span className={`ml-2 text-[0.6875rem] ${p.hasAcknowledgedReveal ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {p.hasAcknowledgedReveal ? '✓已确认' : '待确认'}
                  </span>
                )}
              </span>
              <span className="text-slate-300">
                {p.isAlive && card ? <HouseCardLabel card={card} /> : <span className="text-slate-500">未揭示</span>}
                {drew.length > 0 && (
                  <span className="ml-2 text-[0.6875rem] text-amber-300">+{drew.length}🏆</span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {!gameEnded && (
        <>
          <p className="mt-4 text-center text-xs text-slate-400">
            已确认 {ackedCount}/{totalCount}{allAcked ? '，进入下一回合…' : '，全员确认后将自动开始下一回合'}
          </p>
          <button
            type="button"
            onClick={onAck}
            disabled={loading || myAcked}
            className="w-full mt-2 min-h-[44px] btn-primary rounded-xl font-semibold disabled:opacity-50"
          >
            {myAcked ? '已确认，等待其他玩家…' : '我已查看，准备下一回合'}
          </button>
          {isHost && !allAcked && (
            <button
              type="button"
              onClick={onForceNext}
              disabled={loading}
              className="w-full mt-2 min-h-[40px] rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
            >
              房主强制开始下一回合
            </button>
          )}
        </>
      )}
    </div>
  )
}

function GameEndCard({
  room,
  isHost,
  loading,
  onRestart,
  onExit,
}: {
  room: NinjaRoom
  isHost: boolean
  loading: boolean
  onRestart: () => void
  onExit: () => void
}) {
  const players = room.players ?? {}
  const ids = Object.keys(players).sort()
  const winners = room.resultWinnerIds ?? []
  return (
    <div className="avalon-card p-5 border border-amber-500/30 bg-amber-950/10 animate-scale-bounce">
      <p className="section-label text-amber-200">游戏结束</p>
      <p className="text-2xl font-bold text-white mt-1">
        {winners.length === 1
          ? `${players[winners[0]!]?.name ?? winners[0]} 获胜！`
          : winners.length > 1
            ? '多人达成 10 分，比拼总分'
            : '游戏结束'}
      </p>
      <div className="divider my-3" />
      <div className="flex flex-col gap-1.5 text-sm">
        {ids
          .map((id) => {
            const p = players[id]!
            const total = (p.honorTokens ?? []).reduce((s, t) => s + t.value, 0)
            return { id, name: p.name, total, count: (p.honorTokens ?? []).length }
          })
          .sort((a, b) => b.total - a.total)
          .map((row) => (
            <div key={row.id} className="flex items-center justify-between">
              <span className={winners.includes(row.id) ? 'text-amber-200 font-semibold' : 'text-slate-200'}>
                {row.name}
              </span>
              <span className="text-slate-300">
                {row.total} 分 / {row.count} 张
              </span>
            </div>
          ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRestart}
          disabled={!isHost || loading}
          className="min-h-[44px] rounded-xl btn-primary font-semibold disabled:opacity-50"
        >
          {!isHost ? '仅房主可再来一局' : '再来一局'}
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
  )
}
