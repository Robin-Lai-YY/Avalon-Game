export type DiceCupStatus = 'IDLE' | 'SHAKING' | 'CLOSED' | 'OPEN'

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6

export type MotionPermissionState = 'unsupported' | 'prompt' | 'granted' | 'denied'

export type DieModel = {
  id: string
  value: DieValue
  rotation: number
  tiltX: number
  tiltY: number
  layoutX: number
  layoutY: number
  scale: number
  layer: number
  offsetX: number
  offsetY: number
  rattleX: number
  rattleY: number
}
