import { useEffect, useState, useRef, useCallback } from 'react'
import { usePetStore } from '../store/petStore'

// ---------------------------------------------------------------------------
// 대사 데이터베이스
// ---------------------------------------------------------------------------

type LineTag = 'hungry' | 'dirty' | 'sad' | 'sleep' | null
type PetState = { hunger: number; happiness: number; cleanliness: number; level: number }

/** 평균 스탯 */
function avg(s: PetState): number {
  return (s.hunger + s.happiness + s.cleanliness) / 3
}

interface Line {
  text: string
  condition?: (state: PetState) => boolean
  weight?: number
  tag?: LineTag
}

const LINES: Line[] = [
  // ─── 배고픔 ───
  { text: '배고파...', condition: (s) => s.hunger <= 20, weight: 3, tag: 'hungry' },
  { text: '밥 줘...', condition: (s) => s.hunger <= 15, weight: 2, tag: 'hungry' },
  { text: '뭔가 먹고 싶다', condition: (s) => s.hunger <= 30, tag: 'hungry' },
  { text: '꼬르륵~', condition: (s) => s.hunger <= 25, weight: 2, tag: 'hungry' },
  { text: '맛있는 거 없나?', condition: (s) => s.hunger <= 40, tag: 'hungry' },
  { text: '에너지 부족...', condition: (s) => s.hunger <= 20, weight: 2, tag: 'hungry' },
  { text: '전력 저하 경고!', condition: (s) => s.hunger <= 10, weight: 3, tag: 'hungry' },
  { text: '충전이 필요해', condition: (s) => s.hunger <= 35, tag: 'hungry' },
  { text: '먹어도 되는 건가...?', condition: (s) => s.hunger <= 45 && s.hunger > 30, tag: 'hungry' },
  { text: '배부르다~!', condition: (s) => s.hunger >= 90 },
  { text: '냠냠 맛있었다', condition: (s) => s.hunger >= 80 },
  { text: '에너지 충전 완료!', condition: (s) => s.hunger >= 85 },
  { text: '든든하다!', condition: (s) => s.hunger >= 75 },

  // ─── 행복 ───
  { text: '심심해...', condition: (s) => s.happiness <= 20, weight: 2, tag: 'sad' },
  { text: '놀아줘~', condition: (s) => s.happiness <= 25, weight: 2, tag: 'sad' },
  { text: '외로워...', condition: (s) => s.happiness <= 15, weight: 2, tag: 'sad' },
  { text: '나 여기 있어...', condition: (s) => s.happiness <= 20, tag: 'sad' },
  { text: '아무도 안 봐주나', condition: (s) => s.happiness <= 15, weight: 2, tag: 'sad' },
  { text: '관심 좀...', condition: (s) => s.happiness <= 30, tag: 'sad' },
  { text: '혼자인 건 싫어', condition: (s) => s.happiness <= 18, weight: 2, tag: 'sad' },
  { text: '기분 좋다~!', condition: (s) => s.happiness >= 80 },
  { text: '행복해 ♪', condition: (s) => s.happiness >= 90 },
  { text: '오늘 좋은 날!', condition: (s) => s.happiness >= 70 },
  { text: '신난다~!', condition: (s) => s.happiness >= 85 },
  { text: '세상 제일 행복해', condition: (s) => s.happiness >= 95 },
  { text: '같이 있어서 좋아', condition: (s) => s.happiness >= 70 },
  { text: '고마워!', condition: (s) => s.happiness >= 60 },

  // ─── 청결 ───
  { text: '더러워...', condition: (s) => s.cleanliness <= 20, weight: 2, tag: 'dirty' },
  { text: '씻고 싶다', condition: (s) => s.cleanliness <= 25, tag: 'dirty' },
  { text: '몸이 끈적끈적', condition: (s) => s.cleanliness <= 30, tag: 'dirty' },
  { text: '냄새 나는 건 아니지?', condition: (s) => s.cleanliness <= 35, tag: 'dirty' },
  { text: '데이터가 오염됐어', condition: (s) => s.cleanliness <= 20, tag: 'dirty' },
  { text: '바이러스 걸린 것 같아', condition: (s) => s.cleanliness <= 15, weight: 2, tag: 'dirty' },
  { text: '정크 데이터 쌓이는 중', condition: (s) => s.cleanliness <= 40, tag: 'dirty' },
  { text: '깨끗해졌다!', condition: (s) => s.cleanliness >= 90 },
  { text: '상쾌~', condition: (s) => s.cleanliness >= 80 },
  { text: '반짝반짝 빛나!', condition: (s) => s.cleanliness >= 90 },
  { text: '디스크 정리 완료!', condition: (s) => s.cleanliness >= 85 },
  { text: '깔끔한 코드 같아', condition: (s) => s.cleanliness >= 75 },

  // ─── 레벨 ───
  { text: '강해지는 느낌!', condition: (s) => s.level >= 3 && s.level <= 5 },
  { text: '성장하고 있어', condition: (s) => s.level >= 2 },
  { text: '나 좀 커진 것 같아?', condition: (s) => s.level >= 5 },
  { text: '최강 슬라임!', condition: (s) => s.level >= 8 },
  { text: '만렙이다!', condition: (s) => s.level >= 10, weight: 2 },
  { text: '경험치가 쌓인다', condition: (s) => s.level >= 2 && s.level <= 6 },
  { text: '이 힘을 다루기 어려워', condition: (s) => s.level >= 50 },
  { text: '전설의 슬라임', condition: (s) => s.level >= 100, weight: 2 },
  { text: '아직 Lv.1이다...', condition: (s) => s.level === 1 },

  // ─── 일반 (중립 — 항상 가능) ───
  { text: '...' },
  { text: '뭐 보고 있어?', weight: 2 },
  { text: '0과 1의 세계...' },
  { text: '데이터가 흐른다' },
  { text: '01001000 01101001' },
  { text: '메모리 정리 중...' },
  { text: '업데이트 확인 중' },
  { text: '나도 AI인 건가?' },
  { text: '널 포인터 무서워' },
  { text: '커피 마시고 싶다' },
  { text: '.......' },
  { text: '여긴 어디지?' },
  { text: '시간이 느리게 간다' },
  { text: '뭔가 생각 중...' },
  { text: '캐시 비우는 중' },
  { text: '슬라임 로그 기록 중' },
  { text: '세그폴트 무서워' },
  { text: 'sudo 권한 필요' },
  { text: '스택 오버플로우...' },
  { text: '무한루프 빠질 뻔' },
  { text: '가비지 컬렉션 중' },

  // ─── 일반 (긍정 — 평균 스탯 40 이상) ───
  { text: '바이너리 맛있다', condition: (s) => avg(s) >= 40 },
  { text: '여기 경치 좋다', condition: (s) => avg(s) >= 40 },
  { text: '산책 중~', condition: (s) => avg(s) >= 40 },
  { text: '작업표시줄 위가 편해', condition: (s) => avg(s) >= 40 },
  { text: '삐빅- 통신 양호', condition: (s) => avg(s) >= 40 },
  { text: '전자양 맛있겠다', condition: (s) => avg(s) >= 40 },
  { text: '하늘이 예쁘다', condition: (s) => avg(s) >= 50 },
  { text: '코딩하고 싶다', condition: (s) => avg(s) >= 40 },
  { text: '비트가 춤춘다 ♫', condition: (s) => avg(s) >= 50 },
  { text: 'ping? pong!', condition: (s) => avg(s) >= 40 },
  { text: '슬라임은 무적!', condition: (s) => avg(s) >= 60 },
  { text: '오늘 할 일이 뭐지?', condition: (s) => avg(s) >= 40 },
  { text: '간식 시간 아닌가?', condition: (s) => s.hunger <= 60 },
  { text: '콧노래가 나와~', condition: (s) => avg(s) >= 60 },
  { text: '기분 좋은 버그다!', condition: (s) => avg(s) >= 50 },
  { text: '오늘은 뭘 해볼까', condition: (s) => avg(s) >= 45 },
  { text: '픽셀이 빛나는 날', condition: (s) => avg(s) >= 50 },
  { text: '작업표시줄 탐험 중', condition: (s) => avg(s) >= 40 },
  { text: '기분 UP UP!', condition: (s) => avg(s) >= 60 },
  { text: '랄랄라~', condition: (s) => avg(s) >= 55 },
  { text: '세상이 아름다워', condition: (s) => avg(s) >= 65 },
  { text: 'Hello World!', condition: (s) => avg(s) >= 40 },
  { text: '오류 0건! 완벽!', condition: (s) => avg(s) >= 70 },
  { text: '최적화 완료!', condition: (s) => avg(s) >= 60 },
  { text: '컴파일 성공!', condition: (s) => avg(s) >= 50 },
  { text: '모든 테스트 통과!', condition: (s) => avg(s) >= 70 },

  // ─── 일반 (부정/피곤 — 낮을 때) ───
  { text: 'zzZ', weight: 2, tag: 'sleep', condition: (s) => avg(s) <= 50 },
  { text: '낮잠 자고 싶다...', tag: 'sleep', condition: (s) => avg(s) <= 40 },
  { text: '졸려...', condition: (s) => avg(s) <= 50 },
  { text: '운동해야 하는데...', condition: (s) => avg(s) <= 50 },
  { text: '버그 발견!', condition: (s) => avg(s) <= 50 },
  { text: '힘들다...', condition: (s) => avg(s) <= 30, tag: 'sad' },
  { text: '아무것도 하기 싫어', condition: (s) => avg(s) <= 25, tag: 'sad' },
  { text: '시스템 과부하...', condition: (s) => avg(s) <= 40 },
  { text: '에러 로그 쌓이는 중', condition: (s) => avg(s) <= 35 },
  { text: '리소스 부족...', condition: (s) => avg(s) <= 30, tag: 'sad' },
  { text: '절전 모드 진입할까', condition: (s) => avg(s) <= 35, tag: 'sleep' },
  { text: '응답 시간 초과...', condition: (s) => avg(s) <= 30, tag: 'sad' },
  { text: '블루스크린 뜰 것 같아', condition: (s) => avg(s) <= 20, weight: 2, tag: 'sad' },
  { text: '살려줘...', condition: (s) => avg(s) <= 15, weight: 3, tag: 'sad' },
  { text: 'off 직전이야...', condition: (s) => avg(s) <= 15, weight: 2, tag: 'sad' },
  { text: '왜 이렇게 된 거지', condition: (s) => avg(s) <= 25, tag: 'sad' },
  { text: 'printf("ㅜ\\\\tㅠ")', condition: (s) => avg(s) <= 35, tag: 'sad' },

  // ─── 복합 ───
  { text: '배고프고 더러워...', condition: (s) => s.hunger <= 25 && s.cleanliness <= 25, weight: 2, tag: 'hungry' },
  { text: '완벽한 컨디션!', condition: (s) => s.hunger >= 80 && s.happiness >= 80 && s.cleanliness >= 80, weight: 3 },
  { text: '관리 좀 해줘...', condition: (s) => avg(s) <= 30, weight: 3, tag: 'sad' },
  { text: '최고의 하루~', condition: (s) => s.happiness >= 90 && s.hunger >= 70, weight: 2 },
  { text: '배고프고 외로워...', condition: (s) => s.hunger <= 30 && s.happiness <= 30, weight: 2, tag: 'sad' },
  { text: '더럽고 슬퍼...', condition: (s) => s.cleanliness <= 25 && s.happiness <= 25, weight: 2, tag: 'dirty' },
  { text: '모든 게 엉망이야', condition: (s) => avg(s) <= 20, weight: 3, tag: 'sad' },
  { text: '나를 잊은 건 아니지?', condition: (s) => avg(s) <= 25 && s.happiness <= 20, weight: 2, tag: 'sad' },
  { text: '밥도 먹고 씻기도 했다!', condition: (s) => s.hunger >= 70 && s.cleanliness >= 70, weight: 2 },
  { text: '지금이 제일 좋아!', condition: (s) => avg(s) >= 80, weight: 2 },
  { text: '최상의 컨디션!', condition: (s) => avg(s) >= 85, weight: 2 },
]

