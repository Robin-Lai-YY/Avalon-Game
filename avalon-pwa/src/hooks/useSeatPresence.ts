import { useEffect, useRef } from 'react'
import { startPresenceHeartbeat, watchSeatGeneration } from '../services/presence'

type UseSeatPresenceOptions = {
  /** e.g. `rooms/ABC123` */
  roomPath: string
  playerId: string
  /** Generation captured when this client claimed/joined the seat. */
  seatGeneration: number
  enabled?: boolean
  onSeatTakenOver: () => void
}

/**
 * Keeps lastSeen fresh and exits if another client reclaim bumps seatGeneration.
 */
export function useSeatPresence({
  roomPath,
  playerId,
  seatGeneration,
  enabled = true,
  onSeatTakenOver,
}: UseSeatPresenceOptions): void {
  const onTakenOverRef = useRef(onSeatTakenOver)
  onTakenOverRef.current = onSeatTakenOver

  useEffect(() => {
    if (!enabled || !roomPath || !playerId) return

    const stopHeartbeat = startPresenceHeartbeat(roomPath, playerId)
    const unsubGen = watchSeatGeneration(roomPath, playerId, seatGeneration, () => {
      onTakenOverRef.current()
    })

    return () => {
      stopHeartbeat()
      unsubGen()
    }
  }, [roomPath, playerId, seatGeneration, enabled])
}
