# Stack C: Logic — 다마고치 상태 엔진 구현 계획

> 담당 에이전트: `tamagotchi-state-manager`
> 파일: `src/renderer/src/store/*`, `src/renderer/src/engine/*`, `src/renderer/src/types/pet.ts`
> 의존: Stack A (이동 엔진), Stack B (스프라이트 렌더러) 완성 후 착수
> 참조: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. 개요

슬라임 펫의 내부 상태(허기, 행복, 청결, 경험치, 레벨)를 관리하고,
시간 경과에 따라 자동으로 감소시키며, 사용자 상호작용으로 회복시키는 시스템.
앱 종료/재시작 시에도 상태가 유지되어야 한다.

---

## 2. 타입 정의

**파일: `src/renderer/src/types/pet.ts`** (기존 MovementData에 추가)

```typescript
type EvolutionStage = 'Spawn' | 'Bit' | 'Spirit'

interface PetState {
  hunger: number       // 0-100, 높을수록 배부름
  happiness: number    // 0-100
  cleanliness: number  // 0-100
  level: number        // 1~
  exp: number          // 현재 레벨 내 누적 경험치
  stage: EvolutionStage
  lastTickTime: number // Date.now(), 오프라인 역산 기준
}

interface PetDerivedState {
  isStarving: boolean    // hunger <= 10
  isDirty: boolean       // cleanliness <= 10
  isSad: boolean         // happiness <= 10
  canEvolve: boolean     // level >= 다음 진화 임계값
  overallMood: 'good' | 'neutral' | 'bad'
}

type Interaction = 'feed' | 'pet' | 'clean'
```

---

## 3. Zustand 스토어 설계

**파일: `src/renderer/src/store/petStore.ts`**

### 3.1 스토어 구조

```typescript
interface PetStore extends PetState, PetDerivedState {
  feed: () => void       // hunger +15, exp +5
  pet: () => void        // happiness +10, exp +3
  clean: () => void      // cleanliness +20, exp +3
  tick: () => void
  applyOfflineDecay: (elapsed: number) => void
  checkEvolution: () => void
  reset: () => void
}
```

### 3.2 persist 미들웨어 설정

```typescript
const usePetStore = create<PetStore>()(
  persist(
    (set, get) => ({ /* 상태 + 액션 */ }),
    {
      name: 'pet-state',
      partialize: (s) => ({
        hunger: s.hunger,
        happiness: s.happiness,
        cleanliness: s.cleanliness,
        level: s.level,
        exp: s.exp,
        stage: s.stage,
        lastTickTime: s.lastTickTime,
      }),
    }
  )
)
```

### 3.3 유틸리티

```typescript
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
```

---

## 4. Tick 엔진

**파일: `src/renderer/src/engine/stateTick.ts`**

### 4.1 실시간 Tick (10초 간격)

```typescript
const TICK_INTERVAL = 10_000

const DECAY_RATES = {
  hunger:      0.5,   // 약 33분에 100→0
  happiness:   0.2,   // 약 83분에 100→0
  cleanliness: 0.3,   // 약 55분에 100→0
} as const
```

- 매 tick마다 `lastTickTime`을 `Date.now()`로 갱신
- React 컴포넌트에서 `useEffect`로 시작/정리

### 4.2 오프라인 역산

```typescript
function calculateOfflineDecay(lastTickTime: number): Partial<PetState> {
  const now = Date.now()
  const elapsedMs = Math.max(0, now - lastTickTime)
  const elapsedTicks = Math.floor(elapsedMs / TICK_INTERVAL)

  // 최대 24시간(8640 ticks)으로 상한 — 즉사 방지
  const cappedTicks = Math.min(elapsedTicks, 8640)

  return {
    hunger:      -cappedTicks * DECAY_RATES.hunger,
    happiness:   -cappedTicks * DECAY_RATES.happiness,
    cleanliness: -cappedTicks * DECAY_RATES.cleanliness,
  }
}
```

### 4.3 엣지 케이스

| 상황 | 대응 |
|---|---|
| 앱 3일 이상 방치 | 최대 24시간분만 역산 (즉사 방지) |
| 시스템 시계 역행 | `elapsedMs < 0`이면 역산 스킵, lastTickTime만 갱신 |
| 타임존/DST 변경 | UTC 기반 `Date.now()` 사용으로 영향 없음 |
| `lastTickTime`이 미래 | 조작으로 간주, 역산 스킵 |
| NaN / Infinity | clamp 전 `Number.isFinite()` 체크 |

---

## 5. 레벨업 & 진화 시스템

**파일: `src/renderer/src/engine/evolution.ts`**

### 5.1 경험치 테이블

```typescript
const EXP_TABLE = [
  0,    // Lv1 시작
  30,   // Lv2 달성 필요 exp
  50,   // Lv3
  80,   // Lv4
  120,  // Lv5
  170,  // Lv6
  230,  // Lv7
  300,  // Lv8
  400,  // Lv9
  500,  // Lv10 (최대)
] as const
```

