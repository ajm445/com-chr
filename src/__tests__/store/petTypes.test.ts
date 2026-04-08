/**
 * types/pet.ts — expForLevel, DECAY_RATES, 상수값 검증
 *
 * 버그 우선순위: 레벨 공식 오류 → calcLevel 무한루프 → 상수 불합리성
 */

import { expForLevel, DECAY_RATES, TICK_INTERVAL, MAX_OFFLINE_TICKS } from '@renderer/types/pet'

// ─────────────────────────────────────────────
// expForLevel 공식: 15 * N * (N+1)
// Lv0=0, Lv1=30, Lv2=90, Lv3=180, Lv4=300 ...
// ─────────────────────────────────────────────
describe('expForLevel 공식 검증', () => {
  it('level 0은 0을 반환한다', () => {
    expect(expForLevel(0)).toBe(0)
  })

  it('level 1은 30을 반환한다', () => {
    // 15 * 1 * 2 = 30
    expect(expForLevel(1)).toBe(30)
  })

  it('level 2는 90을 반환한다', () => {
    // 15 * 2 * 3 = 90
    expect(expForLevel(2)).toBe(90)
  })

  it('level 3은 180을 반환한다', () => {
    // 15 * 3 * 4 = 180
    expect(expForLevel(3)).toBe(180)
  })

  it('level 4는 300을 반환한다', () => {
    // 15 * 4 * 5 = 300
    expect(expForLevel(4)).toBe(300)
  })

  it('level 9는 1350을 반환한다 (Lv10 기준점)', () => {
    // 15 * 9 * 10 = 1350
    expect(expForLevel(9)).toBe(1350)
  })

  it('공식이 순증가(단조증가)한다', () => {
    for (let lv = 0; lv < 20; lv++) {
      expect(expForLevel(lv + 1)).toBeGreaterThan(expForLevel(lv))
    }
  })

  it('레벨 간 필요 exp 간격이 점진적으로 커진다 (진행 곡선)', () => {
    // 각 레벨 업에 필요한 EXP가 이전보다 항상 크다 → 후반이 더 어려워야 함
    const gaps = Array.from({ length: 9 }, (_, i) => expForLevel(i + 1) - expForLevel(i))
    for (let i = 0; i < gaps.length - 1; i++) {
      expect(gaps[i + 1]).toBeGreaterThan(gaps[i])
    }
  })

  // 경계값: 음수 레벨은 수학적으로 음수 exp를 반환 → validate에서 막아야 함
  it('음수 레벨은 의도치 않은 값을 반환한다 (validate에서 차단 필요)', () => {
    // level=-1 → 15 * -1 * 0 = -0 (JavaScript 부동소수점 특성)
    // level=-2 → 15 * -2 * -1 = 30 (양수!) — 잠재적 버그: validate가 막아야 함
    // -0 === 0 은 true이므로 수치 비교로 검증
    expect(expForLevel(-1) === 0 || expForLevel(-1) === -0).toBe(true) // -0은 수학적으로 0
    expect(expForLevel(-2)).toBe(30)  // 음수 레벨이 유효한 exp 임계값 생성 — 경보
  })
})

// ─────────────────────────────────────────────
// DECAY_RATES 합리성 검증
// ─────────────────────────────────────────────
describe('DECAY_RATES 합리성 검증', () => {
  const TICKS_PER_MINUTE = 60_000 / TICK_INTERVAL   // 6 ticks/min
  const TICKS_PER_HOUR = TICKS_PER_MINUTE * 60      // 360 ticks/hr

  it('hunger는 약 33분에 100→0이 되어야 한다 (±5분 허용)', () => {
    // TICK당 0.5 감소 → 100/0.5 = 200 ticks → 200 * 10s = 2000s ≈ 33.3분
    const ticksToZero = 100 / DECAY_RATES.hunger
    const minutesToZero = (ticksToZero * TICK_INTERVAL) / 60_000
    expect(minutesToZero).toBeGreaterThan(28)
    expect(minutesToZero).toBeLessThan(38)
  })

  it('happiness는 약 83분에 100→0이 되어야 한다 (±10분 허용)', () => {
    // 0.2 per tick → 500 ticks → 83.3분
    const ticksToZero = 100 / DECAY_RATES.happiness
    const minutesToZero = (ticksToZero * TICK_INTERVAL) / 60_000
    expect(minutesToZero).toBeGreaterThan(73)
    expect(minutesToZero).toBeLessThan(93)
  })

  it('cleanliness는 약 55분에 100→0이 되어야 한다 (±7분 허용)', () => {
    // 0.3 per tick → ~333 ticks → 55.5분
    const ticksToZero = 100 / DECAY_RATES.cleanliness
    const minutesToZero = (ticksToZero * TICK_INTERVAL) / 60_000
    expect(minutesToZero).toBeGreaterThan(48)
    expect(minutesToZero).toBeLessThan(62)
  })

  it('모든 decay rate는 양수이다', () => {
    expect(DECAY_RATES.hunger).toBeGreaterThan(0)
    expect(DECAY_RATES.happiness).toBeGreaterThan(0)
    expect(DECAY_RATES.cleanliness).toBeGreaterThan(0)
  })

  it('decay rate가 단일 tick에 100을 초과하지 않는다 (순간 소멸 방지)', () => {
    expect(DECAY_RATES.hunger).toBeLessThan(100)
    expect(DECAY_RATES.happiness).toBeLessThan(100)
    expect(DECAY_RATES.cleanliness).toBeLessThan(100)
  })
})

// ─────────────────────────────────────────────
// MAX_OFFLINE_TICKS 합리성 검증
// ─────────────────────────────────────────────
describe('MAX_OFFLINE_TICKS 합리성 검증', () => {
  it('MAX_OFFLINE_TICKS는 정확히 24시간에 해당한다', () => {
    // 24시간 = 86400초 / 10초 = 8640 ticks
    const expected = (24 * 60 * 60 * 1000) / TICK_INTERVAL
    expect(MAX_OFFLINE_TICKS).toBe(expected)
  })

  it('TICK_INTERVAL은 10초(10000ms)이다', () => {
    expect(TICK_INTERVAL).toBe(10_000)
  })
})
