/**
 * persistence.ts — validate 함수 및 loadPetState/savePetState 검증
 *
 * electron-store는 Electron 런타임 없이 import하면 터지므로 전체 모킹.
 * validate는 module-internal이므로 savePetState를 통해 간접 검증한다
 * (save 시 validate를 통과한 값만 store.set에 전달).
 *
 * 모킹 전략:
 *   - mockGet/mockSet을 클로저로 먼저 선언
 *   - jest.mock 팩토리에서 해당 클로저를 참조
 *   - 각 테스트에서 mockGet.mockReturnValue()로 store.get 반환값 제어
 */

// mock 함수를 모듈 최상위에 선언 (jest.mock 호이스팅 때문에 factory 내에서 직접 사용)
const mockGet = jest.fn()
const mockSet = jest.fn()

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
  }))
})

// mock 선언 후 import
import { loadPetState, savePetState } from '../../main/persistence'

// ─────────────────────────────────────────────
// loadPetState — validate 통해 정상값 반환
// ─────────────────────────────────────────────
describe('loadPetState — 정상 입력', () => {
  it('유효한 상태를 그대로 반환한다', () => {
    const valid = { hunger: 75, happiness: 60, cleanliness: 50, exp: 30, level: 2, lastTickTime: 1_700_000_000_000 }
    mockGet.mockReturnValue(valid)

    const result = loadPetState()

    expect(result.hunger).toBe(75)
    expect(result.happiness).toBe(60)
    expect(result.cleanliness).toBe(50)
    expect(result.exp).toBe(30)
    expect(result.level).toBe(2)
    expect(result.lastTickTime).toBe(1_700_000_000_000)
  })

  it('경계값 0을 정상적으로 처리한다', () => {
    mockGet.mockReturnValue({
      hunger: 0, happiness: 0, cleanliness: 0, exp: 0, level: 1, lastTickTime: 1_000_000,
    })
    const result = loadPetState()
    expect(result.hunger).toBe(0)
    expect(result.happiness).toBe(0)
    expect(result.cleanliness).toBe(0)
  })

  it('경계값 100을 정상적으로 처리한다', () => {
    mockGet.mockReturnValue({
      hunger: 100, happiness: 100, cleanliness: 100, exp: 0, level: 1, lastTickTime: 1_000_000,
    })
    const result = loadPetState()
    expect(result.hunger).toBe(100)
    expect(result.happiness).toBe(100)
    expect(result.cleanliness).toBe(100)
  })
})

