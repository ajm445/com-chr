# com-chr — 디지털 펫 데스크톱 앱

## 프로젝트 개요
Windows 작업표시줄 위에 사는 사이버틱 슬라임 데스크톱 펫.
Electron + React + TypeScript 기반 다마고치 스타일 앱.

## 기술 스택
- **Framework**: Electron (main process) + React (renderer)
- **Language**: TypeScript (strict)
- **Build**: electron-vite, pnpm
- **Styling**: Tailwind CSS v4
- **Animation**: CSS `steps()` 스프라이트, Framer Motion (향후)
- **State**: Zustand + persist (향후)

## 아키텍처 핵심
- **메인 프로세스**: 30fps 이동 엔진, 윈도우 위치 제어, 시스템 트레이
- **렌더러**: 스프라이트 애니메이션만 담당, IPC로 상태 수신
- **윈도우**: 128×128 투명 프레임리스, `win.setPosition()`으로 이동

## 스택 구성
| 스택 | 역할 | 경로 | 에이전트 |
|---|---|---|---|
| A | Electron Main | `src/main/`, `src/preload/` | `electron-system-architect` |
| B | UI/Animation | `src/renderer/src/components/`, `hooks/` | `hologram-slime-renderer` |
| C | State Engine | `src/renderer/src/store/`, `engine/` | `tamagotchi-state-manager` |
| D | Test/QA | `src/__tests__/` | `tamagotchi-qa-agent` |

## 명령어
- `pnpm dev` — 개발 모드 실행
- `pnpm build` — 프로덕션 빌드
- `pnpm preview` — 빌드 미리보기

## 코드 규칙
- TypeScript strict 모드
- 메인 프로세스에서 `contextIsolation: true` 필수
- 렌더러에서 `nodeIntegration` 사용 금지
- 스프라이트에 `image-rendering: pixelated` 항상 적용
- 한국어 커밋/주석 가능, 코드와 변수명은 영어

## 문서
- `docs/ARCHITECTURE.md` — 전체 아키텍처
- `docs/STACK_A_ARCHITECT.md` — Electron Main 계획
- `docs/STACK_B_UI_ANIM.md` — UI/Animation 계획
- `docs/STACK_C_LOGIC.md` — 상태 엔진 계획
- `docs/STACK_D_TEST_QA.md` — 테스트/QA 계획
