# Changelog

## [1.0.3] — 2026-04-08

### Fixed
- 작업표시줄·트레이·인스톨러 아이콘이 빈 투명 이미지로 보이던 문제 수정. `chr_idle` 스프라이트 첫 프레임을 잘라 `build/icon.{ico,png}`, `resources/icon.png`, `resources/tray.png`를 모두 재생성.

### Added
- `scripts/generate-icons.cjs` — `sharp` + `png-to-ico` 기반 아이콘 자동 생성 스크립트. 스프라이트가 갱신되면 한 번만 실행해 모든 아이콘 사이즈(16~512, ico 멀티사이즈 포함) 일괄 출력.

### Internal
- v0.3.0 스탯 밸런스 조정(`feed +10`, `pet +1`, `clean +10`)과 happiness penalty cascade 도입 이후 stale 상태로 남아 있던 `petStore` 단위 테스트 7건을 새 로직 기준으로 수정. 144건 전부 통과.

## [1.0.2] — 2026-04-08

### 개요
앱 정식 릴리스. 자동 업데이트 시스템, 레벨업 이펙트, 앱 브랜딩(이름·아이콘) 정비.
컨텍스트 메뉴 외부 클릭 닫기 버그 수정.

### Stack A — Electron Main (`src/main/`)

**updater.ts** (신규)
- `electron-updater` 기반 GitHub Releases 자동 업데이트
- 앱 시작 시 1회 체크 + 4시간 주기 재체크
- 다운로드 완료 시 사용자에게 재시작 다이얼로그 표시
- `autoInstallOnAppQuit`: 거절 시 다음 종료 때 자동 설치
- `app.isPackaged`일 때만 동작 (dev 환경 영향 없음)

**index.ts** (변경)
- `initAutoUpdater()` 호출 추가
- `setAppUserModelId`: `com.electron.com-chr` → `com.ajm445.slime-pet`

**ipc.ts** (변경)
- 컨텍스트 메뉴 표시 시 `setFocusable(true)` + `focus()` 호출 → 외부 클릭으로 메뉴 자동 닫기 수정
- 메뉴 콜백에서 `setFocusable(false)` 복원

**tray.ts** (변경)
- 트레이 아이콘 소스를 `resources/tray.png`(슬라임 idle 1프레임 32×32)로 교체
- 강제 16×16 리사이즈 제거 (찌그러짐 해소)
- `setToolTip('슬라임 펫')` 추가

### Stack B — Renderer UI (`src/renderer/src/`)

**LevelUpEffect.tsx** (신규)
- 레벨업 시 1.8초 일회성 이펙트
- 보라/마젠타 홀로그래픽 링 2겹 확장
- 10개 방사형 파티클
- "LEVEL UP ▲ Lv.N" 텍스트 글로우
- `useRef`로 prev level 추적, 다중 레벨업 동시 처리 가능

**Pet.tsx** (변경)
- `<LevelUpEffect />` 마운트

**index.css** (변경)
- `levelup-ring`, `levelup-particle`, `levelup-text` 키프레임 추가

### 빌드 / 배포

**electron-builder.yml**
- `productName`: `com-chr` → `슬라임 펫`
- `appId`: `com.electron.com-chr` → `com.ajm445.slime-pet`
- `win.executableName`: `SlimePet`
- `win.icon`, `nsis.installerIcon`, `nsis.uninstallerIcon`: `build/icon.ico`
- `nsis.artifactName`: `SlimePet-${version}-setup.${ext}`
- `publish`: GitHub Releases (`ajm445/com-chr`)
- `asarUnpack`: `electron-updater` 모듈 unpacked
- `files`: `scripts/` 제외

**아이콘**
- `chr_idle.png` 1번 프레임(64×64) → nearest-neighbor 업스케일로 픽셀 보존
- `build/icon.ico` (16/32/48/64/128/256 멀티사이즈)
- `build/icon.png` (256×256), `resources/icon.png` (512×512), `resources/tray.png` (32×32)

**scripts/generate-icons.mjs** (신규)
- `sharp` + `png-to-ico`로 아이콘 자동 생성 스크립트

**package.json**
- `electron-updater` 의존성 추가
- `png-to-ico` devDep 추가
- `release` 스크립트: `pnpm build && electron-builder --win --publish always`
- 버전 `1.0.0` → `1.0.1`

**dev-app-update.yml** (신규)
- dev 환경 업데이트 테스트용 설정

### 개발 도구

**.claude/commands/release.md** (신규)
- `/release [patch|minor|major]` 슬래시 명령어
- develop 브랜치 시작 → main 머지 → 버전 bump → 빌드 → GitHub publish → develop 동기화 자동화

### 버그 수정
- 컨텍스트 메뉴 외부 화면 클릭 시 미닫힘 (focusable 문제)
- 트레이 아이콘 찌그러짐 (1003×249 배너 이미지 강제 리사이즈)

### ⚠️ 호환성 주의
- `appId` 변경으로 기존 v0.x 설치본은 자동 업데이트 대상이 아님
- 기존 앱 제거 후 새 `SlimePet-1.0.1-setup.exe` 수동 설치 필요
- 이후 v1.0.2부터는 정상 자동 업데이트

---

## [0.3.1] — 2026-04-08 (미릴리스)

### 개요
레벨별 대사 해금 시스템 — 슬라임이 성장할수록 말문이 트임.

### Stack B — Renderer UI

