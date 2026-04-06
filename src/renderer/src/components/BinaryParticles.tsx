import { useEffect, useRef, useState } from 'react'

interface Particle {
  id: number
  char: '0' | '1'
  x: number
  drift: number
  born: number
}

interface DropParticle {
  id: number
  char: '0' | '1'
  x: number
  startBottom: number
  born: number
}

let nextId = 0

export function BinaryParticles({ cleanliness, shakeCount }: { cleanliness: number; shakeCount: number }) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [dropParticles, setDropParticles] = useState<DropParticle[]>([])
  const cleanRef = useRef(cleanliness)
  cleanRef.current = cleanliness

  // 흔들기 → 기존 파티클을 떨어뜨림
  const prevShakeRef = useRef(shakeCount)
  useEffect(() => {
    if (shakeCount > prevShakeRef.current) {
      setParticles((prev) => {
        const now = Date.now()
        const drops: DropParticle[] = prev.map((p) => ({
          id: nextId++,
          char: p.char,
          x: p.x,
          startBottom: 55 + Math.random() * 10,
          born: now,
        }))
        setDropParticles((d) => [...d, ...drops])
        return []
      })
      setTimeout(() => {
        setDropParticles((d) => d.filter((p) => Date.now() - p.born < 1500))
      }, 1600)
    }
    prevShakeRef.current = shakeCount
  }, [shakeCount])

  useEffect(() => {
    let running = true

    function getInterval(): number {
      const c = cleanRef.current
      if (c > 50) return -1
      if (c <= 10) return 800
      if (c <= 25) return 2000
      return 4000
    }

    function spawn() {
      if (!running) return
      const interval = getInterval()
      if (interval < 0) {
        setTimeout(spawn, 3000)
        return
      }

      setParticles((prev) => {
        const now = Date.now()
        const alive = prev.filter((p) => now - p.born < 8000)
        const limited = alive.length >= 12 ? alive.slice(1) : alive
        return [...limited, {
          id: nextId++,
          char: Math.random() < 0.5 ? '0' : '1',
          x: 44 + Math.random() * 72,
          drift: Math.random() < 0.5 ? -1 : 1,
          born: now,
        }]
      })

      setTimeout(spawn, interval)
    }

    setTimeout(spawn, 500)
    return () => { running = false }
  }, [])

  if (cleanRef.current > 50 && dropParticles.length === 0) return null

  return (
    <>
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            bottom: -2,
            left: p.x,
            fontSize: 9,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#7fff7f',
            pointerEvents: 'none',
            animation: `binary-roll-${p.drift > 0 ? 'r' : 'l'} 8s linear forwards`,
            textShadow: '0 0 3px rgba(127, 255, 127, 0.4)',
          }}
        >
          {p.char}
        </span>
      ))}

      {dropParticles.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            bottom: p.startBottom,
            left: p.x,
            fontSize: 9,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#7fff7f',
            pointerEvents: 'none',
            animation: 'binary-drop 1.2s ease-in forwards',
            textShadow: '0 0 3px rgba(127, 255, 127, 0.4)',
          }}
        >
          {p.char}
        </span>
      ))}
    </>
  )
}
