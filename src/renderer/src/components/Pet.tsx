import { useEffect, useState, useRef, useCallback } from 'react'
import { usePetAnimation } from '../hooks/usePetAnimation'
import { usePetStore } from '../store/petStore'
import { useStateTick } from '../engine/stateTick'
import { BinaryParticles } from './BinaryParticles'
import { DirtOverlay } from './DirtOverlay'
import { SpeechBubble } from './SpeechBubble'
import type { MovementMode } from '../types/pet'

import idleSprite  from '../assets/sprites/chr_idle.png'
import jumpSprite  from '../assets/sprites/chr_jump.png'
import grabSprite  from '../assets/sprites/chr_grab.png'
import fallSprite  from '../assets/sprites/chr_fall.png'
import landSprite  from '../assets/sprites/chr_land.png'
import petSprite   from '../assets/sprites/chr_pet.png'
import eatSprite   from '../assets/sprites/chr_eat.png'
import sadSprite   from '../assets/sprites/chr_sad.png'
import happySprite from '../assets/sprites/chr_happy.png'

interface SpriteConfig {
  sprite: string
  backgroundSize: string
  animation: string
}

const SPRITE_CONFIG: Record<MovementMode, SpriteConfig> = {
  idle:     { sprite: idleSprite,   backgroundSize: '256px 64px', animation: 'sprite-idle 0.6s steps(4) infinite' },
  walking:  { sprite: idleSprite,   backgroundSize: '256px 64px', animation: 'sprite-idle 0.6s steps(4) infinite' },
  jumping:  { sprite: jumpSprite,   backgroundSize: '384px 64px', animation: 'sprite-jump 0.83s steps(6) 1 forwards' },
  dragging: { sprite: grabSprite,   backgroundSize: '128px 64px', animation: 'none' },
  falling:  { sprite: fallSprite,   backgroundSize: '192px 64px', animation: 'sprite-fall 0.5s steps(3) infinite' },
  landing:  { sprite: landSprite,   backgroundSize: '256px 64px', animation: 'sprite-land 0.4s steps(4) 1 forwards' },
  petting:  { sprite: petSprite,    backgroundSize: '256px 64px', animation: 'sprite-pet 1.2s steps(4) 1 forwards' },
  eating:   { sprite: eatSprite,    backgroundSize: '384px 64px', animation: 'sprite-eat 2.4s steps(5) 1 forwards' },
  sad:      { sprite: sadSprite,    backgroundSize: '256px 64px', animation: 'sprite-sad 1.6s steps(4) infinite' },
  happy:    { sprite: happySprite,  backgroundSize: '256px 64px', animation: 'sprite-happy 0.8s steps(4) infinite' },
}

const NON_LOOPING_MODES = new Set<MovementMode>([
  'jumping', 'dragging', 'landing', 'petting', 'eating',
])

// 스프라이트 위치 (160px 윈도우 내 중앙)
const SPRITE_LEFT = 48

