/**
 * petStore.ts — tick/feed/pet/clean/getMoodModifier/applyOfflineDecay 검증
 *
 * Zustand store를 직접 import하면 persist 미들웨어가 localStorage를 찾아 터진다.
 * 해결책: localStorage와 zustand/middleware를 모킹한 후 store를 import한다.
 *
 * 테스트 격리 전략:
 *   - 각 test 전에 store를 reset() → DEFAULT_PET_STATE로 복귀
 *   - jest.useFakeTimers()로 Date.now() 고정
 */

// zustand/middleware의 persist를 no-op으로 대체 (localStorage 의존성 제거)
jest.mock('zustand/middleware', () => ({
  persist: (storeCreator: (set: unknown, get: unknown) => unknown) => storeCreator,
}))

import { DECAY_RATES, TICK_INTERVAL, MAX_OFFLINE_TICKS, expForLevel } from '@renderer/types/pet'

// persist 모킹 후 store import
let usePetStore: typeof import('@renderer/store/petStore').usePetStore

beforeAll(async () => {
  const mod = await import('@renderer/store/petStore')
  usePetStore = mod.usePetStore
})

// 각 테스트 전 store 초기화 + 가짜 타이머 설정
const FIXED_TIME = 1_700_000_000_000

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(FIXED_TIME)
  usePetStore.getState().reset()
})

afterEach(() => {
  jest.useRealTimers()
})

// ─────────────────────────────────────────────
// 초기 상태 검증
// ─────────────────────────────────────────────
describe('petStore — 초기 상태', () => {
  it('DEFAULT_PET_STATE 값으로 초기화된다', () => {
    const s = usePetStore.getState()
    expect(s.hunger).toBe(80)
    expect(s.happiness).toBe(80)
    expect(s.cleanliness).toBe(80)
    expect(s.exp).toBe(0)
    expect(s.level).toBe(1)
  })
})

// ─────────────────────────────────────────────
// tick — 스탯 감소 및 EXP 계산
// ─────────────────────────────────────────────
describe('petStore tick — 스탯 감소', () => {
  it('1 tick 후 hunger가 DECAY_RATE만큼 감소한다', () => {
    usePetStore.getState().tick()
    expect(usePetStore.getState().hunger).toBeCloseTo(80 - DECAY_RATES.hunger)
  })

  it('1 tick 후 happiness가 DECAY_RATE만큼 감소한다', () => {
    usePetStore.getState().tick()
    expect(usePetStore.getState().happiness).toBeCloseTo(80 - DECAY_RATES.happiness)
  })

  it('1 tick 후 cleanliness가 DECAY_RATE만큼 감소한다', () => {
    usePetStore.getState().tick()
    expect(usePetStore.getState().cleanliness).toBeCloseTo(80 - DECAY_RATES.cleanliness)
  })

  it('스탯이 0 아래로 내려가지 않는다 (clamp 하한)', () => {
    // hunger를 0.3으로 설정 → tick 후 0 이하가 되어야 하지만 0이어야 함
    usePetStore.setState({ hunger: 0.3 })
    usePetStore.getState().tick()
    expect(usePetStore.getState().hunger).toBe(0)
  })

  it('스탯이 이미 0인 상태에서 tick해도 음수가 되지 않는다', () => {
    usePetStore.setState({ hunger: 0, happiness: 0, cleanliness: 0 })
    usePetStore.getState().tick()
    const s = usePetStore.getState()
    expect(s.hunger).toBe(0)
    expect(s.happiness).toBe(0)
    expect(s.cleanliness).toBe(0)
  })

  it('tick 후 lastTickTime이 현재 시각으로 업데이트된다', () => {
    jest.setSystemTime(FIXED_TIME + 10_000)
    usePetStore.getState().tick()
    expect(usePetStore.getState().lastTickTime).toBe(FIXED_TIME + 10_000)
  })
})

