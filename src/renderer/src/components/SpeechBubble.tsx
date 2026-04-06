import { useEffect, useState, useRef, useCallback } from 'react'
import { usePetStore } from '../store/petStore'

// ---------------------------------------------------------------------------
// 대사 데이터베이스
// ---------------------------------------------------------------------------

interface Line {
  text: string
  condition?: (state: { hunger: number; happiness: number; cleanliness: number; level: number }) => boolean
  weight?: number
}

const LINES: Line[] = [
  // ─── 배고픔 ───
  { text: '배고파...', condition: (s) => s.hunger <= 20, weight: 3 },
  { text: '밥 줘...', condition: (s) => s.hunger <= 15, weight: 2 },
  { text: '뭔가 먹고 싶다', condition: (s) => s.hunger <= 30 },
  { text: '꼬르륵~', condition: (s) => s.hunger <= 25, weight: 2 },
  { text: '맛있는 거 없나?', condition: (s) => s.hunger <= 40 },
  { text: '배부르다~!', condition: (s) => s.hunger >= 90 },
  { text: '냠냠 맛있었다', condition: (s) => s.hunger >= 80 },

  // ─── 행복 ───
  { text: '심심해...', condition: (s) => s.happiness <= 20, weight: 2 },
  { text: '놀아줘~', condition: (s) => s.happiness <= 25, weight: 2 },
  { text: '외로워...', condition: (s) => s.happiness <= 15, weight: 2 },
  { text: '기분 좋다~!', condition: (s) => s.happiness >= 80 },
  { text: '행복해 ♪', condition: (s) => s.happiness >= 90 },
  { text: '오늘 좋은 날!', condition: (s) => s.happiness >= 70 },

  // ─── 청결 ───
  { text: '더러워...', condition: (s) => s.cleanliness <= 20, weight: 2 },
  { text: '씻고 싶다', condition: (s) => s.cleanliness <= 25 },
  { text: '몸이 끈적끈적', condition: (s) => s.cleanliness <= 30 },
  { text: '깨끗해졌다!', condition: (s) => s.cleanliness >= 90 },
  { text: '상쾌~', condition: (s) => s.cleanliness >= 80 },

  // ─── 레벨 ───
  { text: '강해지는 느낌!', condition: (s) => s.level >= 3 && s.level <= 5 },
  { text: '성장하고 있어', condition: (s) => s.level >= 2 },
  { text: '나 좀 커진 것 같아?', condition: (s) => s.level >= 5 },
  { text: '최강 슬라임!', condition: (s) => s.level >= 8 },
  { text: '만렙이다!', condition: (s) => s.level >= 10, weight: 2 },

  // ─── 일반 ───
  { text: '...' },
  { text: 'zzZ', weight: 2 },
  { text: '뭐 보고 있어?', weight: 2 },
  { text: '0과 1의 세계...' },
  { text: '데이터가 흐른다' },
  { text: '바이너리 맛있다' },
  { text: '여기 경치 좋다' },
  { text: '산책 중~' },
  { text: '오늘 할 일이 뭐지?' },
  { text: '작업표시줄 위가 편해' },
  { text: '삐빅- 통신 양호' },
  { text: '전자양 맛있겠다' },
  { text: '하늘이 예쁘다' },
  { text: '운동해야 하는데...' },
  { text: '간식 시간 아닌가?' },
  { text: '코딩하고 싶다' },
  { text: '01001000 01101001' },
  { text: '버그 발견!' },
  { text: '커피 마시고 싶다' },
  { text: '낮잠 자고 싶다...' },
  { text: '비트가 춤춘다 ♫' },
  { text: 'ping? pong!' },
  { text: '메모리 정리 중...' },
  { text: '업데이트 확인 중' },
  { text: '나도 AI인 건가?' },
  { text: '널 포인터 무서워' },
  { text: '슬라임은 무적!' },

  // ─── 복합 ───
  { text: '배고프고 더러워...', condition: (s) => s.hunger <= 25 && s.cleanliness <= 25, weight: 2 },
  { text: '완벽한 컨디션!', condition: (s) => s.hunger >= 80 && s.happiness >= 80 && s.cleanliness >= 80, weight: 3 },
  { text: '관리 좀 해줘...', condition: (s) => (s.hunger + s.happiness + s.cleanliness) / 3 <= 30, weight: 3 },
  { text: '최고의 하루~', condition: (s) => s.happiness >= 90 && s.hunger >= 70, weight: 2 },
]

function pickLine(state: { hunger: number; happiness: number; cleanliness: number; level: number }): string {
  // 조건부 대사와 일반 대사 분리
  const conditionLines = LINES.filter((l) => l.condition && l.condition(state))
  const generalLines = LINES.filter((l) => !l.condition)

  // 조건부 대사가 있으면 70% 확률로 조건부 대사 선택
  const pool = conditionLines.length > 0 && Math.random() < 0.7
    ? conditionLines
    : generalLines

  const totalWeight = pool.reduce((sum, l) => sum + (l.weight ?? 1), 0)
  let roll = Math.random() * totalWeight
  for (const line of pool) {
    roll -= line.weight ?? 1
    if (roll <= 0) return line.text
  }
  return pool[pool.length - 1].text
}

// ---------------------------------------------------------------------------
// SpeechBubble 컴포넌트
// ---------------------------------------------------------------------------

const SHOW_DURATION = 3000
const MIN_INTERVAL = 8000
const MAX_INTERVAL = 25000

export function SpeechBubble() {
  const [text, setText] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const showBubble = useCallback(() => {
    const state = usePetStore.getState()
    const avg = (state.hunger + state.happiness + state.cleanliness) / 3
    const line = pickLine(state)
    setText(line)

    // 표시 후 숨기기
    timerRef.current = window.setTimeout(() => {
      setText(null)

      // 다음 말풍선 예약
      const interval = avg <= 20
        ? MIN_INTERVAL * 0.5
        : avg <= 50
          ? MIN_INTERVAL
          : MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)

      timerRef.current = window.setTimeout(showBubble, interval)
    }, SHOW_DURATION)
  }, [])

  // 최초 1회만 시작, 이후 자체 재귀
  useEffect(() => {
    const initial = 3000 + Math.random() * 5000
    timerRef.current = window.setTimeout(showBubble, initial)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [showBubble])

  if (!text) return null

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