function Pet() {
  const { mode, direction } = usePetAnimation()
  useStateTick()

  const { hunger, happiness, cleanliness, level, feed, pet: petAction, clean, getMoodModifier, getExpProgress } = usePetStore()

  // mood modifier
  useEffect(() => {
    window.api.sendMoodModifier(getMoodModifier())
  }, [hunger, happiness, cleanliness, getMoodModifier])

  // clean IPC
  useEffect(() => window.api.onClean(() => clean()), [clean])

  // 모드 카운터
  const [modeChangeCounter, setModeChangeCounter] = useState(0)
  const prevModeRef = useRef<MovementMode>(mode)
  useEffect(() => {
    if (mode !== prevModeRef.current) {
      setModeChangeCounter((c) => c + 1)
      prevModeRef.current = mode
    }
  }, [mode])

  // Squash
  const [isSquashing, setIsSquashing] = useState(false)
  const squashTimeoutRef = useRef<number | null>(null)

  // 상태 바 (hover)
  const [showStats, setShowStats] = useState(false)

  // hover 진입 시 인터랙티브
  const handleSpriteEnter = useCallback(() => {
    setShowStats(true)
    window.api.setClickThrough(false)
  }, [])

  // hover 이탈 시 클릭 통과
  const handleSpriteLeave = useCallback(() => {
    setShowStats(false)
    window.api.setClickThrough(true)
  }, [])

  // 드래그
  const isDraggingRef = useRef(false)
  const didDragRef = useRef(false)
  const dragStartPos = useRef({ x: 0, y: 0 })

  // 쓰다듬기
  const strokeCountRef = useRef(0)
  const lastStrokeDirRef = useRef<'left' | 'right' | null>(null)
  const lastMouseXRef = useRef(0)
  const strokeResetTimerRef = useRef<number | null>(null)
  const petCooldownRef = useRef(false)

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (isDraggingRef.current && !didDragRef.current) {
        const dx = e.screenX - dragStartPos.current.x
        const dy = e.screenY - dragStartPos.current.y
        if (Math.abs(dx) >= 3 || Math.abs(dy) >= 3) {
          didDragRef.current = true
          window.api.dragStart()
        }
        return
      }
      if (isDraggingRef.current) return

      // 쓰다듬기
      const moveDelta = e.clientX - lastMouseXRef.current
      lastMouseXRef.current = e.clientX
      if (Math.abs(moveDelta) < 2) return
      const dir = moveDelta > 0 ? 'right' : 'left'
      if (lastStrokeDirRef.current && dir !== lastStrokeDirRef.current) {
        strokeCountRef.current++
        if (strokeCountRef.current >= 3 && !petCooldownRef.current) {
          strokeCountRef.current = 0
          petAction()
          window.api.triggerInteraction('petting')
          petCooldownRef.current = true
          setTimeout(() => { petCooldownRef.current = false }, 2000)
        }
      }
      lastStrokeDirRef.current = dir
      if (strokeResetTimerRef.current) clearTimeout(strokeResetTimerRef.current)
      strokeResetTimerRef.current = window.setTimeout(() => {
        strokeCountRef.current = 0
        lastStrokeDirRef.current = null
      }, 1000)
    }

    function handleMouseUp() {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      if (didDragRef.current) window.api.dragEnd()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [petAction])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    didDragRef.current = false
    dragStartPos.current = { x: e.screenX, y: e.screenY }
  }, [])

  const handleClick = useCallback(() => {
    if (didDragRef.current) { didDragRef.current = false; return }
    if (mode === 'dragging' || mode === 'falling' || mode === 'landing') return
    if (mode === 'petting' || mode === 'eating') return
    setIsSquashing(true)
    if (squashTimeoutRef.current) clearTimeout(squashTimeoutRef.current)
    squashTimeoutRef.current = window.setTimeout(() => setIsSquashing(false), 400)
  }, [mode])

  const handleDoubleClick = useCallback(() => window.api.forceJump(), [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    window.api.showContextMenu()
  }, [])

  const config = SPRITE_CONFIG[mode]
  const spriteKey = NON_LOOPING_MODES.has(mode) ? `${mode}-${modeChangeCounter}` : mode
  const flipTransform = direction === 'left' ? 'scaleX(-1)' : undefined

  return (
    <>
      {/* 상태 바 (hover 시) — 윈도우 확장 영역에 표시 */}
      {showStats && (
        <div style={{
          position: 'absolute',
          top: 4,
          left: 8, right: 8,
          background: 'rgba(10, 5, 30, 0.85)',
          border: '1px solid rgba(120, 80, 255, 0.4)',
          borderRadius: 4,
          padding: '3px 6px',
          fontSize: 8,
          fontFamily: 'monospace',
          color: 'rgba(200, 180, 255, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pointerEvents: 'none',
        }}>
          <div style={{ textAlign: 'center', fontSize: 9, color: '#c4b5fd' }}>Lv.{level}</div>
          <StatBar label="EXP" value={getExpProgress().percent} color="#a78bfa" />
          <StatBar label="배고픔" value={hunger} color="#ff6b6b" />
          <StatBar label="행복" value={happiness} color="#ffd93d" />
          <StatBar label="청결" value={cleanliness} color="#6bcb77" />
        </div>
      )}

      {/* 말풍선 */}
      <SpeechBubble />

      {/* 먼지 오버레이 */}
      <DirtOverlay cleanliness={cleanliness} />

      {/* 스프라이트 */}
      <div
        key={spriteKey}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleSpriteEnter}
        onMouseLeave={handleSpriteLeave}
        style={{
          width: 64,
          height: 64,
          backgroundImage: `url(${config.sprite})`,
          backgroundSize: config.backgroundSize,
          backgroundPosition: mode === 'dragging' ? '-64px 0' : '0 0',
          imageRendering: 'pixelated',
          position: 'absolute',
          bottom: 0,
          left: SPRITE_LEFT,
          animation: isSquashing ? 'squash 0.4s ease-out' : config.animation,
          transform: flipTransform,
          cursor: mode === 'dragging' ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      />

      {/* 이진수 분비물 */}
      <BinaryParticles cleanliness={cleanliness} />
    </>
  )
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <span style={{ width: 28, fontSize: 7 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ width: 16, textAlign: 'right', fontSize: 7 }}>{Math.round(value)}</span>
    </div>
  )
}

export default Pet
