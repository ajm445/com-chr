/**
 * 재사용 가능한 펫 상태 픽스처
 * 각 테스트는 이 픽스처를 spread하여 필요한 필드만 덮어씁니다.
 */

import type { PetState } from '@renderer/types/pet'

const BASE_TIME = 1_700_000_000_000 // 고정 기준 타임스탬프 (2023-11-14)

/** 막 태어난 건강한 펫 */
export const NEWBORN: PetState = {
  hunger: 80,
  happiness: 80,
  cleanliness: 80,
  exp: 0,
  level: 1,
  lastTickTime: BASE_TIME,
}

/** 중간 레벨, 평범한 상태 */
export const MID_LEVEL: PetState = {
  hunger: 60,
  happiness: 60,
  cleanliness: 60,
  exp: 90,   // Lv3 기준점 (expForLevel(2) = 90)
  level: 3,
  lastTickTime: BASE_TIME,
}

/** 최대 레벨 (Lv10) */
export const MAX_LEVEL: PetState = {
  hunger: 100,
  happiness: 100,
  cleanliness: 100,
  exp: 9999,
  level: 10,
  lastTickTime: BASE_TIME,
}

/** 굶주린 펫 (hunger <= 20) */
export const STARVING: PetState = {
  hunger: 10,
  happiness: 50,
  cleanliness: 50,
  exp: 0,
  level: 1,
  lastTickTime: BASE_TIME,
}

/** 슬픈 펫 (happiness <= 20) */
export const SAD_PET: PetState = {
  hunger: 50,
  happiness: 10,
  cleanliness: 50,
  exp: 0,
  level: 1,
  lastTickTime: BASE_TIME,
}

/** 더러운 펫 (cleanliness <= 30) */
export const DIRTY_PET: PetState = {
  hunger: 50,
  happiness: 50,
  cleanliness: 20,
  exp: 0,
  level: 1,
  lastTickTime: BASE_TIME,
}

/** 모든 스탯이 0에 가까운 위기 펫 */
export const CRITICAL_PET: PetState = {
  hunger: 1,
  happiness: 1,
  cleanliness: 1,
  exp: 0,
  level: 1,
  lastTickTime: BASE_TIME,
}

/** 모든 스탯이 최대인 행복한 펫 */
export const HAPPY_PET: PetState = {
  hunger: 100,
  happiness: 100,
  cleanliness: 100,
  exp: 0,
  level: 1,
  lastTickTime: BASE_TIME,
}

export { BASE_TIME }
