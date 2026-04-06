import Store from 'electron-store'

interface PetStateData {
  hunger: number
  happiness: number
  cleanliness: number
  exp: number
  level: number
  lastTickTime: number
}

const DEFAULT_STATE: PetStateData = {
  hunger: 80,
  happiness: 80,
  cleanliness: 80,
  exp: 0,
  level: 1,
  lastTickTime: Date.now(),
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function validate(raw: unknown): PetStateData {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATE, lastTickTime: Date.now() }
  const obj = raw as Record<string, unknown>
  return {
    hunger: typeof obj.hunger === 'number' && Number.isFinite(obj.hunger)
      ? clamp(obj.hunger, 0, 100) : DEFAULT_STATE.hunger,
    happiness: typeof obj.happiness === 'number' && Number.isFinite(obj.happiness)
      ? clamp(obj.happiness, 0, 100) : DEFAULT_STATE.happiness,
    cleanliness: typeof obj.cleanliness === 'number' && Number.isFinite(obj.cleanliness)
      ? clamp(obj.cleanliness, 0, 100) : DEFAULT_STATE.cleanliness,
    exp: typeof obj.exp === 'number' && Number.isFinite(obj.exp)
      ? Math.max(0, obj.exp) : DEFAULT_STATE.exp,
    level: typeof obj.level === 'number' && obj.level >= 1
      ? Math.floor(obj.level) : DEFAULT_STATE.level,
    lastTickTime: typeof obj.lastTickTime === 'number' && obj.lastTickTime > 0
      ? obj.lastTickTime : Date.now(),
  }
}

const store = new Store<{ petState: PetStateData }>({
  defaults: { petState: DEFAULT_STATE },
})

export function loadPetState(): PetStateData {
  try {
    return validate(store.get('petState'))
  } catch {
    return { ...DEFAULT_STATE, lastTickTime: Date.now() }
  }
}

export function savePetState(state: PetStateData): void {
  try {
    store.set('petState', validate(state))
  } catch {
    // 저장 실패 무시
  }
}
