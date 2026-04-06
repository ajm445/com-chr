# Changelog

## [0.2.0] — 2026-04-07

### 개요
다마고치 상태 엔진(Stack C), 시각 피드백 UI(Stack B 확장), 메인 프로세스 고도화(Stack A)를 통합.
펫이 배고픔/행복/청결 3대 스탯을 가지며, 시간 경과에 따라 감소하고, 상호작용으로 회복하는 핵심 게임 루프를 완성.

### Stack A — Electron Main (`src/main/`)

**persistence.ts** (신규)
- `electron-store` 기반 펫 상태 영속화 (저장/로드)
- 입력 검증 함수 `validate()`: 잘못된 값을 안전하게 기본값으로 복구

**movement.ts** (변경)
- 다중 모니터 지원: 모든 디스플레이의 workArea를 결합하여 X 경계 계산
- 드래그를 메인 프로세스에서 `screen.getCursorScreenPoint()` 폴링으로 처리 (IPC 왕복 제거)
- 모니터 간 이동 시 anchorY 자동 재계산
- `sad`, `happy` 모드 추가 (각각 4초, 3초 지속)
- mood modifier 연동: 스탯에 따라 이동 속도/점프 확률/Idle 지속시간 변동

**ipc.ts** (변경)
- 네이티브 `Menu`로 컨텍스트 메뉴 전환 (Feed / Pet / Clean / Quit)
- `pet:mood-modifier` IPC 수신 → 이동 엔진에 전달
- `pet:save-state` / `pet:load-state` IPC
- `pet:context-menu`, `pet:click-through`, `pet:do-clean` IPC 추가

**window.ts** (변경)
- 윈도우 크기 128→160px 확장 (상태바 표시 공간 확보)
- `setIgnoreMouseEvents(true, { forward: true })` → 투명 영역 클릭 통과
- `pet:click-through` IPC로 hover 시 인터랙티브/패스스루 전환

### Stack B — Renderer UI (`src/renderer/src/`)

**Pet.tsx** (변경)
- hover 시 상태바 오버레이 표시 (Lv, EXP, 배고픔, 행복, 청결)
- 쓰다듬기 인터랙션: 좌우 반복 마우스 이동 3회 → petting 트리거 (2초 쿨다운)
- 컨텍스트 메뉴를 네이티브 메뉴로 교체 (`window.api.showContextMenu()`)
- `StatBar` 서브컴포넌트: 프로그레스바 + 수치 표시
- 커스텀 메뉴 버튼 제거 (네이티브 전환으로 불필요)

**BinaryParticles.tsx** (신규)
- 청결도 50 이하 시 슬라임 발 밑에 이진수(`0`, `1`) 파티클 생성
- 청결도가 낮을수록 생성 빈도 증가 (최대 12개)
- CSS `binary-roll-r/l` 애니메이션으로 좌우 흩어짐

**DirtOverlay.tsx** (신규)
- 청결도 50 이하 시 슬라임 위에 먼지 점 오버레이
- 시드 기반 고정 위치로 깜빡임 방지
- 청결도에 따라 개수(2~12)와 투명도(0.3~0.7) 변동

**SpeechBubble.tsx** (신규)
- 상태 기반 조건부 대사 시스템 (78개 대사)
- 조건부 대사 70%, 일반 대사 30% 가중 랜덤 선택
- 스탯 평균 낮을수록 말풍선 빈도 증가
- CSS `bubble-in` 애니메이션 + 말풍선 꼬리

**index.css** (변경)
- `bubble-in`, `binary-roll-r`, `binary-roll-l` 키프레임 추가
- 루트 크기 128→160px, height 100%로 변경

### Stack C — State Engine (`src/renderer/src/store/`, `engine/`)

**petStore.ts** (신규)
- Zustand + persist 미들웨어
- 스탯: `hunger`, `happiness`, `cleanliness` (0~100)
- `exp` / `level` (1~10) 시스템: `expForLevel(N) = 15 * N * (N+1)`
- 액션: `feed()` (+15 hunger, +3 exp), `pet()` (+10 happiness, +2 exp), `clean()` (+20 cleanliness, +2 exp)
- `tick()`: 10초마다 스탯 감소, 패시브 EXP 지급 (스탯 평균에 따라 배율)
- `applyOfflineDecay()`: 종료~재시작 사이 시간 역산 적용 (최대 24시간)
- `getMoodModifier()`: 스탯 → 이동 엔진 파라미터 변환

**stateTick.ts** (신규)
- `useStateTick()` 훅: 10초 tick + 시작 시 오프라인 역산 + 30초 메인 프로세스 백업

**types/pet.ts** (변경)
- `PetState`, `MoodModifier` 인터페이스 추가
- `expForLevel()`, `DEFAULT_PET_STATE`, `DECAY_RATES`, `TICK_INTERVAL`, `MAX_OFFLINE_TICKS` 상수

### Preload (`src/preload/`)
- 신규 API: `saveState`, `loadState`, `sendMoodModifier`, `showContextMenu`, `onClean`, `setClickThrough`, `expandWindow`
- 타입 정의(`index.d.ts`)에 `PetStateData`, `MoodModifierData` 추가

### Stack D — Test/QA (`src/__tests__/`)

**신규 테스트**
- `main/persistence.test.ts` — 34개: validate, savePetState, loadPetState
- `store/petTypes.test.ts` — 16개: expForLevel, DECAY_RATES, DEFAULT_PET_STATE
- `store/petStore.test.ts` — 55개: feed/pet/clean, tick, applyOfflineDecay, getMoodModifier, level-up

**결과**: 105 passed / 커버리지 98.8% (Statements), Branches 100%

### 의존성
- `zustand@^5.0.12` 추가

### 테스트 인프라
- `jest.config.js`, `tsconfig.test.json` 추가
- `src/__tests__/fixtures/petStates.ts` 테스트 픽스처

---

## [0.1.0] — 초기 커밋

- Electron + React + TypeScript 프로젝트 초기 구조
- 투명 프레임리스 윈도우 (128×128)
- 3-상태 이동 엔진 (idle/walking/jumping)
- CSS steps() 스프라이트 애니메이션 (idle 4프레임, jump 6프레임)
- 드래그 & 드롭 + 낙하 물리
- 커스텀 컨텍스트 메뉴 (Feed/Pet/Quit)
