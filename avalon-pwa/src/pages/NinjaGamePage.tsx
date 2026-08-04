import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import {
  acknowledgeHouseReveal,
  acknowledgeNinjaReveal,
  finalizeRoundReveal,
  getEligibleThiefTargetIds,
  ackNightPhase,
  primeNightPhaseIfNeeded,
  restartNinjaToLobby,
  startNextNinjaRound,
  submitDraftPick,
  submitGravediggerDecision,
  submitGravediggerPick,
  submitNightDeclaration,
  submitReactiveResponse,
  submitShapeshifterB,
  submitShapeshifterDecision,
  submitShinobiDecision,
  submitSpiritMerchantSwap,
  submitSpiritMerchantView,
  submitTarget,
  submitTroublemakerDecision,
  ackPeekResult,
  tryAdvanceResolution,
} from '../services/ninjaEngine'
import type {
  HouseCard,
  NinjaCard,
  NinjaCardKind,
  NinjaPrivateRoundState,
  NinjaPublicNightEvent,
  NinjaRoom,
  PendingAction,
  TricksterVariant,
} from '../types/ninja'
import { NinjaRulesSheet } from '../components/NinjaRulesSheet'
import { HouseCardLabel, NinjaCardView, ninjaKindLabel } from '../components/NinjaCardView'
import { NinjaReactiveWindowView } from '../components/NinjaReactiveWindow'
import { NinjaSeatTable } from '../components/NinjaSeatTable'
import { useSeatPresence } from '../hooks/useSeatPresence'
import { loadNinjaSession } from '../utils/ninjaSessionStorage'

type NinjaGamePageProps = {
  roomId: string
  playerId: string
  onExit: () => void
  onReturnToLobby?: () => void
  onSeatTakenOver?: () => void
}

const PHASE_LABEL: Record<NinjaRoom['state'], string> = {
  LOBBY: '等待开始',
  HOUSE_REVEAL: '查看流派牌',
  DRAFT_PICK_1: '轮抽 · 第 1 选',
  DRAFT_PICK_2: '轮抽 · 第 2 选',
  NIGHT_SPY: '夜晚 1 · 密探',
  NIGHT_MYSTIC: '夜晚 2 · 隐士',
  NIGHT_TRICKSTER: '夜晚 3 · 骗徒',
  NIGHT_BLIND_ASSASSIN: '夜晚 4 · 盲眼刺客',
  NIGHT_SHINOBI: '夜晚 5 · 上忍',
  NIGHT_MASTERMIND: '首脑（自动）',
  REVEAL: '身份揭晓',
  GAME_END: '游戏结束',
}

const NIGHT_KIND_BY_STATE: Record<string, NinjaCardKind> = {
  NIGHT_SPY: 'spy',
  NIGHT_MYSTIC: 'mystic',
  NIGHT_TRICKSTER: 'trickster',
  NIGHT_BLIND_ASSASSIN: 'blind_assassin',
  NIGHT_SHINOBI: 'shinobi',
}

const TRICKSTER_LABEL: Record<TricksterVariant, string> = {
  gravedigger: '盗墓者',
  shapeshifter: '变形者',
  spirit_merchant: '灵商',
  thief: '盗贼',
  troublemaker: '麻烦制造者',
  judgement: '审判',
}

const PHASE_STEPS: { state: NinjaRoom['state']; label: string }[] = [
  { state: 'HOUSE_REVEAL', label: '流派' },
  { state: 'DRAFT_PICK_1', label: '轮抽1' },
  { state: 'DRAFT_PICK_2', label: '轮抽2' },
  { state: 'NIGHT_SPY', label: '密探' },
  { state: 'NIGHT_MYSTIC', label: '隐士' },
  { state: 'NIGHT_TRICKSTER', label: '骗徒' },
  { state: 'NIGHT_BLIND_ASSASSIN', label: '刺客' },
  { state: 'NIGHT_SHINOBI', label: '上忍' },
  { state: 'REVEAL', label: '揭示' },
]

const PHASE_TRANSITION_COPY: Partial<Record<NinjaRoom['state'], { eyebrow: string; title: string; subtitle: string }>> = {
  HOUSE_REVEAL: {
    eyebrow: 'Round Start',
    title: '查看流派牌',
    subtitle: '确认你的流派与阶级，别让身份暴露。',
  },
  DRAFT_PICK_1: {
    eyebrow: 'Draft 1',
    title: '轮抽开始',
    subtitle: '从 3 张忍者牌中保留 1 张，其余传给左邻。',
  },
  DRAFT_PICK_2: {
    eyebrow: 'Draft 2',
    title: '轮抽收束',
    subtitle: '从收到的 2 张牌中保留 1 张，另一张进入弃牌堆。',
  },
  NIGHT_SPY: {
    eyebrow: 'Night 1',
    title: '进入密探阶段',
    subtitle: '密探可以秘密查看一名玩家的流派牌。',
  },
  NIGHT_MYSTIC: {
    eyebrow: 'Night 2',
    title: '进入隐士阶段',
    subtitle: '隐士可以查看流派牌，并随机查看一张忍者牌。',
  },
  NIGHT_TRICKSTER: {
    eyebrow: 'Night 3',
    title: '进入骗徒阶段',
    subtitle: '骗徒将扰乱流派、标记与情报。',
  },
  NIGHT_BLIND_ASSASSIN: {
    eyebrow: 'Night 4',
    title: '进入盲眼刺客阶段',
    subtitle: '无需确认身份，直接指定一名玩家暗杀。',
  },
  NIGHT_SHINOBI: {
    eyebrow: 'Night 5',
    title: '进入上忍阶段',
    subtitle: '上忍先窥探流派，再决定是否出手。',
  },
  REVEAL: {
    eyebrow: 'Dawn',
    title: '进入揭示阶段',
    subtitle: '存活者揭开流派，结算荣誉标记。',
  },
}

function getOrderedPlayerIds(room: NinjaRoom): string[] {
  const players = room.players ?? {}
  const seated = (room.seatOrder ?? []).filter((id) => !!players[id])
  const missing = Object.keys(players)
    .filter((id) => !seated.includes(id))
    .sort()
  return [...seated, ...missing]
}

function getTargetableIdsForPending(room: NinjaRoom, playerId: string, pa: PendingAction | null | undefined): string[] {
  if (!pa || pa.playerId !== playerId) return []
  if (pa.step !== 'pick_target') return []
  const players = room.players ?? {}
  const aliveOthers = getOrderedPlayerIds(room).filter((id) => id !== playerId && players[id]?.isAlive)
  if (pa.kind === 'trickster' && pa.variant === 'shapeshifter') {
    return getOrderedPlayerIds(room).filter((id) => players[id]?.isAlive)
  }
  if (pa.kind === 'shinobi') {
    return getOrderedPlayerIds(room).filter((id) => players[id]?.isAlive)
  }
  if (pa.kind === 'trickster' && pa.variant === 'thief') {
    return getEligibleThiefTargetIds(room, playerId)
  }
  return aliveOthers
}