**SpeechBubble.tsx** (변경)
- 각 대사에 `minLevel` 필드 추가
- Lv.1: 단순한 의성어/의태어만 ("...", "오?")
- Lv.3+: 짧은 단어
- Lv.5+: 짧은 문장
- Lv.7+: 감정 표현
- Lv.10: 풀 어휘 해금
- 현재 레벨 미만 대사는 후보에서 제외

---

## [0.3.0] — 2026-04-07

### 개요
상호작용 시스템 대폭 강화, 감정 표현 개선, 말풍선 고도화, 다수의 상태 머신 버그 수정.

### Stack A — Electron Main (`src/main/`)

**movement.ts** (변경)
- `sleeping` 모드 추가 (6초, 180프레임)
- `enterIdle()` 순서 수정: mode='idle' 먼저 설정 후 sadChance 체크 — landing→idle 전환 시 멈춤 버그 해결
- `enterFalling()`: 이미 바닥에 있으면 즉시 landing으로 전환 — 드래그 해제 후 멈춤 버그 해결
- `enterSad()` 재진입 가드 제거 — sad 상태 무한 멈춤 버그 해결
- petting/eating 종료 후 `enterHappy()` 전환 (기존: idle/walking 복귀)

**ipc.ts** (변경)
- 컨텍스트 메뉴 한글화 + "쓰다듬기" → "놀아주기" 변경
- 밥 주기/놀아주기/씻기기 시 스탯 변경 IPC 추가 (`pet:do-feed`, `pet:do-play`, `pet:do-clean`)
- 씻기기/놀아주기 시 happy 모션 트리거
- 5초 글로벌 쿨타임 (쿨타임 중 메뉴 항목 비활성화 + "대기중" 표시)
- interaction 타입에 `'sleeping'` 추가

### Stack B — Renderer UI (`src/renderer/src/`)

**Pet.tsx** (변경)
- falling 애니메이션: `infinite` → `1 forwards` (한 번만 재생)
- `NON_LOOPING_MODES`에 `'falling'` 추가
- happy 모드 `scale(1.15)` 보정 (스프라이트 크기 차이 보완)
- sleeping 스프라이트: 1번 프레임 제외 (2~6번만 재생, `backgroundPosition: -64px 0`)
- 드래그 중 흔들기 감지 → BinaryParticles에 shakeCount 전달
- 우클릭 시 말풍선/상태창 숨김 (menuOpen 상태)
- 상태창 위치: 말풍선 표시 중이면 위로 이동 (bottom: 105), 없으면 기존 위치 (bottom: 68)
- 상태창 위치 전환 `transition: bottom 0.25s ease`
- "배고픔" 라벨 → "배부름" 변경
- 쓰다듬기 쿨타임 10초, 행복도 +1
- feed/play/clean IPC 리스너 + 상호작용 말풍선 트리거

**BinaryParticles.tsx** (변경)
- 드래그 시작이 아닌 흔들기(shakeCount)로 파티클 낙하 트리거
- 떨어지는 파티클을 별도 `dropParticles` 배열로 분리
- 스프라이트 영역(bottom: 55~65)에서 아래로 낙하하는 `binary-drop` 애니메이션

**SpeechBubble.tsx** (변경)
- 대사 120개로 확장 (기존 78개)
- 상태 기반 필터링: 긍정 대사는 평균 스탯 40~60 이상, 부정 대사는 낮을 때만
- `pickLine()` 단순화: 조건 통과한 전체 대사에서 가중치 선택
- 상호작용 말풍선: 밥 "냠냠", 놀아주기 "헤헤", 씻기기 "뽀득"
- 상호작용 말풍선은 일반 말풍선보다 우선 (기존 타이머 취소 후 즉시 표시)
- `busyRef`로 말풍선 표시 중 중복 방지
- sleep 태그 대사 → sleeping 모션 트리거

**index.css** (변경)
- `sprite-sleep` 키프레임: 1번 프레임 스킵 (`from: -64px 0`)
- `binary-drop` 키프레임 추가
- `squash` 키프레임 (기존)

### Stack C — State Engine

**petStore.ts** (변경)
- `feed()`: hunger +15 → +10
- `pet()`: happiness +10 → +1 (쓰다듬기 너프)
- `play()` 신규: happiness +10, exp +5 (놀아주기)
- `clean()`: cleanliness +20 → +10
- 행복도 간접 감소: 배고픔/청결 50이하 시 느린 감소, 30이하 시 빠른 감소
- `getMoodModifier()`: sadChance 추가 (평균 ≤20 → 1.0, ≤40 → 0.5)
- `applyOfflineDecay()`: 동일 행복도 감소 로직 적용

### Preload
- `onFeed`, `onPlay`, `onClean` API 추가
- `triggerInteraction` 타입에 `'sleeping'` 추가

### 버그 수정
- landing→idle 전환 시 모션 멈춤 (enterIdle에서 mode 미설정)
- 드래그 해제 후 모션 멈춤 (바닥에서 falling 상태 유지)
- sad 상태 무한 멈춤 (재진입 가드 문제)
- 상태창 드래그 후 유지 (didDrag 시 setShowStats(false))
- 컨텍스트 메뉴 외부 클릭 시 미닫힘 (setIgnoreMouseEvents 토글)
- 밥 주기 시 스탯 미반영 (feed IPC 누락)

### 에셋
- `chr_sleepy.png` 추가 (6프레임 수면 스프라이트)

### 기타
- `.gitignore`에 `.claude/`, `coverage/` 추가

---

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