// ─────────────────────────────────────────────
// tick — EXP 및 레벨업
// ─────────────────────────────────────────────
describe('petStore tick — EXP 및 레벨업', () => {
  it('스탯 평균 >= 70이면 tick당 EXP 2.0 획득', () => {
    // 초기값 hunger=80, happiness=80, cleanliness=80 → avg = 79.5 → multiplier 2.0
    // tick 후 avg는 약 79.1 (여전히 >=70) → 2.0
    usePetStore.getState().tick()
    expect(usePetStore.getState().exp).toBeCloseTo(2.0)
  })

  it('스탯 평균 40~69이면 tick당 EXP 1.0 획득', () => {
    usePetStore.setState({ hunger: 50, happiness: 50, cleanliness: 50 })
    usePetStore.getState().tick()
    // 감소 후 avg ≈ 49.3 → 여전히 >=40 → 1.0
    expect(usePetStore.getState().exp).toBeCloseTo(1.0)
  })

  it('스탯 평균 20~39이면 tick당 EXP 0.3 획득', () => {
    usePetStore.setState({ hunger: 30, happiness: 30, cleanliness: 30 })
    usePetStore.getState().tick()
    // 감소 후 avg ≈ 29.3 → >=20 → 0.3
    expect(usePetStore.getState().exp).toBeCloseTo(0.3)
  })

  it('스탯 평균 < 20이면 tick당 EXP 0 획득', () => {
    usePetStore.setState({ hunger: 1, happiness: 1, cleanliness: 1 })
    usePetStore.getState().tick()
    // 감소 후 avg ≈ 0.33 → <20 → 0
    expect(usePetStore.getState().exp).toBe(0)
  })

  it('expForLevel 임계값 정확히 도달 시 레벨업된다', () => {
    // Lv1→Lv2: expForLevel(1) = 30
    // exp=29 → tick에서 EXP 2.0 획득 → 31 ≥ 30 → level=2
    usePetStore.setState({ exp: 29, level: 1, hunger: 80, happiness: 80, cleanliness: 80 })
    usePetStore.getState().tick()
    expect(usePetStore.getState().level).toBe(2)
  })

  it('레벨업 직전(exp=29)에서 tick 후 level이 2가 된다', () => {
    usePetStore.setState({ exp: 29, level: 1, hunger: 80, happiness: 80, cleanliness: 80 })
    usePetStore.getState().tick()
    const { exp, level } = usePetStore.getState()
    expect(exp).toBeGreaterThanOrEqual(expForLevel(1)) // 30
    expect(level).toBe(2)
  })
})

// ─────────────────────────────────────────────
// feed
// ─────────────────────────────────────────────
describe('petStore feed — 스탯 및 EXP 증가', () => {
  it('hunger가 10 증가한다', () => {
    usePetStore.setState({ hunger: 50 })
    usePetStore.getState().feed()
    expect(usePetStore.getState().hunger).toBe(60)
  })

  it('hunger가 100을 초과하지 않는다 (clamp 상한)', () => {
    usePetStore.setState({ hunger: 95 })
    usePetStore.getState().feed()
    expect(usePetStore.getState().hunger).toBe(100)
  })

  it('hunger가 0일 때 feed하면 10이 된다', () => {
    usePetStore.setState({ hunger: 0 })
    usePetStore.getState().feed()
    expect(usePetStore.getState().hunger).toBe(10)
  })

  it('feed 시 EXP가 3 증가한다', () => {
    usePetStore.setState({ exp: 0 })
    usePetStore.getState().feed()
    expect(usePetStore.getState().exp).toBe(3)
  })

  it('feed로 EXP가 레벨업 임계값을 넘으면 레벨이 올라간다', () => {
    // expForLevel(1) = 30 → exp=28, feed(+3) → exp=31 ≥ 30
    usePetStore.setState({ exp: 28, level: 1 })
    usePetStore.getState().feed()
    expect(usePetStore.getState().level).toBe(2)
  })

  it('feed는 happiness나 cleanliness를 변경하지 않는다', () => {
    usePetStore.setState({ happiness: 60, cleanliness: 40 })
    usePetStore.getState().feed()
    expect(usePetStore.getState().happiness).toBe(60)
    expect(usePetStore.getState().cleanliness).toBe(40)
  })
})

