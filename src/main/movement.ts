import { BrowserWindow, screen } from 'electron'
import {
  sendMovementUpdate,
  setForceJumpCallback,
  setDragStartCallback,
  setDragEndCallback,
  setTriggerInteractionCallback,
  setMoodModifierCallback,
  type MoodModifier,
} from './ipc'

type Mode =
  | 'idle'
  | 'walking'
  | 'jumping'
  | 'dragging'
  | 'falling'
  | 'landing'
  | 'petting'
  | 'eating'
  | 'sad'
  | 'happy'
type Direction = 'left' | 'right'

const FRAME_INTERVAL = 1000 / 30
const WINDOW_WIDTH = 160
const WINDOW_HEIGHT = 256

const LANDING_FRAMES = 12
const PETTING_FRAMES = 36 // 1.2s at 30fps — CSS 애니메이션과 일치
const EATING_FRAMES = 72
const SAD_FRAMES = 120    // 4초
const HAPPY_FRAMES = 90   // 3초

export function startMovementEngine(win: BrowserWindow): void {
  // 전체 모니터 결합 X 경계 계산
  function calcXBounds() {
    const displays = screen.getAllDisplays()
    let minX = Infinity, maxX = -Infinity
    for (const d of displays) {
      const wa = d.workArea
      if (wa.x < minX) minX = wa.x
      if (wa.x + wa.width > maxX) maxX = wa.x + wa.width
    }
    return { minX, maxX }
  }

  let bounds = calcXBounds()
  let currentWorkArea = screen.getPrimaryDisplay().workArea
  let anchorY = currentWorkArea.y + currentWorkArea.height - WINDOW_HEIGHT

  let x = currentWorkArea.x + currentWorkArea.width / 2 - WINDOW_WIDTH / 2
  let y = anchorY
  let vy = 0

  /** 현재 윈도우 위치 기준으로 해당 모니터의 anchorY 재계산 (드래그 후 낙하용) */
  function recalcDisplay(): void {
    const pos = win.getPosition()
    const display = screen.getDisplayNearestPoint({ x: pos[0] + WINDOW_WIDTH / 2, y: pos[1] })
    currentWorkArea = display.workArea
    anchorY = currentWorkArea.y + currentWorkArea.height - WINDOW_HEIGHT
    bounds = calcXBounds()
  }

  let mode: Mode = 'idle'
  let direction: Direction = 'right'
  let stateTimer = randomInt(60, 240)
  let speed = 0

  let jumpSpeed = 0
  let preJumpMode: 'idle' | 'walking' = 'idle'
  let preInteractionMode: 'idle' | 'walking' = 'idle'

  // mood modifier (렌더러에서 주기적으로 갱신)
  let mood: MoodModifier = { speedMultiplier: 1, jumpChance: 0.15, idleMultiplier: 1 }

  function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function enterIdle(): void {
    mode = 'idle'
    const base = randomInt(60, 240)
    stateTimer = Math.round(base * mood.idleMultiplier)
  }

  function enterWalking(): void {
    mode = 'walking'
    direction = Math.random() < 0.5 ? 'left' : 'right'
    speed = (0.5 + Math.random() * 1.5) * mood.speedMultiplier
    stateTimer = randomInt(90, 300)
  }

  function enterJumping(): void {
    preJumpMode = mode === 'walking' ? 'walking' : 'idle'
    jumpSpeed = mode === 'walking' ? speed : 0
    mode = 'jumping'
    vy = -5.5
  }

  // 드래그: 메인 프로세스에서 마우스 좌표 직접 폴링 (IPC 왕복 없음)
  let dragOffsetX = 0
  let dragOffsetY = 0

  function enterDragging(): void {
    mode = 'dragging'
    const cursor = screen.getCursorScreenPoint()
    const pos = win.getPosition()
    dragOffsetX = cursor.x - pos[0]
    dragOffsetY = cursor.y - pos[1]
  }

  function enterFalling(): void {
    const pos = win.getPosition()
    x = pos[0]
    y = pos[1]
    vy = 0
    mode = 'falling'
    recalcDisplay()
  }

  function enterLanding(): void {
    mode = 'landing'
    stateTimer = LANDING_FRAMES
    y = anchorY
  }

  function enterPetting(): void {
    if (mode === 'dragging' || mode === 'falling' || mode === 'landing') return
    preInteractionMode = mode === 'walking' ? 'walking' : 'idle'
    mode = 'petting'
    stateTimer = PETTING_FRAMES
  }

  function enterEating(): void {
    if (mode === 'dragging' || mode === 'falling' || mode === 'landing') return
    preInteractionMode = 'idle'
    mode = 'eating'
    stateTimer = EATING_FRAMES
  }

  function enterSad(): void {
    if (mode === 'dragging' || mode === 'falling' || mode === 'landing') return
    if (mode === 'sad') return
    mode = 'sad'
    stateTimer = SAD_FRAMES
  }

  function enterHappy(): void {
    if (mode === 'dragging' || mode === 'falling' || mode === 'landing') return
    if (mode === 'happy') return
    mode = 'happy'
    stateTimer = HAPPY_FRAMES
  }

  function clampX(): void {
    if (x < bounds.minX) {
      x = bounds.minX
      direction = 'right'
    } else if (x > bounds.maxX - WINDOW_WIDTH) {
      x = bounds.maxX - WINDOW_WIDTH
      direction = 'left'
    }
  }

  /** 걷기 중 모니터 경계를 넘으면 해당 모니터의 anchorY로 갱신 */
  function updateAnchorForPosition(): void {
    const display = screen.getDisplayNearestPoint({ x: Math.round(x) + WINDOW_WIDTH / 2, y: Math.round(y) })
    const wa = display.workArea
    anchorY = wa.y + wa.height - WINDOW_HEIGHT
  }

  function tick(): void {
    if (win.isDestroyed()) return

    switch (mode) {
      case 'idle': {
        y = anchorY
        stateTimer--
        if (stateTimer <= 0) {
          if (Math.random() < mood.jumpChance) {
            enterJumping()
          } else {
            enterWalking()
          }
        }
        break
      }

      case 'walking': {
        const dx = direction === 'right' ? speed : -speed
        x += dx
        updateAnchorForPosition()
        y = anchorY

        if (x < bounds.minX) {
          x = bounds.minX
          if (Math.random() < 0.5) direction = 'right'
          else { enterIdle(); break }
        } else if (x > bounds.maxX - WINDOW_WIDTH) {
          x = bounds.maxX - WINDOW_WIDTH
          if (Math.random() < 0.5) direction = 'left'
          else { enterIdle(); break }
        }

        if (Math.random() < 0.003 && mood.jumpChance > 0) {
          enterJumping()
          break
        }

        stateTimer--
        if (stateTimer <= 0) enterIdle()
        break
      }

      case 'jumping': {
        if (jumpSpeed > 0) {
          const dx = direction === 'right' ? jumpSpeed : -jumpSpeed
          x += dx
          clampX()
        }
        vy += 0.45
        y += vy
        if (y >= anchorY) {
          y = anchorY
          vy = 0
          if (preJumpMode === 'walking') {
            mode = 'walking'
            stateTimer = randomInt(60, 180)
          } else enterIdle()
        }
        break
      }

      case 'dragging': {
        const cursor = screen.getCursorScreenPoint()
        x = cursor.x - dragOffsetX
        y = cursor.y - dragOffsetY
        win.setPosition(Math.round(x), Math.round(y), false)
        sendMovementUpdate(win, { x, y, mode, direction })
        return
      }

      case 'falling': {
        vy += 0.8
        y += vy
        if (y >= anchorY) enterLanding()
        break
      }

      case 'landing': {
        y = anchorY
        stateTimer--
        if (stateTimer <= 0) enterIdle()
        break
      }

      case 'petting': {
        y = anchorY
        stateTimer--
        if (stateTimer <= 0) {
          if (preInteractionMode === 'walking') enterWalking()
          else enterIdle()
        }
        break
      }

      case 'eating': {
        y = anchorY
        stateTimer--
        if (stateTimer <= 0) enterIdle()
        break
      }

      case 'sad':
      case 'happy': {
        y = anchorY
        stateTimer--
        if (stateTimer <= 0) enterIdle()
        break
      }
    }

    win.setPosition(Math.round(x), Math.round(y), false)
    sendMovementUpdate(win, { x, y, mode, direction })
  }

  // ─── 콜백 등록 ───

  setForceJumpCallback(() => {
    if (mode !== 'jumping' && mode !== 'dragging' && mode !== 'falling') enterJumping()
  })

  setDragStartCallback(() => enterDragging())

  setDragEndCallback(() => { if (mode === 'dragging') enterFalling() })

  setTriggerInteractionCallback((type) => {
    if (type === 'petting') enterPetting()
    else if (type === 'eating') enterEating()
  })

  setMoodModifierCallback((mod) => {
    mood = mod
    if (mod.speedMultiplier <= 0.5 && mode === 'idle') enterSad()
  })

  const timer = setInterval(tick, FRAME_INTERVAL)
  win.on('closed', () => clearInterval(timer))
}
