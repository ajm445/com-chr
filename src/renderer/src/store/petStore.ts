import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PetState, MoodModifier } from '../types/pet'
import {
  DEFAULT_PET_STATE, DECAY_RATES, TICK_INTERVAL, MAX_OFFLINE_TICKS,
  expForLevel,
} from '../types/pet'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getStatAvg(s: PetState): number {
  return (s.hunger + s.happiness + s.cleanliness) / 3
}

function getExpMultiplier(statAvg: number): number {
  if (statAvg >= 70) return 2.0
  if (statAvg >= 40) return 1.0
  if (statAvg >= 20) return 0.3
  return 0
}

function calcLevel(exp: number): number {
  let lv = 1
  while (exp >= expForLevel(lv)) lv++
  return lv
}

interface PetStore extends PetState {
  // 파생 상태
  isStarving: () => boolean
  isSad: () => boolean
  isDirty: () => boolean
  getMoodModifier: () => MoodModifier
  getExpProgress: () => { current: number; next: number; percent: number }

  // 상호작용
  feed: () => void
  pet: () => void
  play: () => void
  clean: () => void

  // 내부
  tick: () => void
  applyOfflineDecay: () => void
  reset: () => void
}

export const usePetStore = create<PetStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PET_STATE,

      isStarving: () => get().hunger <= 20,
      isSad: () => get().happiness <= 20,
      isDirty: () => get().cleanliness <= 30,

      getMoodModifier: (): MoodModifier => {
        const { hunger, happiness, cleanliness } = get()
        const avg = (hunger + happiness + cleanliness) / 3
        return {
          speedMultiplier: hunger <= 20 ? 0.5 : 1.0,
          jumpChance: hunger <= 20 ? 0 : happiness >= 80 ? 0.25 : 0.15,
          idleMultiplier: happiness <= 20 ? 2.0 : 1.0,
          sadChance: avg <= 20 ? 1.0 : avg <= 40 ? 0.5 : 0,
        }
      },

      getExpProgress: () => {
        const { exp, level } = get()
        const currentLevelExp = expForLevel(level - 1)
        const nextLevelExp = expForLevel(level)
        const current = exp - currentLevelExp
        const next = nextLevelExp - currentLevelExp
        return {
          current,
          next,
          percent: Math.min(100, (current / next) * 100),
        }
      },

      feed: () => set((s) => {
        const newExp = s.exp + 3
        return {
          hunger: clamp(s.hunger + 10, 0, 100),
          exp: newExp,
          level: calcLevel(newExp),
        }
      }),

      pet: () => set((s) => {
        const newExp = s.exp + 2
        return {
          happiness: clamp(s.happiness + 1, 0, 100),
          exp: newExp,
          level: calcLevel(newExp),
        }
      }),

      play: () => set((s) => {
        const newExp = s.exp + 5
        return {
          happiness: clamp(s.happiness + 10, 0, 100),
          exp: newExp,
          level: calcLevel(newExp),
        }
      }),

      clean: () => set((s) => {
        const newExp = s.exp + 2
        return {
          cleanliness: clamp(s.cleanliness + 10, 0, 100),
          exp: newExp,
          level: calcLevel(newExp),
        }
      }),

      tick: () => set((s) => {
        // 스탯 감소
        const newHunger = clamp(s.hunger - DECAY_RATES.hunger, 0, 100)
        const newCleanliness = clamp(s.cleanliness - DECAY_RATES.cleanliness, 0, 100)

        // 배고프거나 더러우면 행복도 추가 감소 (50 이하 느리게, 30 이하 빠르게)
        let happinessPenalty = 0
        if (newHunger <= 30) happinessPenalty += 0.3
        else if (newHunger <= 50) happinessPenalty += 0.1
        if (newCleanliness <= 30) happinessPenalty += 0.25
        else if (newCleanliness <= 50) happinessPenalty += 0.08
        const newHappiness = clamp(s.happiness - DECAY_RATES.happiness - happinessPenalty, 0, 100)

        // 패시브 EXP: 스탯 평균에 따라 배율
        const avg = (newHunger + newHappiness + newCleanliness) / 3
        const expGain = 1 * getExpMultiplier(avg)
        const newExp = s.exp + expGain
        const newLevel = calcLevel(newExp)

        return {
          hunger: newHunger,
          happiness: newHappiness,
          cleanliness: newCleanliness,
          exp: newExp,
          level: newLevel,
          lastTickTime: Date.now(),
        }
      }),

      applyOfflineDecay: () => set((s) => {
        const now = Date.now()
        const elapsed = now - s.lastTickTime
        if (elapsed <= 0) return { lastTickTime: now }

        const ticks = Math.min(Math.floor(elapsed / TICK_INTERVAL), MAX_OFFLINE_TICKS)

        // 스탯 감소
        const newHunger = clamp(s.hunger - ticks * DECAY_RATES.hunger, 0, 100)
        const newCleanliness = clamp(s.cleanliness - ticks * DECAY_RATES.cleanliness, 0, 100)

        // 오프라인 중 행복도 추가 감소 (50 이하/30 이하 구간)
        let happinessPenalty = 0
        if (newHunger <= 30) happinessPenalty += 0.3 * ticks
        else if (newHunger <= 50) happinessPenalty += 0.1 * ticks
        if (newCleanliness <= 30) happinessPenalty += 0.25 * ticks
        else if (newCleanliness <= 50) happinessPenalty += 0.08 * ticks
        const newHappiness = clamp(s.happiness - ticks * DECAY_RATES.happiness - happinessPenalty, 0, 100)

        // 오프라인 EXP: 마지막 스탯 기준으로 근사
        const avgAtClose = getStatAvg(s)
        const offlineExp = ticks * 1 * getExpMultiplier(avgAtClose)
        const newExp = s.exp + offlineExp
        const newLevel = calcLevel(newExp)

        return {
          hunger: newHunger,
          happiness: newHappiness,
          cleanliness: newCleanliness,
          exp: newExp,
          level: newLevel,
          lastTickTime: now,
        }
      }),

      reset: () => set({ ...DEFAULT_PET_STATE, lastTickTime: Date.now() }),
    }),
    {
      name: 'pet-state',
      partialize: (s) => ({
        hunger: s.hunger,
        happiness: s.happiness,
        cleanliness: s.cleanliness,
        exp: s.exp,
        level: s.level,
        lastTickTime: s.lastTickTime,
      }),
    }
  )
)
