import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../services/firebase'
import {
  kickPlayerFromNinjaLobby,
  setNinjaPlayerReady,
  setNinjaTargetPlayerCount,
  sitNinjaSeat,
  startNinjaGame,
} from '../services/ninjaEngine'
import type { NinjaRoom } from '../types/ninja'
import { NinjaRulesSheet } from '../components/NinjaRulesSheet'
import { NinjaSeatTable } from '../components/NinjaSeatTable'

type NinjaLobbyPageProps = {
  roomId: string
  playerId: string
  onBack: () => void
  onRemovedFromLobby?: () => void
  onEnterGame?: () => void
}

export function NinjaLobbyPage({
  roomId,
  playerId,
  onBack,
  onRemovedFromLobby,
  onEnterGame,
}: NinjaLobbyPageProps) {
  const [room, setRoom] = useState<NinjaRoom | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [kickError, setKickError] = useState('')
  const [kickingId, setKickingId] = useState<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const wasInLobbyWithSelf = useRef(false)

  useEffect(() => {
    const roomRef = ref(db, `ninjaRooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.exists() ? (snapshot.val() as NinjaRoom) : null)
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
    if (!room) return
    if (room.state !== 'LOBBY') onEnterGame?.()
  }, [room, onEnterGame])

  const playerIds = useMemo(() => {
    const players = room?.players ?? {}
    const seated = (room?.seatOrder ?? []).filter((id) => !!players[id])
    const unseated = Object.keys(players)
      .filter((id) => !seated.includes(id))
      .sort()
    return [...seated, ...unseated]
  }, [room?.players, room?.seatOrder])
  const seatedIds = useMemo(
    () => Object.entries(room?.seatAssignments ?? {})
      .filter(([id]) => !!room?.players?.[id])
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id),
    [room?.players, room?.seatAssignments]
  )
  const isHost = room?.hostId === playerId
  const myReady = room?.players?.[playerId]?.ready ?? false
  const meSeated = seatedIds.includes(playerId)
  const highestOccupiedSeat = Math.max(-1, ...Object.values(room?.seatAssignments ?? {}))
  const minAllowedTargetCount = Math.min(11, Math.max(4, playerIds.length, highestOccupiedSeat + 1))
  const targetPlayerCount = Math.min(11, Math.max(room?.targetPlayerCount ?? 4, minAllowedTargetCount))
  const allReady =
    seatedIds.length === targetPlayerCount &&
    Object.keys(room?.players ?? {}).length === targetPlayerCount &&
    seatedIds.every((id) => room?.players[id]?.ready)
  const isOdd = targetPlayerCount % 2 === 1
  const perHouse = Math.floor(targetPlayerCount / 2)

  async function handleReady() {
    setError('')
    try {
      await setNinjaPlayerReady(roomId, playerId, !myReady)
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  async function handleSeatClick(seatIndex: number, seatedPlayerId: string | null) {
    setError('')
    try {
      if (seatedPlayerId) return
      if (myReady) return
      await sitNinjaSeat(roomId, playerId, seatIndex)
    } catch (e) {
      setError(e instanceof Error ? e.message : '选座失败')
    }
  }

  async function handleTargetCountChange(nextCount: number) {
    if (!isHost) return
    setError('')
    try {
      await setNinjaTargetPlayerCount(roomId, playerId, nextCount)
    } catch (e) {
      setError(e instanceof Error ? e.message : '人数设置失败')
    }
  }

  async function handleKick(targetId: string) {
    if (!isHost) return
    setKickError('')
    setKickingId(targetId)
    try {
      await kickPlayerFromNinjaLobby(roomId, playerId, targetId)
    } catch (e) {
      setKickError(e instanceof Error ? e.message : '踢人失败')
    } finally {
      setKickingId(null)
    }
  }

  async function handleStart() {
    if (!isHost) return
    setError('')
    setStarting(true)
    try {
      await startNinjaGame(roomId, playerId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '开始失败')
    } finally {
      setStarting(false)
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
    <div className="relative min-h-dvh overflow-hidden px-4 pb-8 pt-4 text-slate-100 animate-page-enter">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(225,29,72,0.18),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(37,99,235,0.14),transparent_28%),linear-gradient(180deg,#020617,#070a13_46%,#020617)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-slate-950/65 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] rounded-xl px-3 text-sm font-semibold text-slate-300 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white active:text-white cursor-pointer"
        >
          返回
        </button>
        <div className="text-center">
          <p className="text-[0.625rem] uppercase tracking-[0.24em] text-rose-200/70">Ninja Room</p>
          <p className="font-mono text-sm tracking-wider text-slate-100">{roomId}</p>
        </div>
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="min-h-[40px] rounded-xl px-3 text-sm font-semibold text-slate-300 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white active:text-white cursor-pointer"
        >
          规则
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_390px]">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-rose-200/10 bg-slate-950/75 p-5 shadow-2xl shadow-rose-950/20 backdrop-blur">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-rose-500/15 blur-3xl" />
          <div className="flex items-start gap-4">
            <div className="inline-flex flex-col items-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=104x104&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?game=ninja&room=${roomId}` : '')}`}
                alt="Scan to join ninja room"
                width={104}
                height={104}
                className="block rounded-xl border border-white/[0.08]"
              />
              <p className="text-[0.625rem] text-slate-500 mt-2 tracking-wide">扫码加入</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.625rem] uppercase tracking-[0.28em] text-rose-200/70">Ready Chamber</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">选择你的座位</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">点击任意空位入座；准备前可以换座，准备后座位锁定。开局后，座位就是你的出牌方位。</p>
              <p className="mt-3 rounded-xl border border-amber-200/10 bg-amber-300/10 px-3 py-2 text-xs text-amber-100/80">
                座位顺序会决定轮抽传牌方向和同优先级行动顺序。
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/[0.08] bg-slate-950/70 p-4 shadow-2xl shadow-black/20 backdrop-blur lg:row-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-rose-200/75">Round Table</h2>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[0.6875rem] text-slate-300">{seatedIds.length} / {targetPlayerCount}</span>
          </div>
          <NinjaSeatTable room={room} viewerPlayerId={playerId} mode="lobby" onSeatClick={handleSeatClick} />
          {!meSeated && <p className="mt-3 text-center text-xs font-medium text-amber-100/85">你还没有入座，请点击任意空位。</p>}
          {meSeated && !myReady && <p className="mt-3 text-center text-xs text-slate-400">你已入座。准备前可点击其他空位换座。</p>}
          {meSeated && myReady && <p className="mt-3 text-center text-xs text-emerald-200/80">你已准备，座位已锁定。取消准备后可换座。</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-xl shadow-black/25">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-rose-950/55 to-transparent" />
            <p className="relative text-[0.625rem] uppercase tracking-[0.22em] text-slate-500">Roster</p>
            <div className="relative mt-2 flex items-end gap-1">
              <span className="text-3xl font-black leading-none text-white">{playerIds.length}</span>
              <span className="pb-0.5 text-sm font-bold text-slate-500">/ {targetPlayerCount}</span>
            </div>
            <p className="relative mt-1 text-xs text-slate-400">已加入 / 本局人数</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-[#2a3040] bg-[#070b13] p-4 shadow-xl shadow-black/25">
            <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-500/[0.06] blur-2xl" />
            <p className="relative text-[0.625rem] uppercase tracking-[0.24em] text-slate-500">Factions</p>
            <div className="relative mt-3 flex flex-col gap-2">
              <div className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0d121c] px-3 py-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-rose-300/55 shadow-[0_0_10px_rgba(253,164,175,0.25)]" />
                  鹤之流派
                </span>
                <span className="rounded-lg border border-amber-100/15 bg-amber-100/[0.07] px-2 py-0.5 font-mono text-xs font-black text-amber-100">×{perHouse}</span>
              </div>
              <div className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0d121c] px-3 py-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-sky-300/55 shadow-[0_0_10px_rgba(125,211,252,0.22)]" />
                  莲之流派
                </span>
                <span className="rounded-lg border border-amber-100/15 bg-amber-100/[0.07] px-2 py-0.5 font-mono text-xs font-black text-amber-100">×{perHouse}</span>
              </div>
              {isOdd && (
                <div className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0d121c] px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-violet-300/60 shadow-[0_0_10px_rgba(196,181,253,0.22)]" />
                    浪人
                  </span>
                  <span className="rounded-lg border border-amber-100/15 bg-amber-100/[0.07] px-2 py-0.5 font-mono text-xs font-black text-amber-100">×1</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {isHost && (
          <div className="rounded-[1.75rem] border border-white/[0.08] bg-slate-950/65 p-4 shadow-xl shadow-black/10 backdrop-blur">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-slate-400">Player Count</h2>
                <p className="mt-1 text-xs text-slate-500">选择本局人数。不能小于当前已加入人数或已占用最高座位。</p>
              </div>
              <span className="inline-flex min-h-[34px] shrink-0 items-center justify-center self-start rounded-xl border border-rose-200/20 bg-[#241522] px-3 py-1 text-sm font-black text-rose-100 sm:h-16 sm:w-16 sm:self-center sm:rounded-full sm:px-0 sm:py-0">
                {targetPlayerCount} 人
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {Array.from({ length: 8 }, (_, i) => i + 4).map((count) => {
                const active = count === targetPlayerCount
                const disabled = count < minAllowedTargetCount
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleTargetCountChange(count)}
                    disabled={disabled}
                    className={`min-h-[40px] rounded-xl border text-sm font-black transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-100 ${
                      active
                        ? 'border-rose-100/60 bg-rose-500/30 text-rose-50'
                        : 'border-white/[0.08] bg-white/[0.035] text-slate-300 hover:border-rose-200/30 hover:bg-rose-400/10'
                    } disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer`}
                  >
                    {count}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-[1.75rem] border border-white/[0.08] bg-slate-950/65 p-4 shadow-xl shadow-black/10 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-slate-400">Players</h2>
            {isHost && <span className="text-[0.6875rem] text-slate-500">房主可踢人</span>}
          </div>
          {kickError && <p className="text-red-400/90 text-sm mb-2">{kickError}</p>}
          <div className="flex flex-col gap-2">
            {playerIds.map((id) => {
              const p = room.players[id]
              if (!p) return null
              const seated = seatedIds.includes(id)
              const ready = p.ready
              return (
                <div
                  key={id}
                  className={`flex min-h-[50px] items-center justify-between rounded-2xl border px-3 text-sm transition-colors duration-200 ${
                    ready
                      ? 'border-emerald-200/20 bg-emerald-300/[0.055]'
                      : 'border-white/[0.07] bg-white/[0.035]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                        ready
                          ? 'border-emerald-100/70 bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.55)]'
                          : 'border-slate-300/20 bg-slate-600'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-semibold text-slate-100">{p.name}</span>
                        {id === playerId && <span className="shrink-0 rounded-full bg-indigo-300/10 px-1.5 py-0.5 text-[0.625rem] text-indigo-200">你</span>}
                        {room.hostId === id && <span className="shrink-0 rounded-full bg-amber-300/10 px-1.5 py-0.5 text-[0.625rem] text-amber-200">房主</span>}
                      </div>
                      <p className={`text-[0.6875rem] ${ready ? 'text-emerald-200/80' : 'text-slate-500'}`}>
                        {seated ? '已入座' : '未入座'} · {ready ? '已准备' : '未准备'}
                      </p>
                    </div>
                  </div>
                  {isHost && id !== playerId && (
                    <button
                      type="button"
                      onClick={() => handleKick(id)}
                      disabled={kickingId === id}
                      className="rounded-lg border border-red-400/20 px-2 py-1 text-xs text-red-200 transition-colors duration-200 hover:bg-red-400/10 disabled:opacity-50 cursor-pointer"
                    >
                      {kickingId === id ? '移除中' : '踢出'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {error && <p className="text-sm text-red-400/90">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <button
            type="button"
            onClick={handleReady}
            disabled={!meSeated}
            className={`min-h-[52px] rounded-2xl px-4 py-3 font-black text-white shadow-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-100 ${
              myReady
                ? 'border border-slate-500 bg-[#151a25] text-slate-200 hover:bg-[#1c2330]'
                : 'border border-rose-200/25 bg-[linear-gradient(135deg,#5c1029,#131827,#12316f)] text-rose-50 shadow-rose-950/25 hover:border-rose-100/45'
            } disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-[#101622] disabled:text-slate-500 cursor-pointer`}
          >
            {!meSeated ? '请先入座' : myReady ? '取消准备' : '准备'}
          </button>

          {isHost && (
            <button
              type="button"
              onClick={handleStart}
              disabled={!allReady || starting}
              className="min-h-[52px] rounded-2xl border border-emerald-200/20 bg-[#063237] px-4 py-3 font-black text-emerald-50 shadow-xl transition-all duration-200 hover:bg-[#0a4448] disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-[#0b1f24] disabled:text-slate-500 cursor-pointer"
            >
            {starting ? '开始中…' : allReady ? '开始游戏' : `等待 ${targetPlayerCount} 名玩家入座且准备`}
            </button>
          )}
        </div>
      </div>
      </div>
      <NinjaRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}
