import { useEffect, useState, useRef, useCallback } from 'react'
import { usePetAnimation } from '../hooks/usePetAnimation'
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

// ---------------------------------------------------------------------------
// Sprite configuration
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Pet component
// ---------------------------------------------------------------------------

function Pet() {
  const { mode, direction } = usePetAnimation()

  const [modeChangeCounter, setModeChangeCounter] = useState(0)
  const prevModeRef = useRef<MovementMode>(mode)

  useEffect(() => {
    if (mode !== prevModeRef.current) {
      setModeChangeCounter((c) => c + 1)
      prevModeRef.current = mode
    }
  }, [mode])

  // Squash & Stretch
  const [isSquashing, setIsSquashing] = useState(false)
  const squashTimeoutRef = useRef<number | null>(null)

  // Context menu
  const [showMenu, setShowMenu] = useState(false)

  // Manual drag state
  const isDraggingRef = useRef(false)
  const didDragRef = useRef(false) // 실제 이동이 있었는지 (click 억제용)
  const dragStartPos = useRef({ x: 0, y: 0 })

  // Document-level mousemove/mouseup for drag
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return
      const dx = e.screenX - dragStartPos.current.x
      const dy = e.screenY - dragStartPos.current.y

      // 최소 3px 이동해야 드래그로 인식 (클릭과 구분)
      if (!didDragRef.current) {
        const totalDx = Math.abs(dx)
        const totalDy = Math.abs(dy)
        if (totalDx < 3 && totalDy < 3) return
        didDragRef.current = true
        window.api.dragStart() // 실제 드래그 시작
      }

      dragStartPos.current = { x: e.screenX, y: e.screenY }
      window.api.dragMove(dx, dy)
    }

    function handleMouseUp() {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      if (didDragRef.current) {
        window.api.dragEnd() // 실제 드래그한 경우만 낙하
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // 좌클릭만
    isDraggingRef.current = true
    didDragRef.current = false
    dragStartPos.current = { x: e.screenX, y: e.screenY }
    setShowMenu(false)
    // 아직 dragStart를 보내지 않음 — mousemove에서 실제 이동 시 전송
  }, [])

  const handleClick = useCallback(() => {
    // 드래그 후 click 이벤트 억제
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    if (mode === 'dragging' || mode === 'falling' || mode === 'landing') return
    if (mode === 'petting' || mode === 'eating') return

    setIsSquashing(true)
    if (squashTimeoutRef.current) clearTimeout(squashTimeoutRef.current)
    squashTimeoutRef.current = window.setTimeout(() => {
      setIsSquashing(false)
    }, 400)
  }, [mode])

  const handleDoubleClick = useCallback(() => {
    setShowMenu(false)
    window.api.forceJump()
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowMenu((prev) => !prev)
  }, [])

  const handleFeed = useCallback(() => {
    window.api.triggerInteraction('eating')
    setShowMenu(false)
  }, [])

  const handlePet = useCallback(() => {
    window.api.triggerInteraction('petting')
    setShowMenu(false)
  }, [])

  const handleQuit = useCallback(() => {
    window.api.quitApp()
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const config = SPRITE_CONFIG[mode]

  const spriteKey = NON_LOOPING_MODES.has(mode)
    ? `${mode}-${modeChangeCounter}`
    : mode

  const flipTransform = direction === 'left' ? 'scaleX(-1)' : undefined

  // 드래그 중이거나 관련 모드일 때 커서 변경
  const cursor = mode === 'dragging' ? 'grabbing' : 'grab'

  return (
    <>
      <div
        key={spriteKey}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{
          width: 64,
          height: 64,
          backgroundImage: `url(${config.sprite})`,
          backgroundSize: config.backgroundSize,
          backgroundPosition: mode === 'dragging' ? '-64px 0' : '0 0',
          imageRendering: 'pixelated',
          position: 'absolute',
          bottom: 0,
          left: 32,
          animation: isSquashing ? 'squash 0.4s ease-out' : config.animation,
          transform: flipTransform,
          cursor,
          userSelect: 'none',
        }}
      />

      {showMenu && (
        <>
        {/* 메뉴 외부 클릭 캡처용 오버레이 (거의 투명하지만 클릭 잡음) */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.01)',
          }}
          onClick={() => setShowMenu(false)}
          onContextMenu={(e) => { e.preventDefault(); setShowMenu(false) }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 68,
            left: 16,
            background: 'rgba(20, 10, 40, 0.9)',
            border: '1px solid rgba(120, 80, 255, 0.5)',
            borderRadius: 6,
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 96,
            boxShadow: '0 0 12px rgba(100, 60, 255, 0.3)',
            userSelect: 'none',
          }}
        >
          <MenuButton label="Feed"  onClick={handleFeed} />
          <MenuButton label="Pet"   onClick={handlePet} />
          <MenuButton label="Clean" disabled onClick={() => setShowMenu(false)} />
          <div style={{ height: 1, background: 'rgba(120, 80, 255, 0.3)', margin: '2px 0' }} />
          <MenuButton label="Quit"  onClick={handleQuit} />
        </div>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// MenuButton
// ---------------------------------------------------------------------------

function MenuButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: disabled ? 'rgba(150, 130, 200, 0.4)' : 'rgba(200, 180, 255, 0.9)',
        fontSize: 12,
        fontFamily: 'monospace',
        padding: '4px 8px',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        borderRadius: 3,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'rgba(120, 80, 255, 0.2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {label}
    </button>
  )
}

export default Pet