// ─────────────────────────────────────────────
// pet (쓰다듬기)
// ─────────────────────────────────────────────
describe('petStore pet — 스탯 및 EXP 증가', () => {
  it('happiness가 1 증가한다 (소소한 쓰다듬기)', () => {
    usePetStore.setState({ happiness: 50 })
    usePetStore.getState().pet()
    expect(usePetStore.getState().happiness).toBe(51)
  })

  it('happiness가 100을 초과하지 않는다', () => {
    usePetStore.setState({ happiness: 100 })
    usePetStore.getState().pet()
    expect(usePetStore.getState().happiness).toBe(100)
  })

  it('pet 시 EXP가 2 증가한다', () => {
    usePetStore.setState({ exp: 0 })
    usePetStore.getState().pet()
    expect(usePetStore.getState().exp).toBe(2)
  })

  it('pet는 hunger나 cleanliness를 변경하지 않는다', () => {
    usePetStore.setState({ hunger: 60, cleanliness: 40 })
    usePetStore.getState().pet()
    expect(usePetStore.getState().hunger).toBe(60)
    expect(usePetStore.getState().cleanliness).toBe(40)
  })
})

// ─────────────────────────────────────────────
// clean
// ─────────────────────────────────────────────
describe('petStore clean — 스탯 및 EXP 증가', () => {
  it('cleanliness가 10 증가한다', () => {
    usePetStore.setState({ cleanliness: 50 })
    usePetStore.getState().clean()
    expect(usePetStore.getState().cleanliness).toBe(60)
  })

  it('cleanliness가 100을 초과하지 않는다', () => {
    usePetStore.setState({ cleanliness: 95 })
    usePetStore.getState().clean()
    expect(usePetStore.getState().cleanliness).toBe(100)
  })

  it('clean 시 EXP가 2 증가한다', () => {
    usePetStore.setState({ exp: 0 })
    usePetStore.getState().clean()
    expect(usePetStore.getState().exp).toBe(2)
  })

  it('clean은 hunger나 happiness를 변경하지 않는다', () => {
    usePetStore.setState({ hunger: 60, happiness: 40 })
    usePetStore.getState().clean()
    expect(usePetStore.getState().hunger).toBe(60)
    expect(usePetStore.getState().happiness).toBe(40)
  })
})

