import { useEffect, useRef, useState } from 'react'

interface Props {
  level: number
}

interface Burst {
  id: number
  level: number
}

/**
 * 레벨업 시 재생되는 일회성 이펙트.
 * - 확장되는 홀로그래픽 링
 * - "LEVEL UP" 텍스트
 * - 방사형 파티클
 */
export function LevelUpEffect({ level }: Props) {
  const prevLevelRef = useRef(level)
  const idRef = useRef(0)
  const [bursts, setBursts] = useState<Burst[]>([])

  useEffect(() => {
    if (level > prevLevelRef.current) {
      const id = ++idRef.current
      const burst: Burst = { id, level }
      setBursts((b) => [...b, burst])
      window.setTimeout(() => {
        setBursts((b) => b.filter((x) => x.id !== id))
      }, 2000)
    }
    prevLevelRef.current = level
  }, [level])

  if (bursts.length === 0) return null

  return (
    <>
      {bursts.map((b) => (
        <div
          key={b.id}
          style={{
            position: 'absolute',
            left: 80,
            bottom: 32,
            width: 0,
            height: 0,
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          {/* 확장 링 1 */}
          <div
            style={{
              position: 'absolute',
              left: -40,
              top: -40,
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: '2px solid rgba(167, 139, 250, 0.9)',
              boxShadow: '0 0 12px rgba(167, 139, 250, 0.8), inset 0 0 8px rgba(167, 139, 250, 0.5)',
              animation: 'levelup-ring 1.4s ease-out forwards',
            }}
          />
          {/* 확장 링 2 */}
          <div
            style={{
              position: 'absolute',
              left: -30,
              top: -30,
              width: 60,
              height: 60,
              borderRadius: '50%',
              border: '1px solid rgba(244, 182, 255, 0.8)',
              boxShadow: '0 0 10px rgba(244, 182, 255, 0.7)',
              animation: 'levelup-ring 1.6s 0.15s ease-out forwards',
            }}
          />

          {/* 방사형 파티클 */}
          {Array.from({ length: 10 }).map((_, i) => {
            const angle = (i / 10) * Math.PI * 2
            const dx = Math.cos(angle) * 42
            const dy = Math.sin(angle) * 42
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: -2,
                  top: -2,
                  width: 4,
                  height: 4,
                  background: i % 2 === 0 ? '#c4b5fd' : '#fde68a',
                  boxShadow: '0 0 6px currentColor',
                  color: i % 2 === 0 ? '#c4b5fd' : '#fde68a',
                  borderRadius: '50%',
                  // @ts-expect-error custom props for keyframes
                  '--dx': `${dx}px`,
                  '--dy': `${dy}px`,
                  animation: 'levelup-particle 1.2s ease-out forwards',
                }}
              />
            )
          })}

          {/* LEVEL UP 텍스트 */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: -62,
              transform: 'translateX(-50%)',
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: 'bold',
              color: '#fde68a',
              textShadow: '0 0 6px #a78bfa, 0 0 10px #a78bfa, 0 0 2px #fff',
              whiteSpace: 'nowrap',
              letterSpacing: 1,
              animation: 'levelup-text 1.8s ease-out forwards',
            }}
          >
            LEVEL UP ▲ Lv.{b.level}
          </div>
        </div>
      ))}
    </>
  )
}
