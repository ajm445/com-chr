# 상호작용 설계 문서

> 슬라임 펫과 사용자 간의 모든 상호작용을 정의한다.
> 참조: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. 상호작용 개요

| 상호작용 | 트리거 | 스프라이트 필요 | 상태 |
|---|---|---|---|
| 드래그 (잡기) | 마우스 좌클릭 드래그 | `chr_grab.png` | TODO |
| 낙하 | 드래그 해제 | `chr_fall.png` | TODO |
| 착지 | 낙하 후 anchorY 도달 | `chr_land.png` | TODO |
| 클릭 반응 | 마우스 좌클릭 | 불필요 (CSS 변형) | ✅ 구현 가능 |
| 쓰다듬기 | 마우스 hover + 좌우 이동 | `chr_pet.png` | TODO |
| 먹이주기 | 우클릭 메뉴 → Feed | `chr_eat.png` | TODO |
| 배고픔 표현 | hunger ≤ 20 자동 | `chr_sad.png` | TODO |
| 우클릭 메뉴 | 마우스 우클릭 | 불필요 | ✅ 구현 가능 |
| 더블클릭 | 마우스 더블클릭 | 불필요 (점프 트리거) | ✅ 구현 가능 |

---

## 2. 즉시 구현 (스프라이트 불필요)

### 2.1 클릭 반응 (Squash & Stretch)

슬라임을 클릭하면 찌그러졌다 복원되는 탄성 효과.

**동작:**
1. 클릭 → `scaleX(1.2) scaleY(0.8)` (120ms)
2. → `scaleX(0.9) scaleY(1.1)` (100ms)
3. → `scaleX(1) scaleY(1)` (150ms)

**구현:** CSS `@keyframes squash` + Pet.tsx에서 클릭 이벤트 → 클래스 토글

### 2.2 더블클릭 점프

슬라임을 더블클릭하면 즉시 점프.

**동작:**
1. 더블클릭 → IPC `pet:force-jump` → Main
2. Main에서 현재 상태와 무관하게 jumping 전환

**구현:** Renderer → IPC → movement.ts `forceJump()`

### 2.3 우클릭 컨텍스트 메뉴

슬라임 위에서 우클릭 시 상호작용 메뉴 표시.

**메뉴 항목:**
- 🍖 먹이주기 (Feed) — Stack C 구현 후 활성화
- ✋ 쓰다듬기 (Pet) — Stack C 구현 후 활성화
- 🧹 청소 (Clean) — Stack C 구현 후 활성화
- ❌ 종료 (Quit)

**구현:** 네이티브 Electron `Menu.popup()` 또는 커스텀 HTML 메뉴

---

## 3. 스프라이트 필요 상호작용

### 3.1 드래그 (잡기) 시스템

**우선순위: 높음** — 키우는 느낌의 핵심

**동작 흐름:**
```
마우스 다운 (슬라임 위)
  → 이동 엔진 정지
  → 스프라이트: chr_grab.png (놀란 표정, 늘어난 몸)
  → 마우스 따라 윈도우 이동

마우스 업
  → 스프라이트: chr_fall.png (허우적)
  → 중력 낙하 시작 (vy = 0, gravity 적용)

anchorY 도달
  → 스프라이트: chr_land.png (찰싹 눌림)
  → 300ms 후 idle 복귀
```

**필요 스프라이트:**

| 파일 | 프레임 | 크기 | 설명 |
|---|---|---|---|
| `chr_grab.png` | 2~3프레임 | 128~192 × 64 | 놀란 눈, 몸 세로로 늘어남 |
| `chr_fall.png` | 2~3프레임 | 128~192 × 64 | 눈 동그랗게, 떨어지는 포즈 |
| `chr_land.png` | 3~4프레임 | 192~256 × 64 | 바닥에 찰싹 → 복원, 물방울 이펙트 |

**IPC 채널:**
- `pet:drag-start` (Renderer → Main): 이동 엔진 정지
- `pet:drag-end` (Renderer → Main, `{ screenX, screenY }`): 낙하 시작
- `movement:update` 에 mode `'dragging'` | `'falling'` | `'landing'` 추가

### 3.2 쓰다듬기 (Pet/Stroke)

**우선순위: 중간**

**동작:**
- 슬라임 위에서 마우스를 좌우로 3회 이상 움직이면 발동
- 쓰다듬기 감지: `mousemove` 이벤트에서 x 방향 전환 횟수 카운트
- 스프라이트: chr_pet.png (눈 감고 행복한 표정)
- 효과: happiness +10, exp +3 (Stack C 연동)