// ─────────────────────────────────────────────
// getMoodModifier — 조건부 로직
// ─────────────────────────────────────────────
describe('petStore getMoodModifier — 조건부 로직', () => {
  it('hunger > 20이고 happiness >= 80이면 jumpChance=0.25', () => {
    usePetStore.setState({ hunger: 80, happiness: 80 })
    const mod = usePetStore.getState().getMoodModifier()
    expect(mod.speedMultiplier).toBe(1.0)
    expect(mod.jumpChance).toBe(0.25)
    expect(mod.idleMultiplier).toBe(1.0)
  })

  it('hunger > 20이고 happiness < 80이면 jumpChance=0.15', () => {
    usePetStore.setState({ hunger: 50, happiness: 79 })
    const mod = usePetStore.getState().getMoodModifier()
    expect(mod.jumpChance).toBe(0.15)
    expect(mod.speedMultiplier).toBe(1.0)
  })

  it('hunger <= 20이면 speedMultiplier=0.5, jumpChance=0', () => {
    usePetStore.setState({ hunger: 20, happiness: 90 })
    const mod = usePetStore.getState().getMoodModifier()
    expect(mod.speedMultiplier).toBe(0.5)
    expect(mod.jumpChance).toBe(0)
  })

  it('hunger가 정확히 20이면 굶주림 패널티 적용 (경계값)', () => {
    // hunger <= 20 조건 → hunger=20은 굶주림으로 처리
    usePetStore.setState({ hunger: 20 })
    const mod = usePetStore.getState().getMoodModifier()
    expect(mod.speedMultiplier).toBe(0.5)
    expect(mod.jumpChance).toBe(0)
  })

  it('hunger가 21이면 굶주림 패널티 미적용 (경계값+1)', () => {
    usePetStore.setState({ hunger: 21, happiness: 50 })
    const mod = usePetStore.getState().getMoodModifier()
    expect(mod.speedMultiplier).toBe(1.0)
    expect(mod.jumpChance).toBe(0.15)
  })

  it('happiness <= 20이면 idleMultiplier=2.0', () => {
    usePetStore.setState({ hunger: 50, happiness: 20 })
    const mod = usePetStore.getState().getMoodModifier()
    expect(mod.idleMultiplier).toBe(2.0)
  })

  it('happiness가 정확히 20이면 슬픔 패널티 적용 (경계값)', () => {
    usePetStore.setState({ hunger: 50, happiness: 20 })
    expect(usePetStore.getState().getMoodModifier().idleMultiplier).toBe(2.0)
  })

  it('happiness가 21이면 슬픔 패널티 미적용 (경계값+1)', () => {
    usePetStore.setState({ hunger: 50, happiness: 21 })
    expect(usePetStore.getState().getMoodModifier().idleMultiplier).toBe(1.0)
  })

  it('hunger=0, happiness=0 극단 케이스: 모든 패널티 동시 적용', () => {
    usePetStore.setState({ hunger: 0, happiness: 0 })
    const mod = usePetStore.getState().getMoodModifier()
    expect(mod.speedMultiplier).toBe(0.5)
    expect(mod.jumpChance).toBe(0)
    expect(mod.idleMultiplier).toBe(2.0)
  })
})

// ─────────────────────────────────────────────
// isStarving / isSad / isDirty 파생 상태
// ─────────────────────────────────────────────
describe('petStore 파생 상태 — isStarving / isSad / isDirty', () => {
  it('hunger=20이면 isStarving=true', () => {
    usePetStore.setState({ hunger: 20 })
    expect(usePetStore.getState().isStarving()).toBe(true)
  })

  it('hunger=21이면 isStarving=false', () => {
    usePetStore.setState({ hunger: 21 })
    expect(usePetStore.getState().isStarving()).toBe(false)
  })

  it('happiness=20이면 isSad=true', () => {
    usePetStore.setState({ happiness: 20 })
    expect(usePetStore.getState().isSad()).toBe(true)
  })

  it('cleanliness=30이면 isDirty=true', () => {
    usePetStore.setState({ cleanliness: 30 })
    expect(usePetStore.getState().isDirty()).toBe(true)
  })

  it('cleanliness=31이면 isDirty=false', () => {
    usePetStore.setState({ cleanliness: 31 })
    expect(usePetStore.getState().isDirty()).toBe(false)
  })
})

// ─────────────────────────────────────────────
// getExpProgress
// ─────────────────────────────────────────────
describe('petStore getExpProgress', () => {
  it('Lv1 시작 시 current=0, next=30, percent=0', () => {
    usePetStore.setState({ exp: 0, level: 1 })
    const { current, next, percent } = usePetStore.getState().getExpProgress()
    // expForLevel(0)=0, expForLevel(1)=30
    expect(current).toBe(0)
    expect(next).toBe(30)
    expect(percent).toBe(0)
  })

  it('Lv1에서 exp=15이면 percent=50', () => {
    usePetStore.setState({ exp: 15, level: 1 })
    const { percent } = usePetStore.getState().getExpProgress()
    expect(percent).toBeCloseTo(50)
  })

  it('Lv2로 전환 직후 exp=30이면 current=0', () => {
    usePetStore.setState({ exp: 30, level: 2 })
    const { current } = usePetStore.getState().getExpProgress()
    // expForLevel(1)=30, current = 30-30 = 0
    expect(current).toBe(0)
  })

  it('percent는 100을 초과하지 않는다', () => {
    // exp가 다음 레벨 임계값을 훨씬 초과해도 percent <= 100
    usePetStore.setState({ exp: 99999, level: 1 })
    const { percent } = usePetStore.getState().getExpProgress()
    expect(percent).toBeLessThanOrEqual(100)
  })
})

