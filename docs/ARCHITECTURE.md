# 아키텍처 구조 문서

## 1. 프로젝트 개요

Windows 바탕화면 위를 자유롭게 돌아다니는 디지털 생명체 육성 시뮬레이션 (다마고치 스타일).
반투명 몸체 내부에 이진수 데이터가 흐르는 사이버틱한 슬라임 캐릭터가 작업표시줄 위를 걸어다니며,
사용자와 상호작용(먹이주기, 쓰다듬기 등)을 통해 성장·진화한다.

---

## 2. 기술 스택

| 항목 | 기술 |
|---|---|
| Framework | Electron |
| Language | TypeScript |
| Frontend | React |
| Package Manager | pnpm |
| Build Tool | electron-vite |
| Styling | Tailwind CSS |
| Animation | CSS `steps()` (스프라이트), Framer Motion (인터랙션) |
| State Management | Zustand + persist middleware |

---

## 3. 프로세스 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│                    Main Process (Node.js)                 │
│                                                          │
│  ┌─────────┐  ┌──────────┐  ┌─────┐  ┌─────────────┐   │
│  │window.ts│  │movement.ts│  │tray │  │persistence.ts│  │
│  │         │  │ 30fps 루프 │  │     │  │ JSON 백업    │  │
│  └────┬────┘  └─────┬─────┘  └─────┘  └──────┬──────┘   │
│       │             │                         │          │
│       └──────┬──────┘                         │          │
│              │ ipc.ts                         │          │
│              │                                │          │
├──────────────┼────────────────────────────────┼──────────┤
│              │     Preload (contextBridge)     │          │
├──────────────┼────────────────────────────────┼──────────┤
│              │                                │          │
│              ▼     Renderer (React)           ▼          │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌───────────────────┐     │
│  │ Pet.tsx  │  │petStore.ts│  │ stateTick.ts      │     │
│  │ 스프라이트 │  │ Zustand   │  │ 10초 간격 감소     │     │
│  └──────────┘  └───────────┘  └───────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

---

## 4. 핵심 설계 결정

### 4.1 작은 윈도우 이동 방식

전체화면 투명 오버레이가 **아닌**, 캐릭터 크기에 맞춘 128×128 `BrowserWindow`를 `win.setPosition()`으로 이동시킨다. (64px 스프라이트 + 64px 점프 여유 공간)

**근거:**
- 전체화면 투명 surface를 합성할 필요 없어 성능이 좋음
- 데스크톱 클릭이 자연스럽게 통과 (별도 `setIgnoreMouseEvents` 불필요)
- 윈도우 전체가 곧 펫이므로 히트 테스팅이 단순

### 4.2 역할 분리: Main = 물리, Renderer = 시각

- **메인 프로세스**: 30fps `setInterval`로 윈도우 x/y 좌표 계산 + `win.setPosition()` 호출
- **렌더러**: IPC로 수신한 `{mode, direction}`에 따라 CSS/Framer Motion 애니메이션만 표시

**근거:** 윈도우 이동을 소유 프로세스에서 직접 수행하여 IPC 왕복 지연 회피

### 4.3 2중 영속성

```
Zustand persist → localStorage    (즉시, 렌더러 내부)
IPC 30초 간격 → pet-state.json    (백업, 메인 프로세스 관리)
```

시작 시 둘의 `lastTickTime`을 비교하여 최신 데이터 채택.

### 4.4 드래그 처리

- `-webkit-app-region: drag`로 네이티브 윈도우 드래그 활용
- `will-move`/`moved` 이벤트로 드래그 시작/종료 감지

---

## 5. 프로젝트 구조

```
D:/com-chr/
├── docs/
│   ├── ARCHITECTURE.md             # 이 문서 (아키텍처 구조)
│   ├── STACK_A_ARCHITECT.md        # Electron Main 구현 계획
│   ├── STACK_B_UI_ANIM.md          # UI/Animation 구현 계획
│   ├── STACK_C_LOGIC.md            # 상태 엔진 구현 계획
│   └── STACK_D_TEST_QA.md          # 테스트/QA 구현 계획
├── resources/
│   └── icon.png                    # 앱/트레이 아이콘
├── src/
│   ├── main/                       # [Stack A]
│   │   ├── index.ts                # 앱 라이프사이클
│   │   ├── window.ts               # BrowserWindow 생성 & 설정
│   │   ├── tray.ts                 # 시스템 트레이
│   │   ├── ipc.ts                  # IPC 핸들러 등록
│   │   ├── movement.ts             # 이동 엔진 (30fps)
│   │   └── persistence.ts          # pet-state.json 읽기/쓰기
│   ├── preload/                    # [Stack A]
│   │   ├── index.ts                # contextBridge API 노출
│   │   └── index.d.ts              # 타입 선언
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx            # React 진입점
│           ├── App.tsx             # 루트 컴포넌트
│           ├── components/         # [Stack B]
│           │   ├── Pet.tsx         # 펫 스프라이트 + 애니메이션
│           │   ├── StatusBubble.tsx # 상태 표시 툴팁
│           │   └── ContextMenu.tsx # 우클릭 상호작용 메뉴
│           ├── hooks/              # [Stack B]
│           │   ├── useElectronAPI.ts
│           │   └── usePetAnimation.ts
│           ├── store/              # [Stack C]
│           │   └── petStore.ts     # Zustand 상태 저장소
│           ├── engine/             # [Stack C]
│           │   ├── stateTick.ts    # 10초 간격 상태 감소 루프
│           │   └── evolution.ts    # 레벨업/진화 판정
│           ├── types/
│           │   └── pet.ts          # 공유 타입 정의
│           └── assets/
│               └── sprites/        # 스프라이트 이미지
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── tailwind.config.js
└── postcss.config.js
```

