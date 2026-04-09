import { BrowserWindow, screen, powerMonitor, type Display } from 'electron'
import {
  sendMovementUpdate,
  setForceJumpCallback,
  setDragStartCallback,
  setDragEndCallback,
  setTriggerInteractionCallback,
  setMoodModifierCallback,
  type MoodModifier,
} from './ipc'
import { getEffectiveAnchorY } from './window'

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
  | 'sleeping'
type Direction = 'left' | 'right'

const FRAME_INTERVAL = 1000 / 30
const WINDOW_WIDTH = 160
const WINDOW_HEIGHT = 256

const LANDING_FRAMES = 12
const PETTING_FRAMES = 36 // 1.2s at 30fps — CSS 애니메이션과 일치
const EATING_FRAMES = 72
const SAD_FRAMES = 120    // 4초
const HAPPY_FRAMES = 90   // 3초
const SLEEPING_FRAMES = 180 // 6초

/** 1초마다 위치 안전 검증 (display 변경 누락·z-order 밀림 등 방어) */
const SAFETY_CHECK_FRAMES = 30

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
    // 디스플레이가 하나도 없으면(이론상) 안전한 디폴트
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      return { minX: 0, maxX: WINDOW_WIDTH }
    }
    return { minX, maxX }
  }

  let bounds = calcXBounds()
  const initialDisplay = screen.getPrimaryDisplay()
  let currentWorkArea = initialDisplay.workArea
  let anchorY = getEffectiveAnchorY(initialDisplay)

  let x = currentWorkArea.x + currentWorkArea.width / 2 - WINDOW_WIDTH / 2
  let y = anchorY
  let vy = 0

  /** 좌표 (cx, cy) 가 속한 디스플레이를 찾아 반환. screen API 가 실패해도 primary 로 fallback. */
  function displayAt(cx: number, cy: number): Display {
    try {
      return screen.getDisplayNearestPoint({ x: Math.round(cx), y: Math.round(cy) })
    } catch {
      return screen.getPrimaryDisplay()
    }
  }

  /** 현재 윈도우 위치 기준으로 해당 모니터의 anchorY 재계산 (드래그 후 낙하용) */
  function recalcDisplay(): void {
    const pos = win.getPosition()
    const display = displayAt(pos[0] + WINDOW_WIDTH / 2, pos[1] + WINDOW_HEIGHT / 2)
    currentWorkArea = display.workArea
    anchorY = getEffectiveAnchorY(display)
    bounds = calcXBounds()
  }

  /**
   * 슬라임이 어떤 환경에서도 화면 밖이나 작업표시줄에 가려지지 않도록 강제 스냅.
   * - 디스플레이 변경/슬립 복귀/주기 검증에서 호출됨.
   * - 드래그 중에는 사용자가 위치를 잡고 있으므로 건드리지 않음.
   */
  function ensureOnScreen(): void {
    if (mode === 'dragging') return

    const cx = Math.round(x) + WINDOW_WIDTH / 2
    const cy = Math.round(y) + WINDOW_HEIGHT / 2
    const display = displayAt(cx, cy)
    const wa = display.workArea
    const safeAnchorY = getEffectiveAnchorY(display)

    // X: 전체 모니터 결합 범위로 clamp.
    // 단일 모니터의 workArea 로 clamp 하면 모니터 경계 근처에서 걷는 슬라임이
    // 매 safety tick 마다 현재 모니터 안쪽으로 밀려 다른 모니터로 건너가지 못함.
    const combined = calcXBounds()
    if (x < combined.minX) x = combined.minX
    if (x > combined.maxX - WINDOW_WIDTH) x = combined.maxX - WINDOW_WIDTH

    // Y: anchorY 보다 아래로 떨어져 있으면 끌어올리고, workArea.y 위로도 너무 멀면 끌어내림
    if (y > safeAnchorY) y = safeAnchorY
    if (y < wa.y) y = wa.y

    currentWorkArea = wa
    anchorY = safeAnchorY
    bounds = combined

    // 정지 모드들은 즉시 anchorY 로 스냅 (낙하 중이면 다음 tick 에서 자연 처리)
    if (mode !== 'falling' && mode !== 'jumping') {
      y = anchorY
    }

    if (!win.isDestroyed()) {
      win.setPosition(Math.round(x), Math.round(y), false)
      // z-order 가 다른 앱에 밀렸을 가능성 → 강제로 최상위로
      win.moveTop()
    }
  }

  let mode: Mode = 'idle'
  let direction: Direction = 'right'
  let stateTimer = randomInt(60, 240)
  let speed = 0

  let jumpSpeed = 0
  let preJumpMode: 'idle' | 'walking' = 'idle'
  let preInteractionMode: 'idle' | 'walking' = 'idle'

  // mood modifier (렌더러에서 주기적으로 갱신)
  let mood: MoodModifier = { speedMultiplier: 1, jumpChance: 0.15, idleMultiplier: 1, sadChance: 0 }

  function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function enterIdle(): void {
    mode = 'idle'
    const base = randomInt(60, 240)
    stateTimer = Math.round(base * mood.idleMultiplier)

    // sadChance=1 → 항상 슬픔, 0.5 → 50% 확률로 슬픔
    if (mood.sadChance >= 1) {
      enterSad()
      return
    }
    if (mood.sadChance > 0 && Math.random() < mood.sadChance) {
      enterSad()
      return
    }
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
    recalcDisplay()
    // 이미 바닥이거나 아래에 있으면 바로 착지
    if (y >= anchorY) {
      y = anchorY
      enterLanding()
      return
    }
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

  function enterSad(): void {
    if (mode === 'dragging' || mode === 'falling' || mode === 'landing') return
    mode = 'sad'
    stateTimer = SAD_FRAMES
  }

  function enterHappy(): void {
    if (mode === 'dragging' || mode === 'falling' || mode === 'landing') return
    mode = 'happy'
    stateTimer = HAPPY_FRAMES
  }

  function enterSleeping(): void {
    if (mode === 'dragging' || mode === 'falling' || mode === 'landing') return
    mode = 'sleeping'
    stateTimer = SLEEPING_FRAMES
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
    const display = displayAt(Math.round(x) + WINDOW_WIDTH / 2, Math.round(y) + WINDOW_HEIGHT / 2)
    anchorY = getEffectiveAnchorY(display)
  }

  let safetyCounter = 0

  function tick(): void {
    if (win.isDestroyed()) return

    // 1초마다 위치/디스플레이 안전 검증 (display 이벤트 누락·z-order 밀림 방어)
    safetyCounter++
    if (safetyCounter >= SAFETY_CHECK_FRAMES) {
      safetyCounter = 0
      ensureOnScreen()
    }

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
        if (stateTimer <= 0) enterHappy()
        break
      }

      case 'eating': {
        y = anchorY
        stateTimer--
        if (stateTimer <= 0) enterHappy()
        break
      }

      case 'sad':
      case 'happy':
      case 'sleeping': {
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

  setDragEndCallback(() => {
    if (mode !== 'dragging') return
    // 드래그 동안 Windows 작업표시줄에 z-order 가 밀렸을 수 있으므로
    // 낙하 시작 직전에 강제로 최상위 복귀. always-on-top 도 재적용하여
    // 일부 Windows 환경에서 screen-saver 레벨이 떨어지는 경우를 방어한다.
    if (!win.isDestroyed()) {
      win.setAlwaysOnTop(true, 'screen-saver')
      win.moveTop()
    }
    enterFalling()
  })

  setTriggerInteractionCallback((type) => {
    if (type === 'petting') enterPetting()
    else if (type === 'eating') enterEating()
    else if (type === 'sad') enterSad()
    else if (type === 'happy') enterHappy()
    else if (type === 'sleeping') enterSleeping()
  })

  setMoodModifierCallback((mod) => {
    mood = mod
    // idle 상태에서 sadChance가 발생하면 즉시 슬픈 표정 전환
    if (mod.sadChance > 0 && mode === 'idle') enterIdle()
  })

  const timer = setInterval(tick, FRAME_INTERVAL)

  // ─── 디스플레이/전원 이벤트 ───
  // 모니터 추가·제거·해상도 변경·DPI 변경 → bounds 재계산 + 안전 스냅
  const onDisplayChange = (): void => {
    bounds = calcXBounds()
    ensureOnScreen()
  }
  screen.on('display-added', onDisplayChange)
  screen.on('display-removed', onDisplayChange)
  screen.on('display-metrics-changed', onDisplayChange)

  // 슬립 → 복귀 후 좌표가 어긋나거나 z-order 가 밀린 경우 복구
  const onResume = (): void => {
    bounds = calcXBounds()
    ensureOnScreen()
  }
  powerMonitor.on('resume', onResume)

  win.on('closed', () => {
    clearInterval(timer)
    screen.removeListener('display-added', onDisplayChange)
    screen.removeListener('display-removed', onDisplayChange)
    screen.removeListener('display-metrics-changed', onDisplayChange)
    powerMonitor.removeListener('resume', onResume)
  })
}