// ─────────────────────────────────────────────
// applyOfflineDecay — 오프라인 역산
// ─────────────────────────────────────────────
describe('petStore applyOfflineDecay — 오프라인 역산', () => {
  it('elapsed=0이면 스탯이 변하지 않는다', () => {
    // reset() 후 lastTickTime=FIXED_TIME, 시간도 FIXED_TIME → elapsed=0
    const before = usePetStore.getState().hunger
    usePetStore.getState().applyOfflineDecay()
    expect(usePetStore.getState().hunger).toBe(before)
  })

  it('1분 경과(6 ticks) 후 hunger가 정확히 6 * 0.5 = 3 감소한다', () => {
    jest.setSystemTime(FIXED_TIME + 60_000) // +60초
    usePetStore.getState().applyOfflineDecay()
    expect(usePetStore.getState().hunger).toBeCloseTo(80 - 6 * DECAY_RATES.hunger)
  })

  it('1시간 경과(360 ticks) 후 hunger가 올바르게 감소한다', () => {
    jest.setSystemTime(FIXED_TIME + 3_600_000) // +1시간
    usePetStore.getState().applyOfflineDecay()
    const expected = Math.max(0, 80 - 360 * DECAY_RATES.hunger)
    expect(usePetStore.getState().hunger).toBeCloseTo(expected)
  })

  it('5분 경과(30 ticks) 후 happiness, cleanliness도 순수 감쇄율대로 감소한다', () => {
    // 5분 후: hunger=80-15=65, cleanliness=80-9=71 둘 다 50 초과 → happiness penalty 미적용
    jest.setSystemTime(FIXED_TIME + 300_000) // +5분
    usePetStore.getState().applyOfflineDecay()
    const s = usePetStore.getState()
    expect(s.happiness).toBeCloseTo(Math.max(0, 80 - 30 * DECAY_RATES.happiness))
    expect(s.cleanliness).toBeCloseTo(Math.max(0, 80 - 30 * DECAY_RATES.cleanliness))
  })

  it('스탯이 0 아래로 내려가지 않는다 (24시간 오프라인)', () => {
    jest.setSystemTime(FIXED_TIME + 24 * 3_600_000)
    usePetStore.getState().applyOfflineDecay()
    const s = usePetStore.getState()
    expect(s.hunger).toBeGreaterThanOrEqual(0)
    expect(s.happiness).toBeGreaterThanOrEqual(0)
    expect(s.cleanliness).toBeGreaterThanOrEqual(0)
  })

  it('MAX_OFFLINE_TICKS 초과 시 8640 ticks로 상한이 걸린다 (30일 오프라인)', () => {
    const thirtyDays = 30 * 24 * 3_600_000
    jest.setSystemTime(FIXED_TIME + thirtyDays)
    usePetStore.getState().applyOfflineDecay()
    const s = usePetStore.getState()
    // 8640 ticks * 0.5 = 4320 감소 → 100에서 시작해도 0에 clamp
    expect(s.hunger).toBeGreaterThanOrEqual(0)
    expect(s.hunger).not.toBeNaN()
  })

  it('시계가 과거로 돌아간 경우 (elapsed < 0) 스탯이 변하지 않는다', () => {
    // lastTickTime이 미래에 있는 경우 시뮬레이션
    usePetStore.setState({ lastTickTime: FIXED_TIME + 60_000 })
    jest.setSystemTime(FIXED_TIME) // 현재가 lastTickTime보다 과거
    const before = usePetStore.getState().hunger
    usePetStore.getState().applyOfflineDecay()
    expect(usePetStore.getState().hunger).toBe(before)
  })

  it('오프라인 후 lastTickTime이 현재 시각으로 업데이트된다', () => {
    const newTime = FIXED_TIME + 60_000
    jest.setSystemTime(newTime)
    usePetStore.getState().applyOfflineDecay()
    expect(usePetStore.getState().lastTickTime).toBe(newTime)
  })

  it('오프라인 EXP는 스탯 평균이 높을 때 더 많이 쌓인다', () => {
    // Case A: 높은 스탯 (avg >= 70) → multiplier 2.0
    usePetStore.setState({ hunger: 80, happiness: 80, cleanliness: 80, exp: 0 })
    jest.setSystemTime(FIXED_TIME + TICK_INTERVAL * 10) // 10 ticks
    usePetStore.getState().applyOfflineDecay()
    const highStatExp = usePetStore.getState().exp

    // Case B: 낮은 스탯 (avg 20~39) → multiplier 0.3
    usePetStore.getState().reset()
    usePetStore.setState({ hunger: 30, happiness: 30, cleanliness: 30, exp: 0, lastTickTime: FIXED_TIME })
    jest.setSystemTime(FIXED_TIME + TICK_INTERVAL * 10)
    usePetStore.getState().applyOfflineDecay()
    const lowStatExp = usePetStore.getState().exp

    expect(highStatExp).toBeGreaterThan(lowStatExp)
  })

  it('극단적으로 큰 elapsed 값도 NaN/Infinity를 생성하지 않는다', () => {
    // Number.MAX_SAFE_INTEGER ms 경과 시뮬레이션
    jest.setSystemTime(FIXED_TIME + Number.MAX_SAFE_INTEGER)
    usePetStore.getState().applyOfflineDecay()
    const s = usePetStore.getState()
    expect(Number.isFinite(s.hunger)).toBe(true)
    expect(Number.isFinite(s.happiness)).toBe(true)
    expect(Number.isFinite(s.exp)).toBe(true)
  })
})

