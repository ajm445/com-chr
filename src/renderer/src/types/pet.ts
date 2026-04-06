export type MovementMode =
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
export type Direction = 'left' | 'right'

export interface MovementData {
  x: number
  y: number
  mode: MovementMode
  direction: Direction
}

// --- Stack C: 다마고치 상태 ---

export interface PetState {
  hunger: number       // 0-100, 높을수록 배부름
  happiness: number    // 0-100
  cleanliness: number  // 0-100
  exp: number          // 누적 경험치
  level: number        // 현재 레벨 (1~10)
  lastTickTime: number // Date.now()
}

export interface MoodModifier {
  speedMultiplier: number
  jumpChance: number
  idleMultiplier: number
}

// 레벨 N에 필요한 누적 EXP = 15 * N * (N+1)
// Lv1=0, Lv2=30, Lv3=90, Lv4=180, Lv5=300, ...
export function expForLevel(level: number): number {
  return 15 * level * (level + 1)
}

export const DEFAULT_PET_STATE: PetState = {
  hunger: 80,
  happiness: 80,
  cleanliness: 80,
  exp: 0,
  level: 1,
  lastTickTime: Date.now(),
}

export const DECAY_RATES = {
  hunger: 0.5,       // ~33분에 100→0
  happiness: 0.2,    // ~83분에 100→0
  cleanliness: 0.3,  // ~55분에 100→0
} as const

export const TICK_INTERVAL = 10_000 // 10초
export const MAX_OFFLINE_TICKS = 8640 // 24시간 상한
