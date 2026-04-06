# Stack D: Test/QA — 검증 & 디버깅 구현 계획

> 담당 에이전트: `tamagotchi-qa-agent`
> 의존: Stack A~C 핵심 로직 구현 후 착수
> 참조: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. 개요

데스크톱 펫 앱의 신뢰성을 보장하기 위한 테스트 전략.
시간 기반 상태 변화, 파일 영속성, 윈도우 좌표 계산이 핵심 테스트 영역이다.

---

## 2. 기술 스택

| 도구 | 용도 |
|---|---|
| Jest | 단위/통합 테스트 |
| Playwright | Electron E2E 테스트 |
| `jest.useFakeTimers()` | 시간 흐름 시뮬레이션 |

---

## 3. 테스트 도메인 & 우선순위

### 3.1 시간 흐름 테스트 (최우선)

가장 버그가 많은 영역. `jest.useFakeTimers()`와 `jest.setSystemTime()` 활용.

**테스트 시나리오:**

| 시나리오 | 검증 내용 |
|---|---|
| 앱 종료 후 1분 재시작 | 상태 미세 감소 확인 |
| 앱 종료 후 1시간 | 중간 수준 감소 확인 |
| 앱 종료 후 1일 | 큰 폭 감소, 0 이하 없음 확인 |
| 앱 종료 후 7일 | 24시간 상한 적용 확인 |
| 앱 종료 후 30일 | 24시간 상한 적용 확인 |
| 시스템 시계 역행 | 역산 스킵 확인 |
| 타임존 변경 | 영향 없음 확인 (UTC 기반) |
| DST 전환 | 영향 없음 확인 |
| `lastTickTime`이 미래 | 역산 스킵 확인 |

**핵심 검증:**
- 감소량 수학적 정확성: `decayAmount = cappedTicks * decayRate`
- 모든 값 0~100 클램프
- 오버플로우 없음 (NaN, Infinity 방어)

---

### 3.2 데이터 무결성 테스트

**config.json 강제 종료 시나리오:**

| 시나리오 | 검증 내용 |
|---|---|
| 정상 저장 후 로드 | 데이터 일치 확인 |
| 부분 기록 중 종료 | 이전 상태 또는 기본값 복원 |
| 파일 삭제 후 시작 | 기본값으로 초기화 |
| 빈 파일 | 기본값으로 초기화 |
| 권한 오류 | 기본값으로 초기화 |

**악성 JSON 주입 방어:**

| 입력 | 기대 결과 |
|---|---|
| `{ "hunger": -999 }` | 0으로 클램프 |
| `{ "hunger": 99999 }` | 100으로 클램프 |
| `{ "hunger": "abc" }` | 기본값 사용 |
| `{ "level": 0 }` | 1로 보정 |
| `{ "stage": "Unknown" }` | 'Spawn'으로 초기화 |
| `{ }` (빈 객체) | 전체 기본값 사용 |
| `"not json"` | 전체 기본값 사용 |
| `null` | 전체 기본값 사용 |
| 필드 누락 | 누락 필드만 기본값 |

---

### 3.3 이동 엔진 테스트

**상태 전환:**

| 시나리오 | 검증 내용 |
|---|---|
| idle 타이머 만료 | walking 또는 jumping으로 전환 |
| walking 타이머 만료 | idle로 전환 |
| jumping 착지 | idle로 전환 |
| idle→jumping 확률 | 다수 반복 시 ~15% 근사 |

**경계 클램핑:**

| 시나리오 | 검증 내용 |
|---|---|
| walking 좌측 경계 도달 | x >= workArea.x |
| walking 우측 경계 도달 | x <= workArea.x + workArea.width - spriteWidth |
| jumping 최고점 | y가 음수(화면 밖)로 가지 않음 |
| jumping 착지 | y가 정확히 anchorY |

**점프 물리:**

| 검증 항목 | 기대값 |
|---|---|
| 최고점 높이 | anchor 위 약 34px |
| 체공시간 | ~25프레임 (833ms) |
| 착지 y | 정확히 anchorY (스냅) |
| 착지 후 vy | 0으로 리셋 |

---

### 3.4 윈도우 좌표 테스트

**해상도별:**

| 해상도 | 확인 항목 |
|---|---|
| 1920×1080 (FHD) | 기본 위치 정확성 |
| 2560×1440 (QHD) | 작업표시줄 위 앵커 |
| 3840×2160 (4K) | 스프라이트 위치 |

**DPI 스케일링:**

