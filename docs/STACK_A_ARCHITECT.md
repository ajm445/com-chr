# Stack A: Architect — Electron Main + Node.js 구현 계획

> 담당 에이전트: `electron-system-architect`
> 파일: `src/main/*`, `src/preload/*`
> 참조: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. 프로젝트 스캐폴딩

```bash
pnpm create @quick-start/electron . -- --template react-ts
pnpm add -D tailwindcss @tailwindcss/vite
```

- `electron.vite.config.ts` renderer 섹션에 `tailwindcss()` 플러그인 추가
- CSS 진입점에 `@import "tailwindcss"` 추가
- 스프라이트를 `src/renderer/src/assets/sprites/`로 이동
- `resources/icon.png` 준비 (chr_idle.png 첫 프레임 크롭)

---

## 2. 투명 프레임리스 윈도우 (`window.ts`)

128×128 BrowserWindow 생성:

| 옵션 | 값 | 이유 |
|---|---|---|
| `frame` | `false` | 타이틀바 제거 |
| `transparent` | `true` | 배경 투명 |
| `backgroundColor` | `'#00000000'` | Windows 투명 필수 |
| `skipTaskbar` | `true` | 작업표시줄에 앱 표시 안 함 |
| `alwaysOnTop` | `true` (level: `'screen-saver'`) | Win+D 생존 |
| `focusable` | `false` | 포커스 뺏기 방지 |
| `resizable` | `false` | 크기 고정 |
| `hasShadow` | `false` | 투명 윈도우 그림자 제거 |

위치 계산:
```typescript
const { workArea } = screen.getPrimaryDisplay()
const x = workArea.x + workArea.width / 2  // 화면 중앙에서 시작
const y = workArea.y + workArea.height - 128  // 작업표시줄 바로 위
```

---

## 3. 앱 라이프사이클 (`index.ts`)

```
app.whenReady()
  ├→ createWindow()
  ├→ createTray()
  ├→ registerIPC()
  └→ startMovementEngine()
```

- `app.requestSingleInstanceLock()` — 중복 실행 방지
- `app.on('window-all-closed')` — Windows에서 앱 종료 처리

---

## 4. 최소 시스템 트레이 (`tray.ts`)

- `resources/icon.png`로 트레이 아이콘 생성
- 컨텍스트 메뉴: "종료" 1개만
- 향후: 설정, 보이기/숨기기 추가

---

## 5. IPC & Preload 브릿지

### 5.1 Preload (`src/preload/index.ts`)

```typescript
contextBridge.exposeInMainWorld('api', {
  onMovementUpdate: (callback) => {
    ipcRenderer.on('movement:update', (_e, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('movement:update')
  }
})
```

### 5.2 타입 선언 (`src/preload/index.d.ts`)

`window.api` 인터페이스 정의 — `onMovementUpdate` 시그니처

### 5.3 IPC 헬퍼 (`src/main/ipc.ts`)

```typescript
function sendMovementUpdate(win: BrowserWindow, data: MovementData): void {
  if (!win.isDestroyed()) {
    win.webContents.send('movement:update', data)
  }
}
```

### 5.4 향후 추가 채널

| 채널 | 방향 | 용도 |
|---|---|---|
| `pet:drag-start` | R→M | 걷기 루프 일시정지 |
| `pet:drag-end` | R→M | 중력 낙하 시작 |
| `pet:save-state` | R→M | 상태 디스크 백업 |
| `pet:load-state` | M→R | 시작 시 상태 복원 |
| `pet:mood-modifier` | R→M | 상태→이동 패턴 연동 |

---

## 6. 이동 엔진 (`movement.ts`) — 핵심 파일

30fps `setInterval`(33.3ms)로 구동하는 3-상태 머신.

### 6.1 상태 머신

```
         ┌─────────┐
    ┌───►│  idle   │◄───────────┐
    │    └────┬────┘            │
    │     85% │    15%          │ anchorY 도달
    │         ▼                 │
    │    ┌─────────┐       ┌────┴────┐
    │    │ walking │       │ jumping │
    │    └────┬────┘       └─────────┘
    │         │ 타이머 만료
    └─────────┘
```

### 6.2 idle 상태

- 2~8초 랜덤 대기
- 타이머 만료 시 → **15% 확률 jumping**, 나머지 walking 전환
- 자연스러운 빈도: 약 15~40초에 1회 점프

### 6.3 walking 상태

- 랜덤 방향(좌/우), 속도 0.5~2 px/frame
- 3~10초간 이동
- workArea 경계 도달 시: 50% 방향 전환, 50% idle 전환

### 6.4 jumping 상태

- 오일러 적분 물리: `vy += gravity(0.45)`, `y += vy`
- 초기속도: `vy = -5.5` (위로)
- 최고점: anchor 위 약 34px
- 체공시간: ~25프레임 (833ms)
- anchorY 도달 시 → idle 전환
- x 이동 없음 (제자리 점프)

### 6.5 매 틱 실행 흐름

```
상태 로직 실행 → win.setPosition(x, y, false) → sendMovementUpdate()
```

`setPosition`의 세 번째 인자 `false`가 핵심 — OS 윈도우 애니메이션 비활성화.

---

## 7. 파일 영속성 (`persistence.ts`) — 향후

- `electron-store`로 `pet-state.json` 관리
- IPC `pet:save-state` 수신 시 파일에 기록
- IPC `pet:load-state` 요청 시 파일에서 읽어 전달
- JSON Schema 기반 유효성 검증

---

## 8. 생성 파일 목록

| 파일 | 역할 | 우선순위 |
|---|---|---|
| `src/main/index.ts` | 앱 라이프사이클 | 즉시 |
| `src/main/window.ts` | BrowserWindow 생성 | 즉시 |
| `src/main/tray.ts` | 시스템 트레이 | 즉시 |
| `src/main/ipc.ts` | IPC 헬퍼 | 즉시 |
| `src/main/movement.ts` | 이동 엔진 | 즉시 |
| `src/preload/index.ts` | contextBridge | 즉시 |
| `src/preload/index.d.ts` | 타입 선언 | 즉시 |
| `src/main/persistence.ts` | 파일 영속성 | 향후 |

---

## 9. 검증 방법

1. `pnpm dev` → 투명 윈도우가 작업표시줄 위에 표시되는지 확인
2. 펫이 좌우로 걸어다니다 멈추기를 반복하는지 확인
3. 가끔 제자리에서 점프하는지 확인
4. 화면 경계에서 벗어나지 않는지 확인
5. 시스템 트레이 → 종료 동작 확인
6. Win+D 시 펫이 사라지지 않는지 확인
