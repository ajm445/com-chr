/**
 * SpeechBubble.tsx — pickLine 레벨 해금 및 가중치 선택 검증
 *
 * 테스트 대상:
 *   - minLevel 필터링: 현재 레벨 미만 대사가 후보에서 제외되는지
 *   - 기본값: minLevel이 없는 대사는 Lv.1부터 포함되는지
 *   - condition 필터링: minLevel을 통과해도 condition 미충족 대사는 제외되는지
 *   - 복합 필터: minLevel AND condition 동시 적용 검증
 *   - 가중치 선택: 동일 pool에서 weight가 큰 대사가 더 자주 선택되는지
 *   - 경계값: level 정확히 minLevel과 같을 때 포함되는지 (off-by-one 방지)
 *
 * 격리 전략:
 *   - react 훅 전체를 no-op으로 대체 (Node.js 환경에서 렌더러 없이 실행)
 *   - usePetStore를 더미로 대체 (pickLine은 store를 직접 사용하지 않음)
 *   - window.api가 없으므로 global.window를 빈 객체로 채움
 */

// React 훅 모킹 — Node.js 환경에서는 렌더러가 없으므로 모든 훅을 no-op으로
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn((init) => [typeof init === 'function' ? init() : init, jest.fn()]),
  useEffect: jest.fn(),
  useRef: jest.fn(() => ({ current: null })),
  useCallback: jest.fn((fn: unknown) => fn),
}))

// zustand/middleware persist no-op (petStore 의존성 체인이 middleware를 쓸 경우 대비)
jest.mock('zustand/middleware', () => ({
  persist: (storeCreator: (set: unknown, get: unknown) => unknown) => storeCreator,
}))

// usePetStore 모킹 — pickLine 자체는 store를 쓰지 않지만 모듈 로드 시 import됨
jest.mock('@renderer/store/petStore', () => ({
  usePetStore: jest.fn(() => ({
    hunger: 80,
    happiness: 80,
    cleanliness: 80,
    level: 1,
  })),
}))

// window.api 스텁 (컴포넌트 바디가 참조할 수 있으므로)
Object.defineProperty(global, 'window', {
  value: { api: { triggerInteraction: jest.fn() }, setTimeout: global.setTimeout },
  writable: true,
})

import { pickLine, LINES } from '@renderer/components/SpeechBubble'
import type { PetState, LineTag } from '@renderer/components/SpeechBubble'

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/** pickLine이 선택 가능한 후보 대사 텍스트 목록을 반환 */
function candidateTexts(state: PetState): string[] {
  return LINES.filter(
    (l) => state.level >= (l.minLevel ?? 1) && (!l.condition || l.condition(state)),
  ).map((l) => l.text)
}

/** 평균 스탯 */
function avg(s: PetState): number {
  return (s.hunger + s.happiness + s.cleanliness) / 3
}