---

## 6. IPC 채널 설계

| 채널 | 방향 | 페이로드 | 스택 | 용도 |
|---|---|---|---|---|
| `movement:update` | Main → Renderer | `{ x, y, mode, direction }` | A→B | 위치/모드 동기화 |
| `pet:drag-start` | Renderer → Main | — | B→A | 걷기 루프 일시정지 |
| `pet:drag-end` | Renderer → Main | `{ screenY }` | B→A | 중력 낙하 시작 |
| `pet:save-state` | Renderer → Main | `PetState` | C→A | 상태 디스크 백업 |
| `pet:load-state` | Main → Renderer | `PetState \| null` | A→C | 시작 시 상태 복원 |
| `pet:mood-modifier` | Renderer → Main | `MoodModifier` | C→A | 상태→이동 패턴 연동 |
| `screen:geometry` | Main → Renderer | `{ workArea, anchorY }` | A→B | 화면 영역 정보 |

---

## 7. 스택 구성 & 에이전트 매핑

| 스택 | 역할 | 담당 에이전트 | 핵심 기술 | 계획 문서 |
|---|---|---|---|---|
| **A** | Electron Main, OS 제어 | `electron-system-architect` | Electron, Node.js | `STACK_A_ARCHITECT.md` |
| **B** | 캐릭터 렌더링, 애니메이션 | `hologram-slime-renderer` | React, CSS, Framer Motion | `STACK_B_UI_ANIM.md` |
| **C** | 다마고치 두뇌, 상태 관리 | `tamagotchi-state-manager` | Zustand, TypeScript | `STACK_C_LOGIC.md` |
| **D** | 검증, 디버깅, 예외 처리 | `tamagotchi-qa-agent` | Jest, Playwright | `STACK_D_TEST_QA.md` |

---

## 8. 구현 우선순위

### Phase 1: 걷기 & 점프 (즉시)

| 순서 | 스택 | 내용 |
|---|---|---|
| 1 | A | 프로젝트 스캐폴딩 |
| 2 | A | 투명 윈도우 + 라이프사이클 + 트레이 |
| 3 | A | IPC + Preload + 이동 엔진 |
| 4 | B | 스프라이트 렌더링 + 애니메이션 |

### Phase 2: 상태 엔진 (다음)

| 순서 | 스택 | 내용 |
|---|---|---|
| 5 | C | Zustand 스토어 + Tick 엔진 |
| 6 | C | 레벨업/진화 + 영속성 |
| 7 | B | 컨텍스트 메뉴 + StatusBubble |

### Phase 3: 폴리시 & 검증 (이후)

| 순서 | 스택 | 내용 |
|---|---|---|
| 8 | B | 드래그, 글리치 이펙트 |
| 9 | D | 전체 테스트 스위트 |

---

## 9. 주의사항 & 잠재적 문제

| 문제 | 대응 |
|---|---|
| `setPosition` 30fps 깜빡임 | `animate: false` 사용 (`win.setPosition(x, y, false)`) |
| 투명 윈도우 Windows 설정 | `frame: false` + `backgroundColor: '#00000000'` 필수 |
| 포커스 뺏기 | `focusable: false` 또는 `win.showInactive()` 사용 |
| Win+D 시 펫 사라짐 | `setAlwaysOnTop(true, 'screen-saver')` 사용 |
| 점프 시 윈도우 크기 부족 | 128px 높이로 64px 여유 확보 |
| 점프 CSS/엔진 타이밍 불일치 | 엔진 833ms ≈ CSS 830ms로 맞춤 |

---

## 10. 스프라이트 에셋

| 파일 | 크기 | 프레임 | 용도 |
|---|---|---|---|
| `chr_idle.png` | 256×64 | 4프레임 | idle/walking 겸용 |
| `chr_jump.png` | 384×64 | 6프레임 | 점프 시퀀스 |
| `chr_bit_idle.png` | TBD | TBD | Bit 진화 idle (향후) |
| `chr_bit_jump.png` | TBD | TBD | Bit 진화 jump (향후) |
| `chr_spirit_idle.png` | TBD | TBD | Spirit 진화 idle (향후) |
| `chr_spirit_jump.png` | TBD | TBD | Spirit 진화 jump (향후) |
