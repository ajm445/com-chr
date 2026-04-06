# Stack B: UI/Anim — React + CSS Animation 구현 계획

> 담당 에이전트: `hologram-slime-renderer`
> 파일: `src/renderer/src/components/*`, `src/renderer/src/hooks/*`, `src/renderer/src/types/*`
> 참조: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. 스프라이트 에셋

| 파일 | 크기 | 프레임 | 용도 |
|---|---|---|---|
| `chr_idle.png` | 256×64 | 4프레임 | idle/walking 겸용 |
| `chr_jump.png` | 384×64 | 6프레임 | 점프 시퀀스 |

위치: `src/renderer/src/assets/sprites/`

---

## 2. 스프라이트 애니메이션 (`Pet.tsx`) — 핵심 파일

### 2.1 CSS `steps()` 방식

스프라이트 시트를 `background-image`로 설정하고, `background-position`을 `steps(N)`으로 이산적으로 이동시켜 프레임별 애니메이션을 구현.

```css
/* idle/walk: 4프레임, 600ms (150ms/frame), 무한 루프 */
.sprite-idle {
  width: 64px;
  height: 64px;
  background: url('./sprites/chr_idle.png') 0 0 / 256px 64px;
  animation: idle 0.6s steps(4) infinite;
  image-rendering: pixelated;
}
@keyframes idle {
  to { background-position: -256px 0; }
}

/* jump: 6프레임, 830ms (~138ms/frame), 1회 재생 */
.sprite-jump {
  width: 64px;
  height: 64px;
  background: url('./sprites/chr_jump.png') 0 0 / 384px 64px;
  animation: jump 0.83s steps(6) 1 forwards;
  image-rendering: pixelated;
}
@keyframes jump {
  to { background-position: -384px 0; }
}
```

### 2.2 방향 전환

스프라이트 기본 방향은 **오른쪽**. 왼쪽 이동 시 `transform: scaleX(-1)` 적용.

```tsx
<div
  className={spriteClass}
  style={{
    transform: direction === 'left' ? 'scaleX(-1)' : 'none',
  }}
/>
```

### 2.3 애니메이션 리스타트

- **idle/walking**: 같은 스프라이트 사용, `key`를 고정하여 루프 지속
- **jumping**: `key={Date.now()}`로 매번 새 DOM 엘리먼트 생성 → CSS 애니메이션 자동 리스타트

```tsx
<div
  key={mode === 'jumping' ? `jump-${Date.now()}` : 'idle'}
  className={mode === 'jumping' ? 'sprite-jump' : 'sprite-idle'}
/>
```

### 2.4 윈도우 내 배치

- 스프라이트는 128×128 윈도우의 **하단**에 고정
- `position: absolute; bottom: 0;`
- 점프 시 메인 프로세스가 윈도우 y좌표를 올리므로, 렌더러 내부에서는 위치 변경 불필요

---

## 3. IPC 구독 훅 (`usePetAnimation.ts`)

```typescript
function usePetAnimation() {
  const [movement, setMovement] = useState<MovementData>({
    x: 0, y: 0, mode: 'idle', direction: 'right'
  })

  useEffect(() => {
    const cleanup = window.api.onMovementUpdate((data) => {
      setMovement(data)
    })
    return cleanup
  }, [])

  return movement
}
```

---

## 4. 타입 정의 (`types/pet.ts`)

```typescript
type MovementMode = 'idle' | 'walking' | 'jumping'
type Direction = 'left' | 'right'

interface MovementData {
  x: number
  y: number
  mode: MovementMode
  direction: Direction
}
```

---

## 5. React 엔트리 포인트

### 5.1 `App.tsx`

```tsx
function App() {
  return (
    <div style={{ width: 128, height: 128, position: 'relative' }}>
      <Pet />
    </div>
  )
}
```

- 배경: `background: transparent`
- 오버플로우: `overflow: hidden` (점프 잔상 방지)

### 5.2 `index.html`

- `<body>` 배경 투명: `background: transparent`
- `<html>` 배경 투명: `background: transparent`

---

## 6. 향후 확장

### 6.1 글리치/홀로그램 이펙트

- RGB 분리: 레이어드 `box-shadow` 또는 pseudo-elements
- 주기적 글리치: `clipPath` + `skewX()` 버스트 (30~90초 간격, 200ms)
- 스캔라인: `repeating-linear-gradient`
- 홀로그램 쉬머: `hue-rotate` filter 애니메이션

### 6.2 StatusBubble

- hover 시 상태 바 표시 (hunger, happiness, cleanliness)
- 펫 위에 말풍선 형태로 렌더링

### 6.3 우클릭 컨텍스트 메뉴 (`ContextMenu.tsx`)

- Feed / Pet / Clean 상호작용 메뉴
- `-webkit-app-region: no-drag` 영역 설정

### 6.4 Squash & Stretch (Framer Motion)

- 착지 시: `scaleX(1.3) scaleY(0.7)` → spring back
- 클릭 시: `scaleX(1.15) scaleY(0.85)` 반응
- `transition: { type: 'spring', stiffness: 600, damping: 15 }`

### 6.5 드래그 & 낙하

- `-webkit-app-region: drag` 설정
- 드래그 시작 → IPC `pet:drag-start` → 이동 엔진 정지
- 드래그 해제 → IPC `pet:drag-end` → 중력 낙하

### 6.6 진화 스프라이트 교체

`stage` 값에 따라 스프라이트 경로 동적 결정:

| 단계 | idle | jump |
|---|---|---|
| Spawn | `chr_idle.png` | `chr_jump.png` |
| Bit | `chr_bit_idle.png` | `chr_bit_jump.png` |
| Spirit | `chr_spirit_idle.png` | `chr_spirit_jump.png` |

---

## 7. 생성 파일 목록

| 파일 | 역할 | 우선순위 |
|---|---|---|
| `src/renderer/index.html` | HTML 진입점 | 즉시 |
| `src/renderer/src/main.tsx` | React 진입점 | 즉시 |
| `src/renderer/src/App.tsx` | 루트 컴포넌트 | 즉시 |
| `src/renderer/src/components/Pet.tsx` | 스프라이트 컴포넌트 | 즉시 |
| `src/renderer/src/hooks/usePetAnimation.ts` | IPC→상태 훅 | 즉시 |
| `src/renderer/src/types/pet.ts` | 타입 정의 | 즉시 |
| `src/renderer/src/components/StatusBubble.tsx` | 상태 표시 | 향후 |
| `src/renderer/src/components/ContextMenu.tsx` | 우클릭 메뉴 | 향후 |

---

## 8. 검증 방법

1. idle 시 chr_idle.png 4프레임 루프 재생 확인
2. walking 시 동일 스프라이트 + 방향 반전 확인
3. jumping 시 chr_jump.png 6프레임 1회 재생 확인
4. 점프→idle 전환 시 스프라이트 깨짐 없이 복귀 확인
5. 픽셀 아트 선명도 확인 (`image-rendering: pixelated`)
6. 윈도우 배경 완전 투명 확인
