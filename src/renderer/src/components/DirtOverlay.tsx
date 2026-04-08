import { useMemo } from 'react'

/**
 * 청결도가 낮을수록 슬라임 위에 먼지 점들이 점점 많이 붙는 오버레이.
 * 청결도 50 이하부터 시작, 0에 가까울수록 먼지가 많아짐.
 */
export function DirtOverlay({ cleanliness }: { cleanliness: number }) {
  const dots = useMemo(() => {
    if (cleanliness > 50) return []

    // 청결도 50→0 에 따라 먼지 개수 2→12개
    const count = Math.round(2 + ((50 - cleanliness) / 50) * 10)
    const result: { x: number; y: number; size: number; opacity: number }[] = []

    // 시드 기반 고정 위치 (매 렌더마다 바뀌지 않도록)
    for (let i = 0; i < count; i++) {
      const seed = (i * 7 + 13) % 100
      result.push({
        x: 8 + (seed * 0.48),         // 8~56px (슬라임 영역 내)
        y: 8 + ((seed * 3 + 17) % 48), // 8~56px
        size: 2 + (i % 3),             // 2~4px
        opacity: 0.3 + ((50 - cleanliness) / 50) * 0.4, // 0.3~0.7
      })
    }
    return result
  }, [cleanliness])

  if (dots.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 48,
      width: 64,
      height: 64,
      pointerEvents: 'none',
    }}>
      {dots.map((dot, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: dot.x,
            bottom: dot.y,
            width: dot.size,
            height: dot.size,
            borderRadius: '50%',
            background: `rgba(100, 80, 60, ${dot.opacity})`,
            boxShadow: `0 0 2px rgba(80, 60, 40, ${dot.opacity * 0.5})`,
          }}
        />
      ))}
    </div>
  )
}