| 스케일 | 확인 항목 |
|---|---|
| 100% | 기본 동작 |
| 125% | workArea 보정 |
| 150% | workArea 보정 |
| 200% | workArea 보정 |

**멀티 모니터:**

| 시나리오 | 검증 내용 |
|---|---|
| 주 모니터 정상 배치 | workArea 내 위치 |
| 보조 모니터 분리 | 주 모니터로 복귀 |
| 모니터 해상도 변경 | 위치 재계산 |

**Mock 방법:** `screen.getPrimaryDisplay()`, `screen.getAllDisplays()` 모킹

---

### 3.5 레벨업/진화 테스트

| 시나리오 | 검증 내용 |
|---|---|
| exp 정확히 임계값 | 레벨업 발생 |
| exp 임계값 - 1 | 레벨업 미발생 |
| exp 초과 | 초과분 이월 |
| Lv3 → Lv4 | Spawn → Bit 진화 |
| Lv7 → Lv8 | Bit → Spirit 진화 |
| 최대 레벨 | 레벨 변화 없음, exp 누적 |
| 역행 불가 | Spirit에서 Bit으로 돌아가지 않음 |
| 동시 조건 충족 | 결정적(deterministic) 처리 |

---

## 4. 테스트 작성 표준

### 4.1 파일 구조

```
src/
├── __tests__/
│   ├── engine/
│   │   ├── stateTick.test.ts
│   │   └── evolution.test.ts
│   ├── store/
│   │   └── petStore.test.ts
│   ├── main/
│   │   ├── movement.test.ts
│   │   └── persistence.test.ts
│   └── fixtures/
│       └── petStates.ts          # 재사용 테스트 데이터
```

### 4.2 명명 규칙

```typescript
describe('배고픔 계산 - Time Flow', () => {
  it('should correctly calculate hunger after 48 hours offline', () => {})
  it('should cap decay at 24 hours maximum', () => {})
  it('should skip decay when system clock is set backwards', () => {})
})
```

### 4.3 AAA 패턴

```typescript
it('should clamp hunger to 0 after long offline period', () => {
  // Arrange
  const state = createPetState({ hunger: 50, lastTickTime: hoursAgo(48) })

  // Act
  const result = calculateOfflineDecay(state.lastTickTime)

  // Assert
  expect(clamp(state.hunger + result.hunger, 0, 100)).toBe(0)
})
```

### 4.4 픽스처

```typescript
// fixtures/petStates.ts
const FIXTURES = {
  newborn:  { hunger: 80, happiness: 80, cleanliness: 80, level: 1, exp: 0, stage: 'Spawn' },
  midLevel: { hunger: 50, happiness: 50, cleanliness: 50, level: 5, exp: 100, stage: 'Bit' },
  maxLevel: { hunger: 30, happiness: 30, cleanliness: 30, level: 10, exp: 999, stage: 'Spirit' },
  starving: { hunger: 5, happiness: 20, cleanliness: 30, level: 3, exp: 25, stage: 'Spawn' },
} as const
```

---

## 5. 커버리지 목표

| 영역 | 목표 | 근거 |
|---|---|---|
| 시간 흐름 계산 | > 95% branch | 가장 버그 발생률 높음 |
| 데이터 영속성 | > 90% branch | 데이터 손실 방지 |
| 레벨업/진화 | > 90% branch | 결정적 동작 필수 |
| 이동 엔진 | > 80% branch | 시각적 확인 보완 |
| 윈도우 좌표 | > 70% branch | 환경 의존적 |

---

## 6. 생성 파일 목록

| 파일 | 역할 |
|---|---|
| `src/__tests__/engine/stateTick.test.ts` | 시간 감소 + 오프라인 역산 |
| `src/__tests__/engine/evolution.test.ts` | 레벨업/진화 판정 |
| `src/__tests__/store/petStore.test.ts` | Zustand 스토어 통합 |
| `src/__tests__/main/movement.test.ts` | 이동 엔진 상태 머신 |
| `src/__tests__/main/persistence.test.ts` | 파일 영속성 + 검증 |
| `src/__tests__/fixtures/petStates.ts` | 공유 테스트 데이터 |

---

## 7. 검증 방법

1. `pnpm test` → 전체 테스트 스위트 통과
2. `pnpm test --coverage` → 커버리지 목표 달성
3. 시간 흐름 테스트에서 flaky 없음 (`jest.useFakeTimers` 전용)
4. 악성 입력 테스트에서 크래시 없이 기본값 복원
5. 이동 엔진 테스트에서 경계 탈출 없음
