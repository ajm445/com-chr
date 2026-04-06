# Stack A: Electron Main Process

## 역할
앱 라이프사이클, 투명 윈도우 관리, 이동 엔진(30fps), 시스템 트레이, IPC 통신.

## 파일 구조
- `index.ts` — 앱 진입점, 라이프사이클 관리
- `window.ts` — 128×128 투명 프레임리스 BrowserWindow 생성
- `movement.ts` — idle/walking/jumping 3-상태 머신 (30fps setInterval)
- `ipc.ts` — `movement:update` 채널 전송 헬퍼
- `tray.ts` — 시스템 트레이 아이콘 + 종료 메뉴
- `persistence.ts` — electron-store 파일 영속성 (향후)

## 핵심 규칙
- `win.setPosition(x, y, false)` — 세 번째 인자 `false` 필수 (애니메이션 비활성화)
- `setAlwaysOnTop(true, 'screen-saver')` — Win+D 생존
- `contextIsolation: true` 필수, `nodeIntegration: false`
- IPC 전송 전 `win.isDestroyed()` 체크 필수

## 담당 에이전트
`electron-system-architect`