- 레벨업: `exp >= EXP_TABLE[level]` → `exp -= EXP_TABLE[level]`, `level++`
- 초과분 이월, 최대 레벨 시 exp 누적만 계속

### 5.2 진화 조건

```typescript
const EVOLUTION_REQUIREMENTS = {
  Spawn:  { maxLevel: 3 },
  Bit:    { minLevel: 4, maxLevel: 7 },
  Spirit: { minLevel: 8 },
} as const
```

- 레벨업 시 `checkEvolution()` 자동 호출
- **단방향**: Spawn → Bit → Spirit, 역행 없음
- 진화 시 UI 이벤트 발행 → Stack B에서 스프라이트 교체 + 연출

---

## 6. 상호작용

### 6.1 액션별 효과

| 액션 | 주 효과 | 부 효과 | 쿨다운 |
|---|---|---|---|
| Feed (먹이주기) | hunger +15 | exp +5 | 5초 |
| Pet (쓰다듬기) | happiness +10 | exp +3 | 3초 |
| Clean (청소) | cleanliness +20 | exp +3 | 10초 |

- 쿨다운 중 재실행 시 무시 (UI 비활성화 표시)
- 모든 값 0~100 clamp

### 6.2 상태 → 이동 엔진 연동

펫 상태가 이동 패턴에 영향. IPC `pet:mood-modifier`로 Main에 전달:

```typescript
interface MoodModifier {
  speedMultiplier: number   // 0.5 ~ 1.0
  jumpChance: number        // 0.0 ~ 0.25
  idleMultiplier: number    // 1.0 ~ 2.0
}
```

| 조건 | 효과 |
|---|---|
| `hunger <= 20` | 속도 50% 감소, 점프 확률 0% |
| `happiness <= 20` | idle 시간 2배 증가 |
| `happiness >= 80` | 점프 확률 25%로 증가 |
| `cleanliness <= 20` | 특수 이펙트 (향후) |

---

## 7. 데이터 영속성

### 7.1 2중 저장

| 계층 | 방식 | 트리거 | 관리 |
|---|---|---|---|
| localStorage | Zustand persist | 상태 변경 즉시 | 렌더러 |
| pet-state.json | electron-store | 30초 간격 IPC | 메인 프로세스 |

### 7.2 시작 시 복원

```
앱 시작
  ├→ localStorage 로드 (Zustand persist 자동)
  ├→ IPC로 pet-state.json 요청
  ├→ lastTickTime 비교 → 최신 채택
  ├→ calculateOfflineDecay() 적용
  └→ lastTickTime을 현재 시각으로 갱신
```

### 7.3 데이터 검증

로드 시 모든 필드 검증:
- 객체 타입 확인
- 각 필드 존재 & 타입 확인
- 숫자 범위 clamp
- stage 유효성 확인
- 실패 시 기본값 반환

---

## 8. 생성 파일 목록

| 파일 | 역할 |
|---|---|
| `src/renderer/src/types/pet.ts` | PetState, EvolutionStage 타입 (기존 확장) |
| `src/renderer/src/store/petStore.ts` | Zustand 스토어 + persist |
| `src/renderer/src/engine/stateTick.ts` | 10초 tick + 오프라인 역산 |
| `src/renderer/src/engine/evolution.ts` | 레벨업/진화 판정 |
| `src/main/persistence.ts` | electron-store 읽기/쓰기 |

---

## 9. 구현 순서

| 순서 | 내용 | 파일 |
|---|---|---|
| 1 | 타입 정의 확장 | types/pet.ts |
| 2 | Zustand 스토어 + persist | store/petStore.ts |
| 3 | Tick 엔진 (실시간 감소) | engine/stateTick.ts |
| 4 | 오프라인 역산 | engine/stateTick.ts |
| 5 | 레벨업 & 진화 | engine/evolution.ts |
| 6 | 파일 영속성 | main/persistence.ts |
| 7 | IPC 채널 추가 | main/ipc.ts, preload/index.ts |
| 8 | 상태 → 이동 패턴 연동 | main/movement.ts 수정 |

---

## 10. 검증 방법

1. 스토어 초기화 → 기본값(80/80/80, Lv1, Spawn) 확인
2. `feed()` → hunger +15, exp +5, 100 초과 없음
3. 10초 대기 → hunger/happiness/cleanliness 감소 확인
4. 앱 종료 → 재시작 → 상태 복원 + 경과 시간 역산 확인
5. exp 누적 → 레벨업 → 진화 단계 전환 확인
6. localStorage 삭제 → pet-state.json 복원 확인
7. 악성 JSON 주입 → 기본값 복구 확인
8. 3일 방치 시뮬레이션 → 최대 24시간분 역산 확인
9. 시스템 시계 역행 → 역산 스킵 확인
10. `hunger <= 20` → 이동 속도 감소 + 점프 비활성화 확인