// ─────────────────────────────────────────────
// calcLevel — 내부 함수 간접 검증
// ─────────────────────────────────────────────
describe('petStore calcLevel — feed/pet/clean을 통한 간접 검증', () => {
  it('exp=0에서 level=1이다', () => {
    expect(usePetStore.getState().level).toBe(1)
  })

  it('expForLevel(1)=30에 정확히 도달하면 level=2가 된다', () => {
    // feed(+3)을 10번 → exp=30
    usePetStore.setState({ exp: 0, level: 1 })
    for (let i = 0; i < 10; i++) usePetStore.getState().feed()
    expect(usePetStore.getState().exp).toBe(30)
    expect(usePetStore.getState().level).toBe(2)
  })

  it('연속 레벨업: Lv1→Lv2→Lv3 경로 검증', () => {
    // Lv2→Lv3: expForLevel(2)=90 필요 → exp=89에서 feed(+3) → 92 ≥ 90
    usePetStore.setState({ exp: 89, level: 2 })
    usePetStore.getState().feed()
    expect(usePetStore.getState().level).toBe(3)
  })

  it('레벨업 임계값 직전(exp=임계-1)에서는 레벨업이 일어나지 않는다', () => {
    // expForLevel(1)=30 → exp=27, feed(+3) → 30 → 정확히 임계값 = 레벨업
    // 임계값보다 1 적게: exp=26, feed(+3) → 29 < 30 → 레벨업 없음
    usePetStore.setState({ exp: 26, level: 1 })
    usePetStore.getState().feed()
    expect(usePetStore.getState().level).toBe(1)
    expect(usePetStore.getState().exp).toBe(29)
  })
})
