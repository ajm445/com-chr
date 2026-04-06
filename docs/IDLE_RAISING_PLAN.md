# 방치형 키우기 시스템 설계

## 1. 핵심 컨셉

**"방치해도 자라지만, 돌봐야 빨리 자란다"**

- EXP는 시간이 지나면 자동으로 쌓임 (방치형)
- 스탯(배고픔/행복/청결)이 높으면 EXP 배율이 올라감 (관리 보상)
- 스탯이 바닥이면 EXP 획득이 거의 멈춤 (관리 강제)
- 진화 조건: EXP 충족 + 최소 스탯 조건

---

## 2. 패시브 EXP 시스템

### 2.1 기본 EXP 획득

10초마다 (기존 tick과 동일) 자동 EXP 획득:

```
baseExp = 1 (tick당 기본)
statAvg = (hunger + happiness + cleanliness) / 3

if statAvg >= 70: multiplier = 2.0   (잘 관리)
if statAvg >= 40: multiplier = 1.0   (보통)
if statAvg >= 20: multiplier = 0.3   (방치)
if statAvg < 20:  multiplier = 0     (거의 방치 → EXP 정지)

earnedExp = baseExp × multiplier
```

### 2.2 상호작용 보너스 EXP

| 상호작용 | 스탯 효과 | 보너스 EXP |
|---|---|---|
| Feed | hunger +15 | +3 |
| Pet | happiness +10 | +2 |
| Clean | cleanliness +20 | +2 |

### 2.3 체감 성장 속도

| 관리 수준 | EXP/분 | Lv2 도달 | Lv5 도달 |
|---|---|---|---|
| 잘 관리 (스탯 70+) | 12 | ~2.5시간 | ~1일 |
| 보통 (스탯 40+) | 6 | ~5시간 | ~2일 |
| 방치 (스탯 20+) | 1.8 | ~17시간 | ~6일 |
| 완전 방치 (스탯 < 20) | 0 | ∞ | ∞ |

---

## 3. 레벨 & 진화

### 3.1 레벨 테이블

| 레벨 | 필요 누적 EXP | 진화 단계 |
|---|---|---|
| 1 | 0 | Spawn |
| 2 | 30 | Spawn |
| 3 | 80 | Spawn |
| 4 | 150 | → Bit 진화 가능 |
| 5 | 250 | Bit |
| 6 | 400 | Bit |
| 7 | 600 | Bit |
| 8 | 850 | → Spirit 진화 가능 |
| 9 | 1200 | Spirit |
| 10 | 1600 | Spirit (최대) |

### 3.2 진화 조건

| 진화 | EXP 조건 | 스탯 조건 | 설명 |
|---|---|---|---|
| Spawn → Bit | Lv4 (150 EXP) | 평균 스탯 ≥ 40 | 기본 관리만 하면 달성 |
| Bit → Spirit | Lv8 (850 EXP) | 평균 스탯 ≥ 60 | 꾸준한 관리 필요 |

- 스탯 조건 미충족 시: "진화 준비 완료! 스탯을 올려주세요" 표시
- 진화 시: 스프라이트 세트 교체 + 진화 연출

---

## 4. 청결 시스템 — 이진수 분비물

### 4.1 분비물 발생 조건

```
cleanliness ≤ 30: 분비물 파티클 시작 (가끔)
cleanliness ≤ 15: 분비물 증가 (자주)
cleanliness ≤ 5:  분비물 많음 + sad 표정
```

### 4.2 시각적 연출

슬라임 주변에 **"0"과 "1" 텍스트 파티클**이 떠다님:

- 사이버틱 슬라임답게 분비물도 이진수
- 파티클 동작: 슬라임 아래쪽에서 생성 → 느리게 떠오르며 페이드아웃
- 색상: 연두색 (#7fff7f) → 투명
- 크기: 8~12px, 픽셀 폰트
- 생성 빈도: 청결도에 반비례 (더러울수록 많이)

### 4.3 구현 방식

Pet.tsx에 `<BinaryParticles>` 컴포넌트 추가:
- cleanliness 값에 따라 파티클 생성 간격 조절
- CSS animation으로 떠오르기 + 페이드아웃
- 최대 동시 파티클 수 제한 (성능)

```
청결도 30: 5초마다 파티클 1개
청결도 15: 2초마다 파티클 1개
청결도 5:  0.5초마다 파티클 1개 + 동시 3~5개
```

### 4.4 Clean 상호작용

- 우클릭 → Clean: cleanliness +20, 분비물 파티클 전부 제거 (팡! 이펙트)
- Clean 시 전용 스프라이트가 없으므로 happy 스프라이트 재사용

---

## 5. 오프라인 EXP 역산

앱 종료 후 재시작 시:
- 경과 시간 동안의 스탯 감소 계산 (기존 로직)
- 감소된 스탯의 **평균값 기준**으로 오프라인 EXP 계산
- 최대 24시간분만 적용

```
offlineExp = offlineTicks × baseExp × offlineMultiplier
offlineMultiplier = 마지막 스탯 평균으로 근사 계산
```

---

## 6. 구현 순서

| 순서 | 내용 | 파일 |
|---|---|---|
| 1 | PetState에 exp, level, stage 추가 | types/pet.ts |
| 2 | Zustand 스토어에 EXP/레벨 로직 추가 | store/petStore.ts |
| 3 | tick에서 패시브 EXP 획득 | engine/stateTick.ts |
| 4 | 진화 판정 로직 | engine/evolution.ts |
| 5 | 이진수 분비물 파티클 컴포넌트 | components/BinaryParticles.tsx |
| 6 | Pet.tsx에 분비물 + 레벨 표시 연동 | components/Pet.tsx |
| 7 | 진화 시 스프라이트 교체 | (Bit/Spirit 스프라이트 필요) |

---

## 7. 외형

외형(스프라이트)은 레벨/진화와 무관하게 변하지 않는다.
레벨은 상태 바 UI에서만 확인 가능.
