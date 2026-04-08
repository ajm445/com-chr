import { BrowserWindow, ipcMain, app, Menu } from 'electron'
import { savePetState, loadPetState } from './persistence'

export interface MovementData {
  x: number
  y: number
  mode:
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
  direction: 'left' | 'right'
}

export interface MoodModifier {
  speedMultiplier: number
  jumpChance: number
  idleMultiplier: number
  sadChance: number
}

let forceJumpCallback: (() => void) | null = null
let dragStartCallback: (() => void) | null = null
let dragMoveCallback: ((dx: number, dy: number) => void) | null = null
let dragEndCallback: (() => void) | null = null
let triggerInteractionCallback: ((type: 'petting' | 'eating' | 'sad' | 'happy' | 'sleeping') => void) | null = null
let moodModifierCallback: ((mod: MoodModifier) => void) | null = null

export function setForceJumpCallback(cb: () => void): void { forceJumpCallback = cb }
export function setDragStartCallback(cb: () => void): void { dragStartCallback = cb }
export function setDragMoveCallback(cb: (dx: number, dy: number) => void): void { dragMoveCallback = cb }
export function setDragEndCallback(cb: () => void): void { dragEndCallback = cb }
export function setTriggerInteractionCallback(cb: (type: 'petting' | 'eating' | 'sad' | 'happy') => void): void { triggerInteractionCallback = cb }
export function setMoodModifierCallback(cb: (mod: MoodModifier) => void): void { moodModifierCallback = cb }

export function registerIPC(): void {
  ipcMain.on('pet:force-jump', () => forceJumpCallback?.())
  ipcMain.on('pet:drag-start', () => dragStartCallback?.())
  ipcMain.on('pet:drag-move', (_e, data: { dx: number; dy: number }) => dragMoveCallback?.(data.dx, data.dy))
  ipcMain.on('pet:drag-end', () => dragEndCallback?.())
  ipcMain.on('pet:interaction', (_e, payload: { type: 'petting' | 'eating' | 'sad' | 'happy' }) => triggerInteractionCallback?.(payload.type))

  // 상태 저장/로드
  ipcMain.on('pet:save-state', (_e, state) => savePetState(state))
  ipcMain.handle('pet:load-state', () => loadPetState())

  // mood modifier 수신
  ipcMain.on('pet:mood-modifier', (_e, mod: MoodModifier) => moodModifierCallback?.(mod))

  let lastMenuActionTime = 0
  const MENU_COOLDOWN = 5000

  ipcMain.on('pet:context-menu', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    const now = Date.now()
    const onCooldown = now - lastMenuActionTime < MENU_COOLDOWN

    // 메뉴가 열리는 동안 클릭 통과 해제 (투명 영역 클릭으로 메뉴 닫기 가능)
    win.setIgnoreMouseEvents(false)
    // 외부 클릭으로 메뉴가 닫히도록 임시로 focusable 활성화
    win.setFocusable(true)
    // Windows: setFocusable(true)는 skipTaskbar를 해제하므로 즉시 재적용
    win.setSkipTaskbar(true)
    win.focus()

    const menu = Menu.buildFromTemplate([
      { label: onCooldown ? '밥 주기 (대기중)' : '밥 주기', enabled: !onCooldown, click: () => {
        lastMenuActionTime = Date.now()
        win.webContents.send('pet:do-feed')
        triggerInteractionCallback?.('eating')
      }},
      { label: onCooldown ? '놀아주기 (대기중)' : '놀아주기', enabled: !onCooldown, click: () => {
        lastMenuActionTime = Date.now()
        win.webContents.send('pet:do-play')
        triggerInteractionCallback?.('happy')
      }},
      { label: onCooldown ? '씻기기 (대기중)' : '씻기기', enabled: !onCooldown, click: () => {
        lastMenuActionTime = Date.now()
        win.webContents.send('pet:do-clean')
        triggerInteractionCallback?.('happy')
      }},
      { type: 'separator' },
      { label: '종료', click: () => app.quit() },
    ])
    menu.popup({
      window: win,
      callback: () => {
        // 메뉴 닫힌 후 클릭 통과 + 비포커스 상태 복원
        if (!win.isDestroyed()) {
          win.setFocusable(false)
          win.setSkipTaskbar(true)
          win.setIgnoreMouseEvents(true, { forward: true })
        }
      },
    })
  })

  ipcMain.on('pet:quit', () => app.quit())
}

export function sendMovementUpdate(win: BrowserWindow, data: MovementData): void {
  try {
    if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send('movement:update', data)
    }
  } catch {}
}
