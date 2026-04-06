# Stack B: Renderer (UI/Animation)

## 역할
스프라이트 애니메이션 렌더링, IPC 수신, 사용자 인터랙션 UI.

## 파일 구조
- `components/Pet.tsx` — CSS `steps()` 기반 스프라이트 애니메이션
- `hooks/usePetAnimation.ts` — `window.api.onMovementUpdate` 구독 훅
- `types/pet.ts` — MovementMode, Direction, MovementData 타입
- `App.tsx` — 루트 컴포넌트 (128×128 투명 컨테이너)
- `assets/sprites/` — chr_idle.png (4프레임), chr_jump.png (6프레임)

## 핵심 규칙
- 스프라이트: `image-rendering: pixelated` 항상 적용
- 방향 전환: `transform: scaleX(-1)` (left 방향)
- 점프 애니메이션 리스타트: React `key={Date.now()}` 패턴
- CSS 타이밍: idle 600ms/4steps, jump 830ms/6steps
- 윈도우 내 배치: `position: absolute; bottom: 0`

## 담당 에이전트
`hologram-slime-renderer`

## Stack C (향후)
- `store/petStore.ts` — Zustand 상태 저장소
- `engine/stateTick.ts` — 10초 간격 상태 감소
- `engine/evolution.ts` — 레벨업/진화 판정
- 담당: `tamagotchi-state-manager`
