interface MovementData {
  x: number
  y: number
  mode:
    | 'idle'
    | 'walking'
    | 'jumping'
    | 'dragging'
    | 'falling'
    | 'landing'
    | 'petting'
    | 'eating'
    | 'sad'
    | 'happy'
  direction: 'left' | 'right'
}

interface ElectronAPI {
  onMovementUpdate: (callback: (data: MovementData) => void) => () => void
  forceJump: () => void
  dragStart: () => void
  dragMove: (dx: number, dy: number) => void
  dragEnd: () => void
  triggerInteraction: (type: 'petting' | 'eating' | 'sad' | 'happy') => void
  quitApp: () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
