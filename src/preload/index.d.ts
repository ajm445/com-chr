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

interface PetStateData {
  hunger: number
  happiness: number
  cleanliness: number
  lastTickTime: number
}

interface MoodModifierData {
  speedMultiplier: number
  jumpChance: number
  idleMultiplier: number
}

interface ElectronAPI {
  onMovementUpdate: (callback: (data: MovementData) => void) => () => void
  forceJump: () => void
  dragStart: () => void
  dragMove: (dx: number, dy: number) => void
  dragEnd: () => void
  triggerInteraction: (type: 'petting' | 'eating' | 'sad' | 'happy') => void
  saveState: (state: PetStateData) => void
  loadState: () => Promise<PetStateData>
  sendMoodModifier: (mod: MoodModifierData) => void
  showContextMenu: () => void
  onClean: (callback: () => void) => () => void
  setClickThrough: (ignore: boolean) => void
  expandWindow: (expanded: boolean) => void
  quitApp: () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