function pickLine(state: PetState): { text: string; tag: LineTag } {
  // 조건을 만족하는 대사만 후보에 포함 (조건 없는 대사는 항상 포함)
  const pool = LINES.filter((l) => !l.condition || l.condition(state))

  const totalWeight = pool.reduce((sum, l) => sum + (l.weight ?? 1), 0)
  let roll = Math.random() * totalWeight
  for (const line of pool) {
    roll -= line.weight ?? 1
    if (roll <= 0) return { text: line.text, tag: line.tag ?? null }
  }
  const last = pool[pool.length - 1]
  return { text: last.text, tag: last.tag ?? null }
}

// ---------------------------------------------------------------------------
// SpeechBubble 컴포넌트
// ---------------------------------------------------------------------------

const SHOW_DURATION = 3000
const MIN_INTERVAL = 8000
const MAX_INTERVAL = 25000

interface SpeechBubbleProps {
  hide?: boolean
  onVisibleChange?: (visible: boolean) => void
  interactionText?: string | null
  onInteractionDone?: () => void
}

export function SpeechBubble({ hide, onVisibleChange, interactionText, onInteractionDone }: SpeechBubbleProps) {
  const [text, setText] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const busyRef = useRef(false)

  function clearTimers() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  function scheduleNext() {
    const state = usePetStore.getState()
    const avg = (state.hunger + state.happiness + state.cleanliness) / 3
    const interval = avg <= 20
      ? MIN_INTERVAL * 0.5
      : avg <= 50
        ? MIN_INTERVAL
        : MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)
    timerRef.current = window.setTimeout(showBubble, interval)
  }

  function hideBubble() {
    setText(null)
    busyRef.current = false
    onVisibleChange?.(false)
    scheduleNext()
  }

  const showBubble = useCallback(() => {
    // 이미 말풍선이 떠 있으면 건너뜀
    if (busyRef.current) {
      scheduleNext()
      return
    }

    const state = usePetStore.getState()
    const { text: line, tag } = pickLine(state)
    setText(line)
    busyRef.current = true
    onVisibleChange?.(true)

    // 배고프거나 더럽거나 슬픈 대사 → 슬픈 표정
    if (tag === 'hungry' || tag === 'dirty' || tag === 'sad') {
      window.api.triggerInteraction('sad')
    } else if (tag === 'sleep') {
      window.api.triggerInteraction('sleeping')
    }

    timerRef.current = window.setTimeout(hideBubble, SHOW_DURATION)
  }, [])

  // 상호작용 말풍선 (우선)
  useEffect(() => {
    if (!interactionText) return
    clearTimers()
    setText(interactionText)
    busyRef.current = true
    onVisibleChange?.(true)
    timerRef.current = window.setTimeout(() => {
      onInteractionDone?.()
      hideBubble()
    }, SHOW_DURATION)
  }, [interactionText])

  // 최초 1회만 시작, 이후 자체 재귀
  useEffect(() => {
    const initial = 3000 + Math.random() * 5000
    timerRef.current = window.setTimeout(showBubble, initial)
    return () => clearTimers()
  }, [showBubble])

  if (!text || hide) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 70,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(10, 5, 30, 0.9)',
      border: '1px solid rgba(120, 80, 255, 0.5)',
      borderRadius: 8,
      padding: '4px 8px',
      fontSize: 11,
      fontFamily: '"Pretendard", "맑은 고딕", monospace',
      color: 'rgba(220, 200, 255, 0.95)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      boxShadow: '0 0 8px rgba(100, 60, 255, 0.25)',
      animation: 'bubble-in 0.2s ease-out',
    }}>
      {text}
      <div style={{
        position: 'absolute',
        bottom: -6,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '6px solid rgba(10, 5, 30, 0.9)',
      }} />
    </div>
  )
}
