import { useEffect, useState } from 'react'
import { createRoom, joinRoom, reconnectRoom } from '../services/gameEngine'
import { loadSession } from '../utils/sessionStorage'

type HomePageProps = {
  notice?: string
  onClearNotice?: () => void
  /** First-load reconnect failed (e.g. offline); session still saved — user can retry */
  showRestoreBanner?: boolean
  onRetryRestore?: () => void | Promise<void>
  onEnterLobby: (roomId: string, playerId: string, isHost: boolean) => void
  onReconnect?: (roomId: string, playerId: string, isHost: boolean, state: string) => void
}

export function HomePage({
  notice,
  onClearNotice,
  showRestoreBanner,
  onRetryRestore,
  onEnterLobby,
  onReconnect,
}: HomePageProps) {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')?.trim().toUpperCase()
    if (room) setRoomCode(room)
  }, [])

  async function handleCreateRoom() {
    setError('')
    if (!name.trim()) {
      setError('Enter your name')
      return
    }
    setLoading(true)
    try {
      const { roomId, hostId } = await createRoom(name.trim())
      onEnterLobby(roomId, hostId, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinRoom() {
    setError('')
    const code = roomCode.trim().toUpperCase()
    if (!code) {
      setError('Enter room code')
      return
    }
    if (!joinName.trim()) {
      setError('Enter your name')
      return
    }
    setLoading(true)
    try {
      const { playerId } = await joinRoom(code, joinName.trim())
      onEnterLobby(code, playerId, false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to join room'
      if (msg === 'Game has already started' && onReconnect) {
        const session = loadSession()
        if (session?.roomId === code && session?.playerId) {
          try {
            const { roomId, playerId, isHost, state } = await reconnectRoom(code, session.playerId)
            onReconnect(roomId, playerId, isHost, state)
            return
          } catch {
            setError('游戏已开始。若你刚掉线，请刷新页面自动恢复；否则无法加入已开始的对局。')
            return
          }
        }
        setError('游戏已开始。若你刚掉线，请刷新页面自动恢复；否则无法加入已开始的对局。')
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 safe-area">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Avalon</h1>
      <p className="text-gray-500 text-sm mb-6">组队与任务助手</p>
      {notice && (
        <div className="w-full max-w-xs mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2 items-start">
          <span className="flex-1">{notice}</span>
          {onClearNotice && (
            <button type="button" onClick={onClearNotice} className="shrink-0 text-amber-800 font-medium underline">
              关闭
            </button>
          )}
        </div>
      )}
      {showRestoreBanner && onRetryRestore && (
        <div className="w-full max-w-xs mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="mb-2">检测到你上次未退出的房间，但暂时无法连接（常见于网络不稳定）。可重试恢复，或检查网络后刷新页面。</p>
          <button
            type="button"
            disabled={restoreLoading}
            onClick={async () => {
              setRestoreLoading(true)
              try {
                await onRetryRestore()
              } finally {
                setRestoreLoading(false)
              }
            }}
            className="w-full min-h-[44px] rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
          >
            {restoreLoading ? '连接中…' : '重试回到房间'}
          </button>
        </div>
      )}
      {error && <p className="text-red-600 text-sm mb-3 w-full max-w-xs text-center">{error}</p>}
      <div className="flex flex-col gap-5 w-full max-w-xs">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-600">创建房间</label>
          <input
            type="text"
            placeholder="你的名字"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-[48px] border border-gray-300 rounded-xl px-4 py-3 text-base"
            aria-label="Your name for create"
          />
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={loading}
            className="min-h-[48px] bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
          >
            创建房间
          </button>
        </div>
        <hr className="border-gray-200" />
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-600">加入房间</label>
          <input
            type="text"
            placeholder="房间码"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="min-h-[48px] border border-gray-300 rounded-xl px-4 py-3 font-mono uppercase text-base"
            aria-label="Room code"
            maxLength={6}
          />
          <input
            type="text"
            placeholder="你的名字"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            className="min-h-[48px] border border-gray-300 rounded-xl px-4 py-3 text-base"
            aria-label="Your name for join"
          />
          <button
            type="button"
            onClick={handleJoinRoom}
            disabled={loading}
            className="min-h-[48px] bg-green-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
          >
            加入房间
          </button>
        </div>
      </div>
    </div>
  )
}