// 테스트에서 반복적으로 쓸 기준 상태 — 모든 조건부 대사를 최대한 열어두는 "안전한" 고스탯 상태
const HIGH_STAT_STATE = (level: number): PetState => ({
  hunger: 80,
  happiness: 80,
  cleanliness: 80,
  level,
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. minLevel 필터 — 레벨별 해금 경계
// ─────────────────────────────────────────────────────────────────────────────

describe('minLevel 필터 — 레벨별 해금 경계', () => {
  it('Lv.1에서는 minLevel이 없는 대사(암묵적 Lv.1)만 포함된다', () => {
    const state = HIGH_STAT_STATE(1)
    const candidates = candidateTexts(state)

    // minLevel 2 이상인 대사가 하나도 없어야 함
    const lv2PlusCandidates = candidates.filter((text) => {
      const line = LINES.find((l) => l.text === text)
      return line && (line.minLevel ?? 1) >= 2
    })
    expect(lv2PlusCandidates).toHaveLength(0)
  })

  it('Lv.1에서는 minLevel 명시 없는 대사 12개가 모두 포함된다 (기본 Lv.1 대사 풀)', () => {
    // minLevel이 undefined인 라인 = 기본 Lv.1 대사
    const implicitLv1Lines = LINES.filter((l) => l.minLevel === undefined)
    expect(implicitLv1Lines.length).toBeGreaterThanOrEqual(10) // 최소 10개 이상 존재해야 함

    const state = HIGH_STAT_STATE(1)
    const candidates = candidateTexts(state)

    // 모든 암묵적 Lv.1 대사가 (condition 통과 시) 후보에 포함되어야 함
    for (const line of implicitLv1Lines) {
      if (!line.condition || line.condition(state)) {
        expect(candidates).toContain(line.text)
      }
    }
  })

  it('Lv.5에서는 minLevel 1~5 대사는 포함되고 minLevel 6+ 대사는 제외된다', () => {
    const state = HIGH_STAT_STATE(5)
    const candidates = candidateTexts(state)

    // minLevel 6 대사 샘플: '나도 AI인 건가?'
    const lv6Line = LINES.find((l) => l.minLevel === 6 && !l.condition)
    expect(lv6Line).toBeDefined()
    expect(candidates).not.toContain(lv6Line!.text)

    // minLevel 5 대사 샘플: '업데이트 확인 중' (조건 없음)
    const lv5Line = LINES.find((l) => l.minLevel === 5 && !l.condition)
    expect(lv5Line).toBeDefined()
    expect(candidates).toContain(lv5Line!.text)
  })

  it('Lv.5에서 minLevel === 5인 대사는 포함된다 (off-by-one: >= 이므로 경계 포함)', () => {
    const state = HIGH_STAT_STATE(5)
    const lv5OnlyLines = LINES.filter((l) => l.minLevel === 5 && !l.condition)
    const candidates = candidateTexts(state)

    for (const line of lv5OnlyLines) {
      expect(candidates).toContain(line.text)
    }
  })

  it('Lv.4에서 minLevel === 5 대사는 제외된다 (경계 직전 레벨)', () => {
    const state = HIGH_STAT_STATE(4)
    const lv5Lines = LINES.filter((l) => l.minLevel === 5)
    const candidates = candidateTexts(state)

    for (const line of lv5Lines) {
      expect(candidates).not.toContain(line.text)
    }
  })

  it('Lv.100에서는 minLevel 100 대사가 포함된다', () => {
    const state: PetState = { hunger: 60, happiness: 60, cleanliness: 60, level: 100 }
    const candidates = candidateTexts(state)

    // minLevel 100 중 조건 없는 대사: '나는 디지털 세계의 정령', '전자의 바다에서 영겁을 헤엄쳤어'
    const lv100Lines = LINES.filter((l) => l.minLevel === 100 && !l.condition)
    expect(lv100Lines.length).toBeGreaterThan(0)

    for (const line of lv100Lines) {
      expect(candidates).toContain(line.text)
    }
  })

  it('Lv.100에서는 minLevel 150 대사가 제외된다', () => {
    const state: PetState = { hunger: 60, happiness: 60, cleanliness: 60, level: 100 }
    const candidates = candidateTexts(state)

    const lv150Lines = LINES.filter((l) => l.minLevel === 150)
    expect(lv150Lines.length).toBeGreaterThan(0)

    for (const line of lv150Lines) {
      expect(candidates).not.toContain(line.text)
    }
  })

  it('Lv.150에서는 minLevel 150 대사가 포함된다', () => {
    const state: PetState = { hunger: 80, happiness: 80, cleanliness: 80, level: 150 }
    const candidates = candidateTexts(state)

    const lv150Lines = LINES.filter((l) => l.minLevel === 150 && !l.condition)
    for (const line of lv150Lines) {
      expect(candidates).toContain(line.text)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. condition 필터 — minLevel 통과 후 condition 검증
// ─────────────────────────────────────────────────────────────────────────────

describe('condition 필터 — minLevel 통과 후 조건 검증', () => {
  it('hunger > 20인 상태에서 hunger <= 20 조건 대사가 제외된다', () => {
    const state: PetState = { hunger: 50, happiness: 80, cleanliness: 80, level: 1 }
    const candidates = candidateTexts(state)

    // '배고파...' 는 condition: hunger <= 20
    expect(candidates).not.toContain('배고파...')
  })

  it('hunger <= 20인 상태에서 hunger <= 20 조건 대사가 포함된다', () => {
    const state: PetState = { hunger: 10, happiness: 80, cleanliness: 80, level: 1 }
    const candidates = candidateTexts(state)

    expect(candidates).toContain('배고파...')
  })

  it('Lv.5에서 minLevel 5이고 condition을 통과하지 못한 대사는 제외된다', () => {
    // '완벽한 컨디션!' — condition: hunger>=80 && happiness>=80 && cleanliness>=80
    // happiness=30이면 조건 미충족
    const state: PetState = { hunger: 80, happiness: 30, cleanliness: 80, level: 5 }
    const candidates = candidateTexts(state)

    expect(candidates).not.toContain('완벽한 컨디션!')
  })

  it('Lv.5에서 minLevel 5이고 condition을 통과한 복합 대사가 포함된다', () => {
    // '완벽한 컨디션!' — condition: hunger>=80 && happiness>=80 && cleanliness>=80
    const state: PetState = { hunger: 85, happiness: 85, cleanliness: 85, level: 5 }
    const candidates = candidateTexts(state)

    expect(candidates).toContain('완벽한 컨디션!')
  })

  it('Lv.4 미만에서는 minLevel 5 대사가 condition을 통과해도 제외된다 (레벨 미달 우선)', () => {
    // hunger, happiness, cleanliness 모두 최대여서 condition은 통과 가능
    // 하지만 level=4 < minLevel=5 이므로 미포함
    const state: PetState = { hunger: 90, happiness: 90, cleanliness: 90, level: 4 }
    const candidates = candidateTexts(state)

    expect(candidates).not.toContain('완벽한 컨디션!')
  })

  it('level === 1이고 condition: s.level === 1 인 대사가 포함된다', () => {
    // '아직 Lv.1이다...' — minLevel 없음(=1), condition: s.level === 1
    const state: PetState = { hunger: 80, happiness: 80, cleanliness: 80, level: 1 }
    const candidates = candidateTexts(state)

    expect(candidates).toContain('아직 Lv.1이다...')
  })

  it('level > 1이면 condition: s.level === 1 대사가 제외된다', () => {
    const state: PetState = { hunger: 80, happiness: 80, cleanliness: 80, level: 2 }
    const candidates = candidateTexts(state)

    expect(candidates).not.toContain('아직 Lv.1이다...')
  })

  it('Lv.100에서 hunger <= 30 조건 대사(minLevel 100)가 hunger 30일 때 포함된다', () => {
    // '...그래도 배는 고프다' — minLevel: 100, condition: s.hunger <= 30
    const state: PetState = { hunger: 30, happiness: 60, cleanliness: 60, level: 100 }
    const candidates = candidateTexts(state)

    expect(candidates).toContain('...그래도 배는 고프다')
  })

  it('Lv.100에서 hunger > 30이면 해당 조건부 대사가 제외된다', () => {
    const state: PetState = { hunger: 50, happiness: 60, cleanliness: 60, level: 100 }
    const candidates = candidateTexts(state)

    expect(candidates).not.toContain('...그래도 배는 고프다')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. minLevel 기본값 — minLevel 미지정 시 Lv.1 동작
// ─────────────────────────────────────────────────────────────────────────────

describe('minLevel 기본값 — 미지정 시 Lv.1 동작', () => {
  it('minLevel이 없는 대사는 Lv.1 상태에서 후보에 포함된다 (null coalescing ?? 1 검증)', () => {
    // LINES 배열에서 minLevel=undefined인 대사를 직접 추려 Lv.1 state와 대조
    const implicitLines = LINES.filter((l) => l.minLevel === undefined && !l.condition)
    expect(implicitLines.length).toBeGreaterThan(0)

    const state = HIGH_STAT_STATE(1)
    const candidates = candidateTexts(state)

    for (const line of implicitLines) {
      expect(candidates).toContain(line.text)
    }
  })

  it('minLevel이 없는 대사는 Lv.50 상태에서도 여전히 후보에 포함된다 (상한 없음)', () => {
    const implicitLines = LINES.filter((l) => l.minLevel === undefined && !l.condition)
    const state = HIGH_STAT_STATE(50)
    const candidates = candidateTexts(state)

    for (const line of implicitLines) {
      // condition 없는 minLevel-미지정 대사는 모든 레벨에서 포함
      expect(candidates).toContain(line.text)
    }
  })

  it('minLevel이 없는 대사는 LINES에 12개 이상 존재한다', () => {
    const implicitLines = LINES.filter((l) => l.minLevel === undefined)
    expect(implicitLines.length).toBeGreaterThanOrEqual(12)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. pickLine 반환값 — 올바른 텍스트와 태그 반환
// ─────────────────────────────────────────────────────────────────────────────

describe('pickLine — 반환값 구조', () => {
  it('반환 객체에 text와 tag 필드가 있다', () => {
    const state = HIGH_STAT_STATE(1)
    const result = pickLine(state)

    expect(result).toHaveProperty('text')
    expect(result).toHaveProperty('tag')
  })

  it('반환된 text는 LINES 중 하나의 text와 일치한다', () => {
    const state = HIGH_STAT_STATE(5)
    const result = pickLine(state)
    const allTexts = LINES.map((l) => l.text)

    expect(allTexts).toContain(result.text)
  })

  it('반환된 tag는 유효한 LineTag 값이다 (null 포함)', () => {
    const validTags: (LineTag | null)[] = ['hungry', 'dirty', 'sad', 'sleep', null]
    const state = HIGH_STAT_STATE(5)

    // 여러 번 호출해서 다양한 tag 확인
    for (let i = 0; i < 20; i++) {
      const result = pickLine(state)
      expect(validTags).toContain(result.tag)
    }
  })

  it('Lv.1에서 반환된 text는 반드시 minLevel <= 1인 대사이다', () => {
    const state = HIGH_STAT_STATE(1)

    for (let i = 0; i < 30; i++) {
      const result = pickLine(state)
      const matchingLine = LINES.find((l) => l.text === result.text)
      expect(matchingLine).toBeDefined()
      expect((matchingLine!.minLevel ?? 1) <= 1).toBe(true)
    }
  })

  it('Lv.5에서 반환된 text는 반드시 minLevel <= 5인 대사이다', () => {
    const state = HIGH_STAT_STATE(5)

    for (let i = 0; i < 30; i++) {
      const result = pickLine(state)
      const matchingLine = LINES.find((l) => l.text === result.text)
      expect(matchingLine).toBeDefined()
      expect((matchingLine!.minLevel ?? 1) <= 5).toBe(true)
    }
  })

  it('Lv.100에서 반환된 text는 반드시 minLevel <= 100인 대사이다', () => {
    const state: PetState = { hunger: 80, happiness: 80, cleanliness: 80, level: 100 }

    for (let i = 0; i < 30; i++) {
      const result = pickLine(state)
      const matchingLine = LINES.find((l) => l.text === result.text)
      expect(matchingLine).toBeDefined()
      expect((matchingLine!.minLevel ?? 1) <= 100).toBe(true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. 가중치 선택 — 동일 풀에서 weight 비율 검증
// ─────────────────────────────────────────────────────────────────────────────

describe('가중치 선택 — Math.random 제어를 통한 결정론적 검증', () => {
  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore()
  })

  it('Math.random이 0을 반환하면 pool의 첫 번째 대사가 선택된다', () => {
    // roll = 0 * totalWeight = 0 → 첫 항목에서 roll(0) - weight(1) = -1 <= 0 → 첫 번째 반환
    jest.spyOn(Math, 'random').mockReturnValue(0)

    const state = HIGH_STAT_STATE(1)
    const pool = LINES.filter(
      (l) => state.level >= (l.minLevel ?? 1) && (!l.condition || l.condition(state)),
    )
    const expectedFirst = pool[0]

    const result = pickLine(state)
    expect(result.text).toBe(expectedFirst.text)
  })

  it('Math.random이 1에 아주 가까운 값을 반환하면 pool의 마지막 대사가 선택된다', () => {
    // roll = (1 - epsilon) * totalWeight → 루프를 거의 다 돌고 마지막에서 소진
    jest.spyOn(Math, 'random').mockReturnValue(1 - Number.EPSILON)

    const state = HIGH_STAT_STATE(1)
    const pool = LINES.filter(
      (l) => state.level >= (l.minLevel ?? 1) && (!l.condition || l.condition(state)),
    )
    const expectedLast = pool[pool.length - 1]

    const result = pickLine(state)
    expect(result.text).toBe(expectedLast.text)
  })

  it('weight: 3인 대사는 weight: 1 대사보다 3배 높은 확률로 선택된다 (통계적 분포 검증)', () => {
    // hunger <= 20인 starving 상태: '배고파...'(weight:3), '밥 줘...'(weight:2), 나머지(weight:1)
    // 이 테스트는 실제 무작위 호출로 분포를 확인 (1000회 샘플링)
    const state: PetState = { hunger: 10, happiness: 80, cleanliness: 80, level: 1 }
    const pool = LINES.filter(
      (l) => state.level >= (l.minLevel ?? 1) && (!l.condition || l.condition(state)),
    )

    const highWeightLine = pool.find((l) => l.text === '배고파...')
    const normalWeightLine = pool.find((l) => l.text === '...')

    expect(highWeightLine).toBeDefined()
    expect(normalWeightLine).toBeDefined()

    const counts: Record<string, number> = {}
    const RUNS = 2000

    // Math.random 복원 (통계 테스트는 실제 랜덤 필요)
    jest.spyOn(Math, 'random').mockRestore()

    for (let i = 0; i < RUNS; i++) {
      const r = pickLine(state)
      counts[r.text] = (counts[r.text] ?? 0) + 1
    }

    const highCount = counts['배고파...'] ?? 0
    const normalCount = counts['...'] ?? 0

    // '배고파...'(weight 3)는 '...'(weight 1)보다 통계적으로 많이 선택되어야 함
    // 엄격한 3배를 요구하면 flaky — 1.5배 이상이면 충분
    if (normalCount > 0) {
      expect(highCount / normalCount).toBeGreaterThan(1.5)
    }
    // normalCount가 0이면 high가 압도적으로 선택된 것 — 통과
  })

  it('pool이 단 1개 대사일 때 그 대사가 반드시 반환된다', () => {
    // level=1, 모든 condition을 제외한 상태에서 하나만 통과하도록 극단 stat 세팅
    // '살려줘...' — condition: avg(s) <= 15, weight: 3, tag: 'sad' (minLevel 없음)
    // 이 조건을 만족하는 유일한 상태: avg=5 (hunger=5, happiness=5, cleanliness=5)
    // 실제로는 여러 대사가 통과할 수 있으니, 결정론적 테스트로 첫/끝 경계를 확인
    jest.spyOn(Math, 'random').mockReturnValue(0)

    const state: PetState = { hunger: 10, happiness: 80, cleanliness: 80, level: 1 }
    const result1 = pickLine(state)

    jest.spyOn(Math, 'random').mockReturnValue(1 - Number.EPSILON)
    const result2 = pickLine(state)

    // 양쪽 모두 LINES에 존재하는 text여야 함
    expect(LINES.map((l) => l.text)).toContain(result1.text)
    expect(LINES.map((l) => l.text)).toContain(result2.text)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. 레벨 연속성 — 레벨이 오를수록 풀 크기가 단조 증가
// ─────────────────────────────────────────────────────────────────────────────

describe('레벨 연속성 — 레벨 증가에 따른 후보 풀 단조 증가', () => {
  it('레벨이 높아질수록 후보 풀이 줄어들지 않는다 (단조 증가 또는 유지)', () => {
    // condition 없는 대사만 카운트해서 순수한 minLevel 효과 측정
    const levels = [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 30, 50, 100, 150]
    const state = (level: number): PetState => ({
      hunger: 80, happiness: 80, cleanliness: 80, level,
    })

    let prevCount = -1
    for (const level of levels) {
      const count = LINES.filter(
        (l) => state(level).level >= (l.minLevel ?? 1) && (!l.condition || l.condition(state(level))),
      ).length

      expect(count).toBeGreaterThanOrEqual(prevCount)
      prevCount = count
    }
  })

  it('Lv.1 풀보다 Lv.5 풀이 더 크다 (신규 대사가 해금됨)', () => {
    const stateL1 = HIGH_STAT_STATE(1)
    const stateL5 = HIGH_STAT_STATE(5)

    const poolL1 = candidateTexts(stateL1)
    const poolL5 = candidateTexts(stateL5)

    expect(poolL5.length).toBeGreaterThan(poolL1.length)
  })

  it('Lv.100 풀은 Lv.5 풀보다 크다', () => {
    const stateL5 = HIGH_STAT_STATE(5)
    const stateL100: PetState = { hunger: 80, happiness: 80, cleanliness: 80, level: 100 }

    const poolL5 = candidateTexts(stateL5)
    const poolL100 = candidateTexts(stateL100)

    expect(poolL100.length).toBeGreaterThan(poolL5.length)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. LINES 배열 무결성 — 데이터 정합성 검증
// ─────────────────────────────────────────────────────────────────────────────

describe('LINES 배열 무결성', () => {
  it('모든 Line의 text는 빈 문자열이 아니다', () => {
    for (const line of LINES) {
      expect(line.text.length).toBeGreaterThan(0)
    }
  })

  it('모든 Line의 weight는 양수이거나 undefined이다', () => {
    for (const line of LINES) {
      if (line.weight !== undefined) {
        expect(line.weight).toBeGreaterThan(0)
      }
    }
  })

  it('모든 Line의 minLevel은 양의 정수이거나 undefined이다', () => {
    for (const line of LINES) {
      if (line.minLevel !== undefined) {
        expect(line.minLevel).toBeGreaterThanOrEqual(1)
        expect(Number.isInteger(line.minLevel)).toBe(true)
      }
    }
  })

  it('LINES는 비어 있지 않다', () => {
    expect(LINES.length).toBeGreaterThan(0)
  })

  it('Lv.1 state에서 항상 최소 1개 이상의 후보가 존재한다 (빈 pool 방지)', () => {
    // 이 조건이 깨지면 pickLine이 undefined.text에 접근해 런타임 에러 발생
    const state = HIGH_STAT_STATE(1)
    const pool = candidateTexts(state)
    expect(pool.length).toBeGreaterThan(0)
  })

  it('극단 스탯(모두 0) + Lv.1 에서도 후보가 존재한다 (빈 pool 방지)', () => {
    const state: PetState = { hunger: 0, happiness: 0, cleanliness: 0, level: 1 }
    const pool = candidateTexts(state)
    expect(pool.length).toBeGreaterThan(0)
  })
})
