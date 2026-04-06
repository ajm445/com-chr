import { BrowserWindow, screen } from 'electron'
import {
  sendMovementUpdate,
  setForceJumpCallback,
  setDragStartCallback,
  setDragMoveCallback,
  setDragEndCallback,
  setTriggerInteractionCallback,
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
const WINDOW_WIDTH = 128
const WINDOW_HEIGHT = 256

const LANDING_FRAMES = 12
const PETTING_FRAMES = 40
const EATING_FRAMES = 72 // 2.4s at 30fps

export function startMovementEngine(win: BrowserWindow): void {
  const { workArea } = screen.getPrimaryDisplay()

  let x = workArea.x + workArea.width / 2 - WINDOW_WIDTH / 2
  const anchorY = workArea.y + workArea.height - WINDOW_HEIGHT
  let y = anchorY
  let vy = 0

  let mode: Mode = 'idle'
  let direction: Direction = 'right'
  let stateTimer = randomInt(60, 240)
  let speed = 0

  let jumpSpeed = 0
  let preJumpMode: 'idle' | 'walking' = 'idle'
  let preInteractionMode: 'idle' | 'walking' = 'idle'

  function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function enterIdle(): void {
    mode = 'idle'
    stateTimer = randomInt(60, 240)
  }

  function enterWalking(): void {
    mode = 'walking'
    direction = Math.random() < 0.5 ? 'left' : 'right'
    speed = 0.5 + Math.random() * 1.5
    stateTimer = randomInt(90, 300)
  }

  function enterJumping(): void {
    preJumpMode = mode === 'walking' ? 'walking' : 'idle'
    jumpSpeed = mode === 'walking' ? speed : 0
    mode = 'jumping'
    vy = -5.5
  }

  function enterDragging(): void {
    mode = 'dragging'
  }

  function enterFalling(): void {
    const pos = win.getPosition()
    x = pos[0]
    y = pos[1]
    vy = 0 // 초기 속도 0 → 가속도로 점점 빨라짐
    mode = 'falling'
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

  function clampX(): void {
    if (x < workArea.x) {
      x = workArea.x
      direction = 'right'
    } else if (x > workArea.x + workArea.width - WINDOW_WIDTH) {
      x = workArea.x + workArea.width - WINDOW_WIDTH
      direction = 'left'
    }
  }

  function tick(): void {
    if (win.isDestroyed()) return

    switch (mode) {
      case 'idle': {
        stateTimer--
        if (stateTimer <= 0) {
          if (Math.random() < 0.15) {
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

        if (x < workArea.x) {
          x = workArea.x
          if (Math.random() < 0.5) {
            direction = 'right'
          } else {
            enterIdle()
            break
          }
        } else if (x > workArea.x + workArea.width - WINDOW_WIDTH) {
          x = workArea.x + workArea.width - WINDOW_WIDTH
          if (Math.random() < 0.5) {
            direction = 'left'
          } else {
            enterIdle()
            break
          }
        }

        if (Math.random() < 0.003) {
          enterJumping()
          break
        }

        stateTimer--
        if (stateTimer <= 0) {
          enterIdle()
        }
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
          } else {
            enterIdle()
          }
        }
        break
      }

      case 'dragging': {
        // 렌더러가 drag-move IPC로 윈도우를 직접 이동시킴
        // 엔진은 setPosition을 호출하지 않음
        sendMovementUpdate(win, { x, y, mode, direction })
        return
      }

      case 'falling': {
        vy += 0.8 // 중력 가속도: 매 프레임 속도 증가 (0→0.8→1.6→2.4→...)
        y += vy
        if (y >= anchorY) {
          enterLanding()
        }
        break
      }

      case 'landing': {
        stateTimer--
        if (stateTimer <= 0) {
          enterIdle()
        }
        break
      }

      case 'petting': {
        stateTimer--
        if (stateTimer <= 0) {
          if (preInteractionMode === 'walking') {
            enterWalking()
          } else {
            enterIdle()
          }
        }
        break
      }

      case 'eating': {
        stateTimer--
        if (stateTimer <= 0) {
          enterIdle()
        }
        break
      }

      case 'sad':
      case 'happy': {
        stateTimer--
        if (stateTimer <= 0) {
          enterIdle()
        }
        break
      }
    }

    win.setPosition(Math.round(x), Math.round(y), false)
    sendMovementUpdate(win, { x, y, mode, direction })
  }

  // ─── 콜백 등록 ───

  setForceJumpCallback(() => {
    if (mode !== 'jumping' && mode !== 'dragging' && mode !== 'falling') {
      enterJumping()
    }
  })

  setDragStartCallback(() => {
    enterDragging()
  })

  setDragMoveCallback((dx: number, dy: number) => {
    if (mode === 'dragging' && !win.isDestroyed()) {
      const pos = win.getPosition()
      x = pos[0] + dx
      y = pos[1] + dy
      win.setPosition(Math.round(x), Math.round(y), false)
    }
  })

  setDragEndCallback(() => {
    if (mode === 'dragging') {
      enterFalling()
    }
  })

  setTriggerInteractionCallback((type: 'petting' | 'eating') => {
    if (type === 'petting') {
      enterPetting()
    } else if (type === 'eating') {
      enterEating()
    }
  })

  const timer = setInterval(tick, FRAME_INTERVAL)

  win.on('closed', () => {
    clearInterval(timer)
  })
}