**필요 스프라이트:**

| 파일 | 프레임 | 크기 | 설명 |
|---|---|---|---|
| `chr_pet.png` | 4프레임 | 256 × 64 | 눈 감기 → 행복 표정, 하트 파티클 |

### 3.3 먹이주기 (Feed)

**우선순위: 중간** — Stack C (상태 엔진) 의존

**동작:**
- 우클릭 메뉴 → "먹이주기" 선택
- 스프라이트: chr_eat.png (냠냠 모션)
- 효과: hunger +15, exp +5

**필요 스프라이트:**

| 파일 | 프레임 | 크기 | 설명 |
|---|---|---|---|
| `chr_eat.png` | 4~6프레임 | 256~384 × 64 | 입 벌리기 → 씹기 → 만족 표정 |

### 3.4 감정 표현 (자동)

**우선순위: 낮음** — Stack C 의존

**동작:**
- 상태에 따라 자동으로 감정 스프라이트 재생
- hunger ≤ 20: 배고픔 모션 (주기적)
- happiness ≤ 20: 슬픔 모션 (주기적)
- happiness ≥ 80: 신남 모션 (가끔)

**필요 스프라이트:**

| 파일 | 프레임 | 크기 | 설명 |
|---|---|---|---|
| `chr_sad.png` | 3~4프레임 | 192~256 × 64 | 축 처진 몸, 눈물 이펙트 |
| `chr_happy.png` | 4프레임 | 256 × 64 | 통통 튀기, 반짝 이펙트 |

---

## 4. 스프라이트 제작 가이드

모든 스프라이트는 다음 규격을 따른다:

- **프레임 크기**: 64 × 64 px
- **배치**: 가로로 이어붙인 수평 스트립
- **스타일**: 기존 chr_idle.png와 동일 (사이버틱 슬라임, 이진수 데이터, 보라색 테두리)
- **배경**: 투명 (PNG alpha)
- **렌더링**: `image-rendering: pixelated` 적용 (도트 감성 유지)

---

## 5. 구현 우선순위 로드맵

### Phase 1: 즉시 구현 (스프라이트 불필요)
- [x] 클릭 → Squash & Stretch 반응
- [x] 더블클릭 → 강제 점프
- [x] 우클릭 → 컨텍스트 메뉴 (종료만)

### Phase 2: 드래그 시스템
- [x] `chr_grab.png` 제작 (2프레임)
- [x] `chr_fall.png` 제작 (3프레임)
- [x] `chr_land.png` 제작 (4프레임)
- [x] 드래그 시작/종료 IPC 구현
- [x] movement.ts에 dragging/falling/landing 상태 추가
- [x] Pet.tsx에 grab/fall/land 스프라이트 연동

### Phase 3: 감정 상호작용
- [x] `chr_pet.png` 제작 (4프레임)
- [x] `chr_eat.png` 제작 (6프레임)
- [x] 우클릭 메뉴 → Feed/Pet 동작 연결 (애니메이션만, 스탯 미연동)
- [ ] 쓰다듬기 감지 로직 (mousemove 방향 전환 카운트)
- [ ] Stack C 상태 엔진 연결 (스탯 변화 적용)

### Phase 4: 자동 감정 (Stack C 필요)
- [x] `chr_sad.png` 제작 (4프레임)
- [x] `chr_happy.png` 제작 (4프레임)
- [x] sad/happy 스프라이트 + CSS 키프레임 등록
- [ ] 상태 조건별 자동 스프라이트 전환 (Stack C 의존)

---

## 6. 필요 스프라이트 총 목록

| # | 파일 | 프레임 | Phase | 상태 |
|---|---|---|---|---|
| # | 파일 | 프레임 | 원본 크기 | Phase | 상태 |
|---|---|---|---|---|---|
| 1 | `chr_grab.png` | 2 | 711×351 | Phase 2 | ✅ 완료 |
| 2 | `chr_fall.png` | 3 | 869×287 | Phase 2 | ✅ 완료 |
| 3 | `chr_land.png` | 4 | 1003×249 | Phase 2 | ✅ 완료 |
| 4 | `chr_pet.png` | 4 | 1003×249 | Phase 3 | ✅ 완료 |
| 5 | `chr_eat.png` | 6 | 1236×202 | Phase 3 | ✅ 완료 |
| 6 | `chr_sad.png` | 4 | 1003×249 | Phase 4 | ✅ 완료 |
| 7 | `chr_happy.png` | 4 | 1003×249 | Phase 4 | ✅ 완료 |
