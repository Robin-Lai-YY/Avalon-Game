import { useCallback, useEffect, useRef, useState } from 'react'
import type { MotionPermissionState } from './types'

type ShakeDetectionOptions = {
  enabled?: boolean
  onShake: () => void
  threshold?: number
  cooldownMs?: number
}

type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

function getInitialPermissionState(): MotionPermissionState {
  if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
    return 'unsupported'
  }

  const motionCtor = window.DeviceMotionEvent as DeviceMotionEventWithPermission
  if (typeof motionCtor.requestPermission === 'function') {
    return 'prompt'
  }

  return 'granted'
}

export function useShakeDetection({
  enabled = true,
  onShake,
  threshold = 22,
  cooldownMs = 1600,
}: ShakeDetectionOptions) {
  const [permissionState, setPermissionState] = useState<MotionPermissionState>(getInitialPermissionState)
  const onShakeRef = useRef(onShake)

  useEffect(() => {
    onShakeRef.current = onShake
  }, [onShake])

  useEffect(() => {
    if (!enabled || permissionState !== 'granted') return

    const lastSample = {
      x: 0,
      y: 0,
      z: 0,
      valid: false,
    }
    let lastTriggerAt = 0

    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity ?? event.acceleration
      if (!acceleration) return

      const x = acceleration.x ?? 0
      const y = acceleration.y ?? 0
      const z = acceleration.z ?? 0

      if (!lastSample.valid) {
        lastSample.x = x
        lastSample.y = y
        lastSample.z = z
        lastSample.valid = true
        return
      }

      const intensity =
        Math.abs(x - lastSample.x) + Math.abs(y - lastSample.y) + Math.abs(z - lastSample.z)

      lastSample.x = x
      lastSample.y = y
      lastSample.z = z

      const now = Date.now()
      if (intensity >= threshold && now - lastTriggerAt >= cooldownMs) {
        lastTriggerAt = now
        onShakeRef.current()
      }
    }

    window.addEventListener('devicemotion', handleMotion)
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [cooldownMs, enabled, permissionState, threshold])

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      setPermissionState('unsupported')
      return 'unsupported' as const
    }

    const motionCtor = window.DeviceMotionEvent as DeviceMotionEventWithPermission
    if (typeof motionCtor.requestPermission !== 'function') {
      setPermissionState('granted')
      return 'granted' as const
    }

    try {
      const result = await motionCtor.requestPermission()
      const nextState = result === 'granted' ? 'granted' : 'denied'
      setPermissionState(nextState)
      return nextState
    } catch {
      setPermissionState('denied')
      return 'denied' as const
    }
  }, [])

  return {
    supported: permissionState !== 'unsupported',
    permissionState,
    canRequestPermission: permissionState === 'prompt',
    requestPermission,
  }
}
