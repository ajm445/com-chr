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
  direction: 'left' | 'right'
}

export interface MoodModifier {
  speedMultiplier: number
  jumpChance: number
  idleMultiplier: number
}

let forceJumpCallback: (() => void) | null = null
let dragStartCallback: (() => void) | null = null
let dragMoveCallback: ((dx: number, dy: number) => void) | null = null
let dragEndCallback: (() => void) | null = null
let triggerInteractionCallback: ((type: 'petting' | 'eating') => void) | null = null
let moodModifierCallback: ((mod: MoodModifier) => void) | null = null

export function setForceJumpCallback(cb: () => void): void { forceJumpCallback = cb }
export function setDragStartCallback(cb: () => void): void { dragStartCallback = cb }
export function setDragMoveCallback(cb: (dx: number, dy: number) => void): void { dragMoveCallback = cb }
export function setDragEndCallback(cb: () => void): void { dragEndCallback = cb }
export function setTriggerInteractionCallback(cb: (type: 'petting' | 'eating') => void): void { triggerInteractionCallback = cb }
export function setMoodModifierCallback(cb: (mod: MoodModifier) => void): void { moodModifierCallback = cb }

export function registerIPC(): void {
  ipcMain.on('pet:force-jump', () => forceJumpCallback?.())
  ipcMain.on('pet:drag-start', () => dragStartCallback?.())
  ipcMain.on('pet:drag-move', (_e, data: { dx: number; dy: number }) => dragMoveCallback?.(data.dx, data.dy))
  ipcMain.on('pet:drag-end', () => dragEndCallback?.())
  ipcMain.on('pet:interaction', (_e, payload: { type: 'petting' | 'eating' }) => triggerInteractionCallback?.(payload.type))

  // 상태 저장/로드
  ipcMain.on('pet:save-state', (_e, state) => savePetState(state))
  ipcMain.handle('pet:load-state', () => loadPetState())

  // mood modifier 수신
  ipcMain.on('pet:mood-modifier', (_e, mod: MoodModifier) => moodModifierCallback?.(mod))

  ipcMain.on('pet:context-menu', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const menu = Menu.buildFromTemplate([
      { label: 'Feed', click: () => triggerInteractionCallback?.('eating') },
      { label: 'Pet', click: () => triggerInteractionCallback?.('petting') },
      { label: 'Clean', click: () => {
        // clean은 renderer의 store action이므로 IPC로 전달
        win.webContents.send('pet:do-clean')
      }},
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
    menu.popup({ window: win })
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