export function NinjaGamePage({
  roomId,
  playerId,
  onExit,
  onReturnToLobby,
  onSeatTakenOver,
}: NinjaGamePageProps) {
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
  const [draftSelectedId, setDraftSelectedId] = useState<string | null>(null)
  const [phaseTransition, setPhaseTransition] = useState<{ state: NinjaRoom['state']; nonce: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const previousStateRef = useRef<NinjaRoom['state'] | null>(null)
  const actionAnchorRef = useRef<HTMLDivElement | null>(null)
  const seatGeneration = loadNinjaSession()?.seatGeneration ?? 0

  useSeatPresence({
    roomPath: `ninjaRooms/${roomId}`,
    playerId,
    seatGeneration,
    onSeatTakenOver: () => onSeatTakenOver?.(),
  })

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
    setDraftSelectedId(null)
  }, [room?.round])

  useEffect(() => {
    if (!room?.state) return
    const previousState = previousStateRef.current
    previousStateRef.current = room.state
    if (!previousState || previousState === room.state) return
    if (!PHASE_TRANSITION_COPY[room.state]) return
    setPhaseTransition({ state: room.state, nonce: Date.now() })
  }, [room?.state])

  useEffect(() => {
    setDraftSelectedId(null)
  }, [room?.state])

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
  const activePlayerId = room?.currentNight?.pendingAction?.playerId
    ?? room?.currentNight?.resolutionQueue?.[room.currentNight?.resolutionIndex ?? -1]?.playerId
    ?? null
  const targetableIds = useMemo(
    () => (room ? getTargetableIdsForPending(room, playerId, pa) : []),
    [room, playerId, pa]
  )
  useEffect(() => {
    if (pa?.step !== 'spirit_merchant_swap') {
      setSmView('house')
      setSmGiveId(null)
      setSmTakeId(null)
    }
  }, [pa?.step, pa?.cardId, pa?.spiritMerchantTargetId])

  // When it's your turn to act (pending / reactive), scroll the panel into view.
  const myActionKey = useMemo(() => {
    if (pa && pa.playerId === playerId) return `pa:${pa.step}:${pa.cardId}:${pa.peekTargetId ?? ''}:${pa.shinobiTargetId ?? ''}`
    const reactive = room?.currentNight?.reactive
    if (reactive && reactive.currentResponderId === playerId) {
      return `rx:${reactive.victimId}:${reactive.triggerCardId}`
    }
    return null
  }, [pa, playerId, room?.currentNight?.reactive])

  useEffect(() => {
    if (!myActionKey) return
    const id = window.setTimeout(() => {
      actionAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(id)
  }, [myActionKey])

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
  function handleDraftSelect(cardId: string) {
    if (myDraftPick) return
    setDraftSelectedId((cur) => (cur === cardId ? null : cardId))
  }
  async function handleDraftConfirm() {
    if (!draftSelectedId) return
    void safeRun(() => submitDraftPick(roomId, playerId, draftSelectedId))
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
  async function handleGravediggerDecision(playNow: boolean) {
    void safeRun(() => submitGravediggerDecision(roomId, playerId, playNow))
  }
  async function handlePhaseAck() {
    void safeRun(() => ackNightPhase(roomId, playerId))
  }
  async function handlePeekAck() {
    void safeRun(() => ackPeekResult(roomId, playerId))
  }
  async function handleSpiritMerchantView() {
    void safeRun(() => submitSpiritMerchantView(roomId, playerId, smView))
  }
  async function handleSpiritMerchantSwap() {
    const swap = smGiveId && smTakeId ? { giveOwnTokenId: smGiveId, takeTargetTokenId: smTakeId } : null
    void safeRun(() => submitSpiritMerchantSwap(roomId, playerId, swap))
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
  const orderedIds = getOrderedPlayerIds(room)
  const aliveCount = orderedIds.filter((id) => room.players?.[id]?.isAlive).length
  const publicRevealCount = Object.keys(room.publiclyRevealedHouses ?? {}).length || (room.publiclyRevealedHouseIds ?? []).length
  const activeName = activePlayerId ? room.players?.[activePlayerId]?.name ?? '等待中' : '无'

  return (
    <div className="relative min-h-dvh overflow-x-hidden px-4 pb-8 pt-4 text-slate-100 animate-page-enter">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(225,29,72,0.16),transparent_32%),radial-gradient(circle_at_80%_18%,rgba(37,99,235,0.14),transparent_28%),linear-gradient(180deg,#020617,#070a13_46%,#020617)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.07] bg-[linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <NinjaPhaseTransitionOverlay
        transition={phaseTransition}
        onDone={(nonce) => {
          setPhaseTransition((current) => (current?.nonce === nonce ? null : current))
        }}
      />
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="relative z-50 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-slate-950/70 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur">
        <div>
          <p className="text-[0.625rem] uppercase tracking-[0.22em] text-rose-200/65">Room</p>
          <p className="font-mono text-xs tracking-widest text-slate-100">{roomId}</p>
        </div>
        <div ref={menuRef} className="relative z-50 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl text-sm font-semibold text-slate-300 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white active:text-slate-200 cursor-pointer"
          >
            规则
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
              menuOpen ? 'bg-white/[0.08] text-slate-100' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white active:text-slate-200'
            } cursor-pointer`}
            aria-label="更多操作"
          >
            <span className="text-base leading-none">⋯</span>
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 z-[999] mt-1.5 min-w-[132px] rounded-xl border border-white/[0.08] bg-slate-950/95 backdrop-blur p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  handleExitConfirm()
                }}
                className="w-full text-left min-h-[34px] px-2.5 rounded-lg text-xs font-medium text-slate-300/90 transition-colors hover:bg-white/[0.06] active:bg-white/[0.05] cursor-pointer"
              >
                退出游戏
              </button>
            </div>
          )}
        </div>
      </div>

      <NinjaPhaseTracker room={room} phaseTitle={phaseTitle} />

      {/* My house card peek */}
      <div className="rounded-[1.5rem] border border-white/[0.08] bg-slate-950/65 p-4 shadow-xl shadow-black/10 backdrop-blur">
        <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-slate-400">你的流派牌</p>
        <button
          type="button"
          onClick={() => setHouseRevealed((v) => !v)}
          disabled={!myHouseCard || !me.canViewHouse}
          className="w-full min-h-[62px] rounded-2xl border border-white/[0.08] bg-gradient-to-r from-white/[0.055] to-white/[0.025] px-4 py-3 text-left transition-colors duration-200 hover:border-rose-200/25 hover:bg-white/[0.07] active:bg-white/[0.08] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          <p className="text-[0.6875rem] text-slate-500 mb-1 uppercase tracking-[0.16em]">
            {!me.canViewHouse
              ? '已被变形者交换，无法直接查看'
              : houseRevealed
                ? '点击隐藏'
                : '点击查看'}
          </p>
          <p className="text-lg font-black tracking-wide">
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

      <div className="relative overflow-hidden rounded-[1.75rem] border border-rose-200/10 bg-slate-950/70 p-4 shadow-2xl shadow-rose-950/20 backdrop-blur">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="relative mb-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.24em] text-rose-200/75">Battle Table</p>
            </div>
            <div className="rounded-2xl border border-amber-200/15 bg-amber-300/10 px-3 py-2 text-right">
              <p className="text-[0.625rem] uppercase tracking-[0.2em] text-amber-100/60">Action</p>
              <p className="max-w-[120px] truncate text-sm font-black text-amber-50">{activeName}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <BattleStat label="存活" value={`${aliveCount}/${orderedIds.length}`} />
            <BattleStat label="公开" value={`${publicRevealCount}`} />
            <BattleStat label="我的荣誉" value={`${honorScore}`} />
            <BattleStat label="我的标记" value={`${honorCount}`} />
          </div>
        </div>
        <NinjaSeatTable
          room={room}
          viewerPlayerId={playerId}
          mode="game"
          activePlayerId={activePlayerId}
          targetableIds={targetableIds}
          onTargetClick={handleTarget}
        />
        {targetableIds.length > 0 && (
          <p className="mt-3 rounded-xl border border-rose-200/15 bg-rose-500/10 px-3 py-2 text-center text-xs font-semibold text-rose-100">
            目标模式：点击发光座位选择目标。
          </p>
        )}
      </div>

      {/* Phase-specific UI */}
      {room.state === 'HOUSE_REVEAL' && (
        <div className="rounded-[1.5rem] border border-white/[0.08] bg-slate-950/65 p-4 shadow-xl shadow-black/10 backdrop-blur">
          <p className="text-sm text-slate-300 leading-relaxed">
            查看完毕后请点击下方按钮。所有人确认后将进入轮抽。
          </p>
          <button
            type="button"
            onClick={handleAck}
            disabled={loading || me.hasAcknowledgedHouse}
            className="w-full mt-3 min-h-[46px] rounded-2xl border border-rose-200/25 bg-[linear-gradient(135deg,rgba(225,29,72,0.28),rgba(15,23,42,0.78),rgba(37,99,235,0.22))] font-black text-rose-50 shadow-xl shadow-rose-950/25 transition-colors duration-200 hover:border-rose-100/45 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-100/70 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {me.hasAcknowledgedHouse ? '已确认，等待其他玩家…' : '我已查看身份'}
          </button>
        </div>
      )}

      {(room.state === 'DRAFT_PICK_1' || room.state === 'DRAFT_PICK_2') && (
        <div className="rounded-[1.5rem] border border-white/[0.08] bg-slate-950/65 p-4 shadow-xl shadow-black/10 backdrop-blur">
          <p className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-slate-400">
            {room.state === 'DRAFT_PICK_1' ? '从 3 张中选 1 张保留，其余 2 张传给左邻' : '从 2 张中选 1 张保留，弃 1 张'}
          </p>
          <div className="flex gap-3 overflow-x-auto px-0.5 py-2">
            {myDraftHand.map((c) => (
              <div key={c.id} className="min-w-[230px] max-w-[250px] flex-1">
                <NinjaCardView
                  card={c}
                  selected={(myDraftPick ?? draftSelectedId) === c.id}
                  disabled={loading || myDraftPick !== null}
                  onClick={() => handleDraftSelect(c.id)}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {myDraftPick
                ? '已确认，等待其他玩家'
                : draftSelectedId
                  ? '已预选，可点其他卡重选，或再次点击取消'
                  : '先点选一张卡，再确认保留'}
            </p>
            <button
              type="button"
              onClick={handleDraftConfirm}
              disabled={loading || !!myDraftPick || !draftSelectedId}
              className="min-h-[40px] rounded-xl border border-rose-200/20 bg-rose-500/20 px-4 text-sm font-black text-rose-50 transition-colors duration-200 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              确认保留
            </button>
          </div>
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
          onAck={handlePhaseAck}
        />
      )}

      <div ref={actionAnchorRef} className="scroll-mt-24 flex flex-col gap-4">
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
          onGravediggerDecision={handleGravediggerDecision}
          onSpiritMerchantView={handleSpiritMerchantView}
          onSpiritMerchantSwap={handleSpiritMerchantSwap}
          onTroublemakerDecision={handleTroublemakerDecision}
          onShapeshifterB={handleShapeshifterB}
          onShapeshifterDecision={handleShapeshifterDecision}
          onPeekAck={handlePeekAck}
          privateState={privateState}
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
        />
      )}
      </div>

      <NightActionLogCard room={room} />

      <PrivateRevealsCard privateState={privateState} room={room} />

      <PublicRevealsCard room={room} />

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
    </div>
  )
}

function NinjaPhaseTracker({ room, phaseTitle }: { room: NinjaRoom; phaseTitle: string }) {
  const currentIndex = PHASE_STEPS.findIndex((s) => s.state === room.state)
  const index = currentIndex === -1 ? 0 : currentIndex
  const currentNight = room.currentNight
  const readyText = currentNight && !currentNight.declarationsLocked
    ? (() => {
        const kind = currentNight.kind
        const players = room.players ?? {}
        const alive = getOrderedPlayerIds(room).filter((id) => players[id]?.isAlive)
        const ready = alive.filter((id) => {
          const p = players[id]!
          const matching = (p.hand ?? []).filter((c) => c.kind === kind)
          if (matching.length === 0) return (currentNight.phaseAckIds ?? []).includes(id)
          return matching.every((c) => p.nightChoices?.[c.id] !== undefined)
        }).length
        return `${ready}/${alive.length}`
      })()
    : null
  const queue = currentNight?.resolutionQueue ?? []
  const queueText = currentNight?.declarationsLocked && queue.length > 0
    ? `${Math.min((currentNight.resolutionIndex ?? 0) + 1, queue.length)}/${queue.length}`
    : null

  return (
    <div className="avalon-card p-4 border border-indigo-500/25 animate-scale-bounce">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <p className="section-label mb-1">{phaseTitle}</p>
          <p className="text-xl font-bold text-indigo-200">第 {room.round || 1} 回合</p>
        </div>
        {(readyText || queueText) && (
          <p className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[0.6875rem] text-slate-300">
            {readyText ? `确认 ${readyText}` : `结算 ${queueText}`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {PHASE_STEPS.map((step, i) => {
          const active = i === index
          const done = i < index
          return (
            <div key={step.state} className="flex min-w-fit items-center gap-1">
              <div className={`flex h-8 min-w-8 items-center justify-center rounded-full border text-[0.625rem] font-bold ${
                active
                  ? 'border-indigo-300 bg-indigo-400/25 text-indigo-100 shadow-lg shadow-indigo-500/20'
                  : done
                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-500'
              }`}>
                {i + 1}
              </div>
              <span className={`text-[0.625rem] ${active ? 'text-indigo-100' : done ? 'text-emerald-200/80' : 'text-slate-500'}`}>
                {step.label}
              </span>
              {i < PHASE_STEPS.length - 1 && (
                <span className={`h-px w-5 ${done ? 'bg-emerald-400/30' : 'bg-white/[0.08]'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BattleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] px-2.5 py-2">
      <p className="text-[0.5625rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-black text-slate-100">{value}</p>
    </div>
  )
}

function NinjaPhaseTransitionOverlay({
  transition,
  onDone,
}: {
  transition: { state: NinjaRoom['state']; nonce: number } | null
  onDone: (nonce: number) => void
}) {
  const [active, setActive] = useState<{ state: NinjaRoom['state']; nonce: number } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const leaveTimerRef = useRef<number | null>(null)
  const safetyTimerRef = useRef<number | null>(null)
  const finishedRef = useRef(false)

  function finish(nonce: number) {
    if (finishedRef.current) return
    finishedRef.current = true
    setActive(null)
    setLeaving(false)
    onDone(nonce)
  }

  useEffect(() => {
    if (!transition) return
    finishedRef.current = false
    if (leaveTimerRef.current) window.clearTimeout(leaveTimerRef.current)
    if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current)
    setActive(transition)
    setLeaving(false)
    // Soft hold, then exit fade — total ≈ 2.9s
    leaveTimerRef.current = window.setTimeout(() => setLeaving(true), 2100)
    return () => {
      if (leaveTimerRef.current) window.clearTimeout(leaveTimerRef.current)
    }
  }, [transition?.nonce])

  useEffect(() => {
    if (!leaving || !active) return
    safetyTimerRef.current = window.setTimeout(() => finish(active.nonce), 900)
    return () => {
      if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current)
    }
  }, [leaving, active?.nonce])

  if (!active) return null
  const copy = PHASE_TRANSITION_COPY[active.state]
  if (!copy) return null
  const mode = leaving ? 'is-leaving' : 'is-entering'

  return createPortal(
    <div
      key={active.nonce}
      className={`phase-transition-root pointer-events-none fixed left-0 top-0 z-[9999] flex w-screen items-center justify-center px-6 ${mode}`}
      style={{ height: '100dvh' }}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return
        if (!leaving) return
        if (!String(event.animationName).includes('phase-veil-out')) return
        finish(active.nonce)
      }}
    >
      <div className="phase-transition-veil" aria-hidden />
      <div className="phase-transition-glow" aria-hidden />
      <div className={`phase-transition-card relative w-full max-w-sm rounded-[2rem] border border-rose-200/20 bg-[#070b13]/92 p-6 text-center shadow-2xl shadow-black/50 backdrop-blur-sm ${mode}`}>
        <div className="phase-transition-sheen pointer-events-none absolute inset-x-6 top-0 h-px overflow-hidden" aria-hidden>
          <span className="phase-transition-sheen-bar block h-full w-full" />
        </div>
        <p className="phase-transition-eyebrow text-[0.625rem] font-black uppercase tracking-[0.32em] text-rose-200/75">
          {copy.eyebrow}
        </p>
        <p className="phase-transition-title mt-3 text-2xl font-black tracking-tight text-white">
          {copy.title}
        </p>
        <p className="phase-transition-subtitle mt-2 text-sm leading-relaxed text-slate-300">
          {copy.subtitle}
        </p>
      </div>
    </div>,
    document.body
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
  onAck,
}: {
  room: NinjaRoom
  playerId: string
  kind: NinjaCardKind
  myCardsThisPhase: NinjaCard[]
  myUndeclared: NinjaCard[]
  loading: boolean
  onChoice: (cardId: string, choice: 'play' | 'hold') => void
  onAck: () => void
}) {
  const me = room.players?.[playerId]
  const players = room.players ?? {}
  const aliveIds = Object.entries(players)
    .filter(([, p]) => p.isAlive)
    .map(([id]) => id)
  const readyCount = aliveIds.filter((id) => {
    const p = players[id]!
    const matching = (p.hand ?? []).filter((c) => c.kind === kind)
    if (matching.length === 0) return (room.currentNight?.phaseAckIds ?? []).includes(id)
    return matching.every((c) => p.nightChoices?.[c.id] !== undefined)
  }).length
  const waitingNames = aliveIds
    .filter((id) => {
      const p = players[id]!
      const matching = (p.hand ?? []).filter((c) => c.kind === kind)
      if (matching.length === 0) return !(room.currentNight?.phaseAckIds ?? []).includes(id)
      return matching.some((c) => p.nightChoices?.[c.id] === undefined)
    })
    .map((id) => (id === playerId ? '你' : players[id]?.name ?? id))

  const locked = room.currentNight?.declarationsLocked === true
  const queue = room.currentNight?.resolutionQueue ?? []
  const idx = room.currentNight?.resolutionIndex ?? 0
  const iAcked = (room.currentNight?.phaseAckIds ?? []).includes(playerId)

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
          <p className="text-xs text-slate-400">确认 {readyCount}/{aliveIds.length}</p>
        ) : (
          <p className="text-xs text-slate-400">结算中 {Math.min(idx + 1, queue.length)}/{queue.length}</p>
        )}
      </div>

      {!locked && waitingNames.length > 0 && (
        <p className="mb-3 text-xs leading-relaxed text-amber-100/75">
          还在等：{waitingNames.join('、')}
        </p>
      )}

      {!locked && myCardsThisPhase.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-400">本阶段你没有可出的牌，点继续后等待持牌玩家。</p>
          <button
            type="button"
            disabled={loading || iAcked}
            onClick={onAck}
            className="min-h-[44px] rounded-xl btn-primary font-semibold disabled:opacity-50"
          >
            {iAcked ? '已继续，等待其他人…' : '没有此牌，点击继续'}
          </button>
        </div>
      )}

      {!locked && myCardsThisPhase.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-0.5 py-2">
          {myCardsThisPhase.map((c) => {
            const choice = me?.nightChoices?.[c.id]
            return (
              <div key={c.id} className="min-w-[204px] max-w-[224px] rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
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
                    本阶段不出
                  </button>
                </div>
                {choice && (
                  <p className="text-[0.6875rem] text-slate-400 mt-1">
                    已选择：{choice === 'play' ? '打出' : '本阶段不出（本回合不可再用）'}
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
        <p className="text-sm text-slate-300">无人出牌，跳过此阶段。</p>
      )}
    </div>
  )
}

function ShinobiDecidePanel({
  room,
  playerId,
  pa,
  peekedHouse,
  loading,
  onShinobiDecision,
}: {
  room: NinjaRoom
  playerId: string
  pa: PendingAction
  peekedHouse: HouseCard | null
  loading: boolean
  onShinobiDecision: (kill: boolean) => void
}) {
  const [peekAcked, setPeekAcked] = useState(false)
  const targetId = pa.shinobiTargetId
  const targetName =
    targetId == null
      ? '目标'
      : targetId === playerId
        ? '你自己'
        : room.players?.[targetId]?.name ?? targetId

  useEffect(() => {
    setPeekAcked(false)
  }, [pa.cardId, pa.shinobiTargetId])

  return (
    <div className="avalon-card p-4 border border-emerald-500/30 bg-emerald-950/15">
      <p className="section-label mb-2 text-emerald-200">上忍窥探结果（仅你可见）</p>
      <p className="text-sm text-emerald-100/85 mb-3">目标：{targetName}</p>
      {peekedHouse ? (
        <div className="mb-4 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3">
          <p className="text-sm text-slate-100">
            流派牌：<HouseCardLabel card={peekedHouse} />
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400 mb-4">读取目标流派中…</p>
      )}

      {!peekAcked ? (
        <>
          <p className="text-xs text-emerald-200/60 mb-3">先看清流派，再决定是否暗杀。</p>
          <button
            type="button"
            disabled={loading || !peekedHouse}
            onClick={() => setPeekAcked(true)}
            className="w-full min-h-[44px] btn-primary rounded-xl font-semibold disabled:opacity-50"
          >
            我看完了，决定是否暗杀
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-emerald-200/60 mb-3">
            已确认看到 {targetName} 的流派。选择后不可撤销。
          </p>
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
        </>
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
  onGravediggerDecision,
  onSpiritMerchantView,
  onSpiritMerchantSwap,
  onTroublemakerDecision,
  onShapeshifterB,
  onShapeshifterDecision,
  onPeekAck,
  privateState,
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
  onGravediggerDecision: (playNow: boolean) => void
  onSpiritMerchantView: () => void
  onSpiritMerchantSwap: () => void
  onTroublemakerDecision: (reveal: boolean) => void
  onShapeshifterB: (bId: string) => void
  onShapeshifterDecision: (swap: boolean) => void
  onPeekAck: () => void
  privateState: NinjaPrivateRoundState | null
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
    const waitingPeek = pa.step === 'peek_ack'
    return (
      <div className="avalon-card p-4 border border-amber-500/25 bg-amber-950/15">
        <p className="section-label mb-1 text-amber-200">
          {waitingPeek ? `等待 ${ownerName} 查看结果…` : `等待 ${ownerName} 行动…`}
        </p>
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

  if (pa.step === 'peek_ack') {
    const targetId = pa.peekTargetId
    const targetName = targetId ? players[targetId]?.name ?? targetId : '目标'
    const spyHit =
      pa.kind === 'spy'
        ? [...(privateState?.spyReveals ?? [])].reverse().find((r) => r.targetId === targetId)
        : null
    const mysticHit =
      pa.kind === 'mystic'
        ? [...(privateState?.mysticReveals ?? [])].reverse().find((r) => r.targetId === targetId)
        : null
    const house = spyHit?.card ?? mysticHit?.card ?? null
    const loadingResult = !house

    return (
      <div className="avalon-card p-4 border border-violet-400/35 bg-violet-950/25 shadow-lg shadow-violet-900/20">
        <p className="section-label mb-2 text-violet-200">窥探结果（仅你可见）</p>
        <p className="text-sm text-violet-100/85 mb-3">
          {pa.kind === 'spy' ? '密探' : '隐士'} · 查看了 {targetName}
        </p>
        {loadingResult ? (
          <p className="text-sm text-slate-400 mb-4">结果同步中…</p>
        ) : (
          <div className="mb-4 space-y-2 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3">
            <p className="text-sm text-slate-100">
              流派牌：<HouseCardLabel card={house} />
            </p>
            {mysticHit && (
              <p className="text-sm text-slate-100">
                随机忍者牌：
                {mysticHit.ninjaCardKind
                  ? `${ninjaKindLabel(mysticHit.ninjaCardKind)}${
                      mysticHit.ninjaCardVariant
                        ? ` · ${TRICKSTER_LABEL[mysticHit.ninjaCardVariant]}`
                        : ''
                    }`
                  : '（手牌为空）'}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-violet-200/60 mb-3">看清后再点继续，下一张牌才会结算。</p>
        <button
          type="button"
          disabled={loading || loadingResult}
          onClick={onPeekAck}
          className="w-full min-h-[44px] btn-primary rounded-xl font-semibold disabled:opacity-50"
        >
          我看完了，继续
        </button>
      </div>
    )
  }

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
    } else if (pa.kind === 'shinobi') {
      eligibleIds = aliveAny
      helpText = '可选择自己：查看自己的流派后决定是否暗杀'
    } else if (pa.kind === 'trickster' && pa.variant === 'thief') {
      eligibleIds = getEligibleThiefTargetIds(room, playerId)
      helpText = eligibleIds.length === 0
        ? '当前没有玩家的荣誉标记数比你多——盗贼无效，请稍候自动结算。'
        : '只能选择标记数比你多的玩家'
    } else if (pa.kind === 'trickster' && pa.variant === 'judgement') {
      helpText = '此击杀无视还施僧与殉道者，目标会直接死亡'
    }
    return (
      <div className="avalon-card p-4 border border-amber-500/30 bg-amber-950/15">
        <p className="section-label mb-2 text-amber-200">轮到你行动 · 选择目标</p>
        <p className="text-sm text-amber-100/85 mb-1">
          {ninjaKindLabel(pa.kind)}{variantLabel ? ` · ${variantLabel}` : ''}
        </p>
        <p className="text-xs text-amber-100/60 mb-2">推荐直接点击上方圆桌中的发光座位选择目标。</p>
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
      <ShinobiDecidePanel
        room={room}
        playerId={playerId}
        pa={pa}
        peekedHouse={peekedHouse}
        loading={loading}
        onShinobiDecision={onShinobiDecision}
      />
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
        <p className="section-label mb-2 text-amber-200">盗墓者 · 从弃牌堆翻牌</p>
        {options.length === 0 ? (
          <>
            <p className="text-sm text-slate-300 mb-2">弃牌堆为空，无牌可取。</p>
            <button
              type="button"
              disabled={loading}
              onClick={() => onGravedig(null)}
              className="w-full min-h-[44px] rounded-xl btn-primary font-semibold disabled:opacity-50"
            >
              结束
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-amber-100/75 mb-2">
              必须从下列 {options.length} 张中挑 1 张；随后可选择立即打出或留下。
            </p>
            <div className="flex flex-col gap-2">
              {options.map((c) => (
                <NinjaCardView key={c.id} card={c} compact onClick={() => onGravedig(c.id)} disabled={loading} />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  if (pa.step === 'gravedigger_decide') {
    const discard = room.ninjaDiscardPile ?? []
    const picked = discard.find((c) => c.id === pa.gravediggerPickedId) ?? null
    return (
      <div className="avalon-card p-4 border border-amber-500/30 bg-amber-950/15">
        <p className="section-label mb-2 text-amber-200">盗墓者 · 立即打出或留下</p>
        {picked ? (
          <div className="mb-3">
            <NinjaCardView card={picked} compact />
          </div>
        ) : (
          <p className="text-sm text-slate-300 mb-3">已选中一张弃牌。</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => onGravediggerDecision(true)}
            className="min-h-[44px] rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 font-semibold disabled:opacity-50"
          >
            立即打出
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onGravediggerDecision(false)}
            className="min-h-[44px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-200 font-semibold disabled:opacity-50"
          >
            留下
          </button>
        </div>
        <p className="mt-2 text-[0.6875rem] text-slate-400">
          若留下且该牌阶段已过（如密探/隐士），本回合将无法再出。
        </p>
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

  if (pa.step === 'spirit_merchant_view') {
    const targetId = pa.spiritMerchantTargetId
    const target = targetId ? room.players?.[targetId] : null
    return (
      <div className="avalon-card p-4 border border-amber-500/30 bg-amber-950/15">
        <p className="section-label mb-2 text-amber-200">灵商 · 选择查看内容</p>
        {target && <p className="text-sm text-amber-100/85 mb-2">目标：{target.name}</p>}
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
        <button
          type="button"
          disabled={loading}
          onClick={onSpiritMerchantView}
          className="w-full min-h-[44px] btn-primary rounded-xl font-semibold disabled:opacity-50"
        >
          确认查看
        </button>
      </div>
    )
  }

  if (pa.step === 'spirit_merchant_swap') {
    const targetId = pa.spiritMerchantTargetId
    const target = targetId ? room.players?.[targetId] : null
    const myTokens = room.players?.[playerId]?.honorTokens ?? []
    const targetTokens = target?.honorTokens ?? []
    const canSwap = myTokens.length > 0 && targetTokens.length > 0
    return (
      <div className="avalon-card p-4 border border-amber-500/30 bg-amber-950/15">
        <p className="section-label mb-2 text-amber-200">灵商 · 是否交换</p>
        {target && <p className="text-sm text-amber-100/85 mb-2">目标：{target.name}</p>}
        <p className="text-xs text-amber-100/70 mb-3">查看结果已写入「本回合见闻」。没有自己的标记时只能结束。</p>
        {canSwap ? (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-[0.6875rem] text-slate-400 mb-1">给出我的标记</p>
              {myTokens.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSmGive(smGiveId === t.id ? null : t.id)}
                  className={`w-full min-h-[36px] rounded-lg text-xs my-1 ${
                    smGiveId === t.id ? 'bg-amber-500/25 text-amber-100 border border-amber-400/40' : 'bg-white/[0.04] text-slate-300 border border-white/[0.08]'
                  }`}
                >
                  {t.value} 分
                </button>
              ))}
            </div>
            <div>
              <p className="text-[0.6875rem] text-slate-400 mb-1">取走对方标记</p>
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
        ) : (
          <p className="text-xs text-slate-400 mb-3">无法交换（你或对方没有荣誉标记）。</p>
        )}
        <button
          type="button"
          disabled={loading || (canSwap && !(smGiveId && smTakeId) && Boolean(smGiveId || smTakeId))}
          onClick={onSpiritMerchantSwap}
          className="w-full min-h-[44px] btn-primary rounded-xl font-semibold disabled:opacity-50"
        >
          {smGiveId && smTakeId ? '确认交换' : '不交换，结束'}
        </button>
      </div>
    )
  }

  return null
}

function NightActionLogCard({ room }: { room: NinjaRoom }) {
  const log = room.publicNightLog ?? []
  const groups = useMemo(() => groupPublicNightLog(log, room), [log, room])
  if (groups.length === 0) return null
  return (
    <div className="avalon-card p-4 border border-sky-500/20 bg-sky-950/10">
      <p className="section-label mb-3 text-sky-200">本回合公开行动</p>
      <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-0.5">
        {groups.map((group, gi) => (
          <section key={group.key} className={gi > 0 ? 'border-t border-white/[0.08] pt-3' : ''}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide ${group.badgeClass}`}>
                {group.title}
              </span>
              <span className="h-px flex-1 bg-white/[0.06]" />
            </div>
            <ul className="flex flex-col gap-1.5">
              {group.items.map((item) => {
                if (item.kind === 'skip') {
                  return (
                    <li key={item.id} className="text-[0.8125rem] text-slate-400 leading-snug">
                      无人出牌，跳过此阶段
                    </li>
                  )
                }
                if (item.kind === 'play') {
                  const tag = item.actionTag
                  return (
                    <li key={item.id} className="text-[0.8125rem] text-slate-200/90 leading-snug">
                      <span
                        className={`mr-1.5 rounded px-1.5 py-0.5 text-[0.625rem] font-medium ${
                          tag?.className ?? 'bg-indigo-400/15 text-indigo-200'
                        }`}
                      >
                        {tag?.label ?? '出牌'}
                      </span>
                      {item.actor} 打出 {item.card}
                      {item.clauses.length > 0 ? ` · ${item.clauses.join(' · ')}` : ''}
                    </li>
                  )
                }
                const tag = publicEventTagForGroup(item.event, group.title)
                const body = stripLeadingCardLabel(item.event.text, item.event.cardLabel)
                return (
                  <li key={item.id} className="text-[0.8125rem] text-slate-200/90 leading-snug">
                    {tag && (
                      <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[0.625rem] font-medium ${tag.className}`}>
                        {tag.label}
                      </span>
                    )}
                    {body}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

type PublicLogItem =
  | { kind: 'skip'; id: string }
  | {
      kind: 'play'
      id: string
      actor: string
      card: string
      clauses: string[]
      actionTag: { label: string; className: string } | null
    }
  | { kind: 'event'; id: string; event: NinjaPublicNightEvent }

type PublicLogGroup = {
  key: string
  title: string
  badgeClass: string
  items: PublicLogItem[]
}

const PHASE_META: Record<string, { title: string; badgeClass: string }> = {
  spy: { title: '密探', badgeClass: 'bg-sky-400/20 text-sky-200' },
  mystic: { title: '隐士', badgeClass: 'bg-violet-400/20 text-violet-200' },
  trickster: { title: '骗徒', badgeClass: 'bg-amber-400/20 text-amber-200' },
  blind_assassin: { title: '盲眼刺客', badgeClass: 'bg-rose-400/20 text-rose-200' },
  shinobi: { title: '上忍', badgeClass: 'bg-emerald-400/20 text-emerald-200' },
  mastermind: { title: '首脑', badgeClass: 'bg-fuchsia-400/20 text-fuchsia-200' },
  misc: { title: '其他', badgeClass: 'bg-white/[0.08] text-slate-300' },
}

/** Events that belong to the card player and can merge into the「打出」line. */
const MERGEABLE_EVENT_KINDS = new Set<NinjaPublicNightEvent['kind']>([
  'peek',
  'kill',
  'steal',
  'public_reveal',
  'gravedigger',
  'spirit_merchant',
  'swap_lock',
  'mastermind',
])

function phaseKeyFromHeaderText(text: string): string | null {
  if (text.startsWith('密探')) return 'spy'
  if (text.startsWith('隐士')) return 'mystic'
  if (text.startsWith('骗徒')) return 'trickster'
  if (text.startsWith('盲眼')) return 'blind_assassin'
  if (text.startsWith('上忍')) return 'shinobi'
  if (text.startsWith('首脑')) return 'mastermind'
  return null
}

function phaseKeyFromEvent(e: NinjaPublicNightEvent): string | null {
  if (e.kind === 'mastermind') return 'mastermind'
  const label = (e.cardLabel ?? '').trim()
  if (label.includes('密探')) return 'spy'
  if (label.includes('隐士')) return 'mystic'
  if (label.includes('上忍')) return 'shinobi'
  if (label.includes('盲眼') || (label.includes('刺客') && !label.includes('上忍'))) return 'blind_assassin'
  if (
    label.includes('盗墓') ||
    label.includes('变形') ||
    label.includes('灵商') ||
    label.includes('盗贼') ||
    label.includes('麻烦') ||
    label.includes('审判')
  ) {
    return 'trickster'
  }
  if (label.includes('首脑')) return 'mastermind'
  return null
}

function parsePlayText(text: string): { actor: string; card: string } | null {
  const m = text.match(/^(.+?) 打出 (.+)$/)
  if (!m) return null
  return { actor: m[1]!.trim(), card: m[2]!.trim() }
}

function cardLabelMatchesPlay(cardLabel: string, playCard: string): boolean {
  const a = cardLabel.trim()
  const b = playCard.trim()
  if (!a || !b) return false
  if (a === b) return true
  // 「上忍」matches「上忍 3」;「密探 1」exact preferred elsewhere
  if (b.startsWith(a + ' ') || b.startsWith(a)) return true
  if (a.startsWith(b + ' ') || a.startsWith(b)) return true
  return false
}

function eventActorName(e: NinjaPublicNightEvent, room: NinjaRoom): string | null {
  if (e.actorId && room.players?.[e.actorId]?.name) return room.players[e.actorId]!.name
  const parts = e.text.split(' · ')
  if (parts.length >= 1 && parts[0] && !parts[0].includes(' ')) return parts[0]
  if (parts.length >= 1) return parts[0]!.trim()
  return null
}

/** Extract the action clause after「演员 · 牌名 · …」. */
function eventActionClause(e: NinjaPublicNightEvent): string {
  const parts = e.text.split(' · ')
  if (e.cardLabel && parts.length >= 3 && parts[1] === e.cardLabel) {
    return parts.slice(2).join(' · ').trim()
  }
  if (parts.length >= 3) return parts.slice(2).join(' · ').trim()
  if (parts.length === 2) return parts[1]!.trim()
  return e.text.trim()
}

function mergeActionTag(
  kind: NinjaPublicNightEvent['kind'],
  cardLabel: string | null | undefined
): { label: string; className: string } {
  if (kind === 'peek') return { label: '窥探', className: 'bg-sky-400/15 text-sky-200' }
  if (kind === 'kill') return { label: '击杀', className: 'bg-rose-400/15 text-rose-200' }
  if (kind === 'steal') return { label: '偷窃', className: 'bg-amber-400/15 text-amber-200' }
  if (kind === 'public_reveal') return { label: '公开', className: 'bg-amber-400/15 text-amber-200' }
  if (kind === 'gravedigger') return { label: '盗墓', className: 'bg-amber-400/15 text-amber-200' }
  if (kind === 'spirit_merchant') return { label: '灵商', className: 'bg-amber-400/15 text-amber-200' }
  if (kind === 'swap_lock') return { label: '交换', className: 'bg-amber-400/15 text-amber-200' }
  if (kind === 'mastermind') return { label: '公开', className: 'bg-fuchsia-400/15 text-fuchsia-200' }
  if (cardLabel?.includes('审判')) return { label: '审判', className: 'bg-amber-400/15 text-amber-200' }
  return { label: '出牌', className: 'bg-indigo-400/15 text-indigo-200' }
}

function findMergePlay(
  group: PublicLogGroup,
  e: NinjaPublicNightEvent,
  room: NinjaRoom
): Extract<PublicLogItem, { kind: 'play' }> | null {
  if (!MERGEABLE_EVENT_KINDS.has(e.kind)) return null
  // Kill without actor (e.g.「X 出局」after reactive) is aftermath — keep separate.
  if (e.kind === 'kill' && !e.actorId && !e.cardLabel) return null

  const actor = eventActorName(e, room)
  const label = (e.cardLabel ?? '').trim()
  if (!actor || !label) return null

  const plays = group.items.filter((it): it is Extract<PublicLogItem, { kind: 'play' }> => it.kind === 'play')
  const exact = plays.find((p) => p.actor === actor && p.card === label)
  if (exact) return exact
  return plays.find((p) => p.actor === actor && cardLabelMatchesPlay(label, p.card)) ?? null
}

function groupPublicNightLog(log: NinjaPublicNightEvent[], room: NinjaRoom): PublicLogGroup[] {
  const groups: PublicLogGroup[] = []
  let current: PublicLogGroup | null = null

  const openGroup = (key: string) => {
    const meta = PHASE_META[key] ?? PHASE_META.misc
    if (current?.key === key) return current
    current = { key, title: meta.title, badgeClass: meta.badgeClass, items: [] }
    groups.push(current)
    return current
  }

  log.forEach((e, index) => {
    if (e.kind === 'phase_plays' || e.kind === 'phase_skip') {
      const key = phaseKeyFromHeaderText(e.text) ?? 'misc'
      const group = openGroup(key)
      if (e.kind === 'phase_skip') {
        group.items.push({ kind: 'skip', id: e.id || `skip-${index}` })
        return
      }
      const body = e.text.replace(/^[^：]*：/, '').trim()
      const plays = body ? body.split('；').map((s) => s.trim()).filter(Boolean) : []
      plays.forEach((text, pi) => {
        const parsed = parsePlayText(text)
        if (!parsed) {
          group.items.push({
            kind: 'play',
            id: `${e.id || index}-play-${pi}`,
            actor: text,
            card: '',
            clauses: [],
            actionTag: null,
          })
          return
        }
        group.items.push({
          kind: 'play',
          id: `${e.id || index}-play-${pi}`,
          actor: parsed.actor,
          card: parsed.card,
          clauses: [],
          actionTag: null,
        })
      })
      return
    }

    const key = phaseKeyFromEvent(e) ?? current?.key ?? 'misc'
    const group = openGroup(key)
    const play = findMergePlay(group, e, room)
    if (play) {
      const clause = eventActionClause(e)
      if (clause && !play.clauses.includes(clause)) play.clauses.push(clause)
      // Prefer the latest meaningful action tag (peek → kill upgrades to 击杀).
      play.actionTag = mergeActionTag(e.kind, e.cardLabel)
      return
    }

    group.items.push({ kind: 'event', id: e.id || `evt-${index}`, event: e })
  })

  return groups.filter((g) => g.items.length > 0)
}

function publicEventTagForGroup(
  e: NinjaPublicNightEvent,
  groupTitle: string
): { label: string; className: string } | null {
  const tag = publicEventTag(e)
  if (!tag) return null
  // Section already names the phase — prefer action verbs over repeating "密探/隐士".
  if (tag.label === groupTitle || (groupTitle === '盲眼刺客' && tag.label === '刺客')) {
    if (e.kind === 'peek') return { label: '窥探', className: 'bg-sky-400/15 text-sky-200' }
    if (e.kind === 'kill') return { label: '击杀', className: 'bg-rose-400/15 text-rose-200' }
    if (e.kind === 'reactive') return { label: '反应', className: 'bg-teal-400/15 text-teal-200' }
    if (e.kind === 'mastermind' || e.kind === 'public_reveal') {
      return { label: '公开', className: 'bg-fuchsia-400/15 text-fuchsia-200' }
    }
    return null
  }
  return tag
}

function publicEventTag(e: NinjaPublicNightEvent): { label: string; className: string } | null {
  const label = (e.cardLabel ?? '').trim()
  const lower = label.toLowerCase()
  if (label.includes('密探') || (e.kind === 'peek' && lower.includes('spy'))) {
    return { label: '密探', className: 'bg-sky-400/15 text-sky-200' }
  }
  if (label.includes('隐士') || (e.kind === 'peek' && lower.includes('mystic'))) {
    return { label: '隐士', className: 'bg-violet-400/15 text-violet-200' }
  }
  if (label.includes('上忍') || label.toLowerCase().includes('shinobi')) {
    return { label: '上忍', className: 'bg-emerald-400/15 text-emerald-200' }
  }
  if (label.includes('盲眼') || label.includes('刺客')) {
    return { label: '刺客', className: 'bg-rose-400/15 text-rose-200' }
  }
  if (label.includes('盗墓')) return { label: '盗墓', className: 'bg-amber-400/15 text-amber-200' }
  if (label.includes('变形')) return { label: '变形', className: 'bg-amber-400/15 text-amber-200' }
  if (label.includes('灵商')) return { label: '灵商', className: 'bg-amber-400/15 text-amber-200' }
  if (label.includes('盗贼')) return { label: '盗贼', className: 'bg-amber-400/15 text-amber-200' }
  if (label.includes('麻烦')) return { label: '麻烦', className: 'bg-amber-400/15 text-amber-200' }
  if (label.includes('审判')) return { label: '审判', className: 'bg-amber-400/15 text-amber-200' }
  if (label.includes('首脑') || e.kind === 'mastermind') {
    return { label: '首脑', className: 'bg-fuchsia-400/15 text-fuchsia-200' }
  }
  if (e.kind === 'phase_plays') return { label: '出牌', className: 'bg-indigo-400/15 text-indigo-200' }
  if (e.kind === 'phase_skip') return { label: '跳过', className: 'bg-slate-400/15 text-slate-300' }
  if (e.kind === 'kill') return { label: '击杀', className: 'bg-rose-400/15 text-rose-200' }
  if (e.kind === 'reactive') return { label: '反应', className: 'bg-teal-400/15 text-teal-200' }
  if (e.kind === 'steal') return { label: '偷窃', className: 'bg-amber-400/15 text-amber-200' }
  if (e.kind === 'public_reveal') return { label: '公开', className: 'bg-amber-400/15 text-amber-200' }
  if (e.kind === 'gravedigger') return { label: '盗墓', className: 'bg-amber-400/15 text-amber-200' }
  if (e.kind === 'spirit_merchant') return { label: '灵商', className: 'bg-amber-400/15 text-amber-200' }
  if (e.kind === 'swap_lock') return { label: '交换', className: 'bg-amber-400/15 text-amber-200' }
  if (e.kind === 'peek') return { label: '窥探', className: 'bg-sky-400/15 text-sky-200' }
  if (label) return { label: label.replace(/\s*\d+$/, ''), className: 'bg-white/[0.08] text-slate-300' }
  return null
}

/** Drop duplicated "Name · Card · …" card segment when a tag already shows the card type. */
function stripLeadingCardLabel(text: string, cardLabel: string | null | undefined): string {
  if (!cardLabel) return text
  // Typical: "Alice · 密探 3 · 查看了 Bob" → keep actor + action after second middle dot pair.
  const parts = text.split(' · ')
  if (parts.length >= 3 && parts[1] === cardLabel) {
    return `${parts[0]} · ${parts.slice(2).join(' · ')}`
  }
  return text
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
  const signature = privateRevealSignature(reveals)
  const prevSigRef = useRef<string>('')
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!signature) {
      prevSigRef.current = ''
      return
    }
    if (prevSigRef.current && prevSigRef.current !== signature) {
      setFlash(true)
      const t = window.setTimeout(() => setFlash(false), 1600)
      prevSigRef.current = signature
      return () => window.clearTimeout(t)
    }
    prevSigRef.current = signature
  }, [signature])

  if (!hasAny) return null
  const players = room.players ?? {}
  return (
    <div
      className={`avalon-card p-4 border border-violet-500/25 bg-violet-950/15 transition-[box-shadow,border-color] duration-300 ${
        flash ? 'animate-reveal-flash border-violet-300/55 shadow-lg shadow-violet-500/25' : ''
      }`}
    >
      <p className="section-label mb-2 text-violet-200">本回合见闻（仅自己可见）</p>
      <div className="flex flex-col gap-1.5 text-[0.8125rem]">
        {reveals?.spyReveals?.map((r, i) => (
          <p key={`spy-${i}`} className="text-violet-100/90">
            <span className="mr-1 rounded bg-sky-400/15 px-1.5 py-0.5 text-[0.625rem] text-sky-200">密探</span>
            {players[r.targetId]?.name ?? r.targetId} 的流派牌：<HouseCardLabel card={r.card} />
          </p>
        ))}
        {reveals?.mysticReveals?.map((r, i) => (
          <p key={`my-${i}`} className="text-violet-100/90">
            <span className="mr-1 rounded bg-violet-400/15 px-1.5 py-0.5 text-[0.625rem] text-violet-200">隐士</span>
            {players[r.targetId]?.name ?? r.targetId}：<HouseCardLabel card={r.card} />
            ；忍者牌随机查看：{r.ninjaCardKind ? ninjaKindLabel(r.ninjaCardKind) : '(无)'}
          </p>
        ))}
        {reveals?.shinobiPeek && (
          <p className="text-violet-100/90">
            <span className="mr-1 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[0.625rem] text-emerald-200">上忍</span>
            偷窥 {players[reveals.shinobiPeek.targetId]?.name ?? reveals.shinobiPeek.targetId} 的流派牌：
            <HouseCardLabel card={reveals.shinobiPeek.card} />
          </p>
        )}
        {reveals?.spiritMerchantViews?.map((r, i) => (
          <p key={`sm-${i}`} className="text-violet-100/90">
            <span className="mr-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[0.625rem] text-amber-200">灵商</span>
            查看 {players[r.targetId]?.name ?? r.targetId}：
            {r.card ? <HouseCardLabel card={r.card} /> : `荣誉标记 ${r.tokenValue ?? '?'} 分`}
          </p>
        ))}
        {reveals?.troublemakerPeek && (
          <p className="text-violet-100/90">
            <span className="mr-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[0.625rem] text-amber-200">麻烦</span>
            偷看 {players[reveals.troublemakerPeek.targetId]?.name ?? reveals.troublemakerPeek.targetId}：
            <HouseCardLabel card={reveals.troublemakerPeek.card} />
          </p>
        )}
        {reveals?.shapeshifterPeeks && (
          <p className="text-violet-100/90">
            <span className="mr-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[0.625rem] text-amber-200">变形</span>
            查看 {players[reveals.shapeshifterPeeks.aId]?.name ?? reveals.shapeshifterPeeks.aId}：
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

function houseCardSig(card: HouseCard): string {
  return card.side === 'ronin' ? 'ronin' : `${card.side}:${card.rank}`
}

function privateRevealSignature(reveals: NinjaPrivateRoundState | null): string {
  if (!reveals) return ''
  return [
    reveals.spyReveals?.length ?? 0,
    reveals.mysticReveals?.length ?? 0,
    reveals.spiritMerchantViews?.length ?? 0,
    reveals.shinobiPeek ? `${reveals.shinobiPeek.targetId}:${houseCardSig(reveals.shinobiPeek.card)}` : '-',
    reveals.troublemakerPeek
      ? `${reveals.troublemakerPeek.targetId}:${houseCardSig(reveals.troublemakerPeek.card)}`
      : '-',
    reveals.shapeshifterPeeks
      ? `${reveals.shapeshifterPeeks.aId}/${reveals.shapeshifterPeeks.bId}`
      : '-',
  ].join('|')
}

/**
 * Public reveals visible to all players: any house cards that have been
 * publicly outed this round (Troublemaker reveal / Thief / Judgement self-reveal).
 */
function PublicRevealsCard({ room }: { room: NinjaRoom }) {
  const houses = room.publiclyRevealedHouses ?? {}
  const ids = Object.keys(houses).length > 0 ? Object.keys(houses) : (room.publiclyRevealedHouseIds ?? [])
  if (ids.length === 0) return null
  const players = room.players ?? {}
  return (
    <div className="avalon-card p-4 border border-amber-500/25 bg-amber-950/10">
      <p className="section-label mb-2 text-amber-200">已公开的流派牌</p>
      <div className="flex flex-col gap-1.5 text-[0.8125rem]">
        {ids.map((id) => {
          const card = houses[id] ?? room.houseCardAssignments?.[id]
          return (
            <p key={id} className="text-amber-100/90">
              {players[id]?.name ?? id}：{card ? <HouseCardLabel card={card} /> : '（未知）'}
            </p>
          )
        })}
      </div>
    </div>
  )
}

function MyHandCard({ hand }: { hand: NinjaCard[] }) {
  if (!hand.length) return null
  return (
    <div className="avalon-card p-4 border border-white/[0.08] bg-slate-950/50">
      <div className="mb-3 flex items-center justify-between">
        <p className="section-label">你的手牌</p>
        <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[0.6875rem] text-slate-400">{hand.length} 张</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-0.5 py-2">
        {hand.map((c) => (
          <div key={c.id} className="min-w-[204px] max-w-[224px]">
            <NinjaCardView card={c} compact />
          </div>
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
  const playerIds = getOrderedPlayerIds(room)
  const masterRevealedIds = reveal.masterRevealedIds ?? []
  const mastermindBlocked = reveal.mastermindBlocked === true
  const me = players[playerId]
  const myAcked = me?.hasAcknowledgedReveal === true
  const ackedCount = playerIds.filter((id) => players[id]?.hasAcknowledgedReveal === true).length
  const totalCount = playerIds.length
  const allAcked = ackedCount >= totalCount && totalCount > 0
  const gameEnded = (room.resultWinnerIds?.length ?? 0) > 0
  return (
    <div className="avalon-card p-5 border border-emerald-500/25 bg-emerald-950/10 animate-result-reveal">
      <p className="section-label mb-1 text-emerald-200">回合结算</p>
      {mastermindBlocked ? (
        <>
          <p className="text-lg font-bold text-white">浪人首脑登场</p>
          <p className="text-xs text-amber-100/85 mt-1">
            {masterRevealedIds.map((id) => players[id]?.name ?? id).join('、')}
            {' '}阻断本回合流派奖励；浪人若存活仍获得 1 个标记。
          </p>
        </>
      ) : masterRevealedIds.length > 0 ? (
        <p className="text-lg font-bold text-white">
          首脑令{reveal.winningHouse === 'crane' ? '鹤之流派' : '莲之流派'}获胜
        </p>
      ) : (
        <p className="text-lg font-bold text-white">
          {reveal.winningHouse === 'crane' ? '鹤之流派获胜' :
           reveal.winningHouse === 'lotus' ? '莲之流派获胜' :
           reveal.winningHouse === 'tie' && reveal.perfectTie ? '完美平局（所有活人各得 1 标记）' :
           reveal.winningHouse === 'none' ? '场上无人存活' : '平局'}
        </p>
      )}
      {reveal.roninWasAlive && (
        <p className="text-xs text-purple-200 mt-1">浪人存活，额外获得 1 个荣誉标记。</p>
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
                  <span className="ml-2 rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[0.625rem] text-amber-200">+{drew.length} 标记</span>
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
  const ids = getOrderedPlayerIds(room)
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