// ─────────────────────────────────────────────
// loadPetState — 범위 초과값 clamp
// ─────────────────────────────────────────────
describe('loadPetState — 범위 초과값 clamp', () => {
  it('hunger > 100은 100으로 clamp된다', () => {
    mockGet.mockReturnValue({ hunger: 999, happiness: 50, cleanliness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().hunger).toBe(100)
  })

  it('hunger < 0은 0으로 clamp된다', () => {
    mockGet.mockReturnValue({ hunger: -999, happiness: 50, cleanliness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().hunger).toBe(0)
  })

  it('happiness > 100은 100으로 clamp된다', () => {
    mockGet.mockReturnValue({ hunger: 50, happiness: 99999, cleanliness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().happiness).toBe(100)
  })

  it('cleanliness < 0은 0으로 clamp된다', () => {
    mockGet.mockReturnValue({ hunger: 50, happiness: 50, cleanliness: -1, exp: 0, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().cleanliness).toBe(0)
  })

  it('exp < 0은 0으로 clamp된다', () => {
    mockGet.mockReturnValue({ hunger: 50, happiness: 50, cleanliness: 50, exp: -100, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().exp).toBe(0)
  })

  it('level < 1은 기본값 1로 복구된다', () => {
    mockGet.mockReturnValue({ hunger: 50, happiness: 50, cleanliness: 50, exp: 0, level: 0, lastTickTime: 1_000_000 })
    expect(loadPetState().level).toBe(1)
  })

  it('level이 소수이면 floor된다', () => {
    mockGet.mockReturnValue({ hunger: 50, happiness: 50, cleanliness: 50, exp: 0, level: 3.9, lastTickTime: 1_000_000 })
    expect(loadPetState().level).toBe(3)
  })
})

// ─────────────────────────────────────────────
// loadPetState — 타입 오류 및 누락 필드 → 기본값
// ─────────────────────────────────────────────
describe('loadPetState — 잘못된 타입/누락 필드 → 기본값 복구', () => {
  const DEFAULT_HUNGER = 80
  const DEFAULT_HAPPINESS = 80
  const DEFAULT_CLEANLINESS = 80
  const DEFAULT_LEVEL = 1

  it('hunger가 string이면 기본값 80 사용', () => {
    mockGet.mockReturnValue({ hunger: '80', happiness: 50, cleanliness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().hunger).toBe(DEFAULT_HUNGER)
  })

  it('happiness가 null이면 기본값 80 사용', () => {
    mockGet.mockReturnValue({ hunger: 50, happiness: null, cleanliness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().happiness).toBe(DEFAULT_HAPPINESS)
  })

  it('cleanliness가 undefined(누락)이면 기본값 80 사용', () => {
    mockGet.mockReturnValue({ hunger: 50, happiness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().cleanliness).toBe(DEFAULT_CLEANLINESS)
  })

  it('level이 string이면 기본값 1 사용', () => {
    mockGet.mockReturnValue({ hunger: 50, happiness: 50, cleanliness: 50, exp: 0, level: '3', lastTickTime: 1_000_000 })
    expect(loadPetState().level).toBe(DEFAULT_LEVEL)
  })

  it('모든 필드가 누락된 빈 객체면 전체 기본값 반환', () => {
    mockGet.mockReturnValue({})
    const result = loadPetState()
    expect(result.hunger).toBe(DEFAULT_HUNGER)
    expect(result.happiness).toBe(DEFAULT_HAPPINESS)
    expect(result.cleanliness).toBe(DEFAULT_CLEANLINESS)
    expect(result.level).toBe(DEFAULT_LEVEL)
  })
})

// ─────────────────────────────────────────────
// loadPetState — 완전 손상 입력 → 기본값
// ─────────────────────────────────────────────
describe('loadPetState — 완전 손상 입력 → 기본값 복구', () => {
  it('null을 받으면 기본값을 반환한다', () => {
    mockGet.mockReturnValue(null)
    const result = loadPetState()
    expect(result.hunger).toBe(80)
    expect(result.level).toBe(1)
  })

  it('undefined를 받으면 기본값을 반환한다', () => {
    mockGet.mockReturnValue(undefined)
    const result = loadPetState()
    expect(result.hunger).toBe(80)
  })

  it('숫자 primitive를 받으면 기본값을 반환한다', () => {
    mockGet.mockReturnValue(42)
    const result = loadPetState()
    expect(result.hunger).toBe(80)
  })

  it('배열을 받으면 기본값을 반환한다', () => {
    // 배열도 object이지만 named 필드가 없으므로 전부 기본값으로 복구
    mockGet.mockReturnValue([1, 2, 3])
    const result = loadPetState()
    expect(result.hunger).toBe(80)
  })

  it('store.get이 예외를 throw하면 기본값을 반환한다', () => {
    mockGet.mockImplementation(() => { throw new Error('DISK_READ_ERROR') })
    const result = loadPetState()
    expect(result.hunger).toBe(80)
    expect(result.level).toBe(1)
  })
})

// ─────────────────────────────────────────────
// loadPetState — NaN / Infinity 방어
// ─────────────────────────────────────────────
describe('loadPetState — NaN / Infinity 방어', () => {
  it('hunger가 NaN이면 기본값 80 사용', () => {
    mockGet.mockReturnValue({ hunger: NaN, happiness: 50, cleanliness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().hunger).toBe(80)
  })

  it('hunger가 Infinity이면 기본값 80 사용 (Number.isFinite 필터)', () => {
    // Infinity는 Number.isFinite(Infinity) === false → 기본값 80
    mockGet.mockReturnValue({ hunger: Infinity, happiness: 50, cleanliness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().hunger).toBe(80)
  })

  it('hunger가 -Infinity이면 기본값 80 사용', () => {
    mockGet.mockReturnValue({ hunger: -Infinity, happiness: 50, cleanliness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().hunger).toBe(80)
  })

  it('exp가 NaN이면 기본값 0 사용', () => {
    mockGet.mockReturnValue({ hunger: 50, happiness: 50, cleanliness: 50, exp: NaN, level: 1, lastTickTime: 1_000_000 })
    expect(loadPetState().exp).toBe(0)
  })
})

// ─────────────────────────────────────────────
// loadPetState — lastTickTime 처리
// ─────────────────────────────────────────────
describe('loadPetState — lastTickTime 처리', () => {
  it('lastTickTime이 0이면 현재 시각으로 재설정된다', () => {
    const before = Date.now()
    mockGet.mockReturnValue({ hunger: 50, happiness: 50, cleanliness: 50, exp: 0, level: 1, lastTickTime: 0 })
    const result = loadPetState()
    const after = Date.now()
    // lastTickTime: 0 → 조건 `obj.lastTickTime > 0` 실패 → Date.now()로 재설정
    expect(result.lastTickTime).toBeGreaterThanOrEqual(before)
    expect(result.lastTickTime).toBeLessThanOrEqual(after)
  })

  it('lastTickTime이 음수이면 현재 시각으로 재설정된다', () => {
    const before = Date.now()
    mockGet.mockReturnValue({ hunger: 50, happiness: 50, cleanliness: 50, exp: 0, level: 1, lastTickTime: -1000 })
    const result = loadPetState()
    const after = Date.now()
    expect(result.lastTickTime).toBeGreaterThanOrEqual(before)
    expect(result.lastTickTime).toBeLessThanOrEqual(after)
  })

  it('유효한 lastTickTime은 보존된다', () => {
    const ts = 1_700_000_000_000
    mockGet.mockReturnValue({ hunger: 50, happiness: 50, cleanliness: 50, exp: 0, level: 1, lastTickTime: ts })
    expect(loadPetState().lastTickTime).toBe(ts)
  })
})

// ─────────────────────────────────────────────
// savePetState — validate를 통한 클렌징 저장
// ─────────────────────────────────────────────
describe('savePetState — validate 통과 후 저장', () => {
  it('정상 상태는 그대로 store.set 호출된다', () => {
    const state = { hunger: 75, happiness: 60, cleanliness: 50, exp: 30, level: 2, lastTickTime: 1_700_000_000_000 }
    savePetState(state)
    expect(mockSet).toHaveBeenCalledWith('petState', expect.objectContaining({ hunger: 75, level: 2 }))
  })

  it('범위 초과값은 clamp되어 저장된다', () => {
    savePetState({ hunger: 999, happiness: -50, cleanliness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })
    const saved = mockSet.mock.calls[0][1] as Record<string, number>
    expect(saved.hunger).toBe(100)
    expect(saved.happiness).toBe(0)
  })

  it('store.set이 예외를 throw해도 savePetState는 throw하지 않는다', () => {
    mockSet.mockImplementation(() => { throw new Error('DISK_WRITE_ERROR') })
    expect(() => savePetState({ hunger: 50, happiness: 50, cleanliness: 50, exp: 0, level: 1, lastTickTime: 1_000_000 })).not.toThrow()
  })
})
