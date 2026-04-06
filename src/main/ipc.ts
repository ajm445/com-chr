import { BrowserWindow, ipcMain, app } from 'electron'

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

let forceJumpCallback: (() => void) | null = null
let dragStartCallback: (() => void) | null = null
let dragMoveCallback: ((dx: number, dy: number) => void) | null = null
let dragEndCallback: (() => void) | null = null
let triggerInteractionCallback: ((type: 'petting' | 'eating') => void) | null = null

export function setForceJumpCallback(cb: () => void): void {
  forceJumpCallback = cb
}

export function setDragStartCallback(cb: () => void): void {
  dragStartCallback = cb
}

export function setDragMoveCallback(cb: (dx: number, dy: number) => void): void {
  dragMoveCallback = cb
}

export function setDragEndCallback(cb: () => void): void {
  dragEndCallback = cb
}

export function setTriggerInteractionCallback(
  cb: (type: 'petting' | 'eating') => void
): void {
  triggerInteractionCallback = cb
}

export function registerIPC(): void {
  ipcMain.on('pet:force-jump', () => {
    forceJumpCallback?.()
  })

  ipcMain.on('pet:drag-start', () => {
    dragStartCallback?.()
  })

  ipcMain.on('pet:drag-move', (_event, data: { dx: number; dy: number }) => {
    dragMoveCallback?.(data.dx, data.dy)
  })

  ipcMain.on('pet:drag-end', () => {
    dragEndCallback?.()
  })

  ipcMain.on('pet:interaction', (_event, payload: { type: 'petting' | 'eating' }) => {
    triggerInteractionCallback?.(payload.type)
  })

  ipcMain.on('pet:quit', () => {
    app.quit()
  })
}

export function sendMovementUpdate(win: BrowserWindow, data: MovementData): void {
  try {
    if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send('movement:update', data)
    }
  } catch {
    // Window or webContents may be disposed during shutdown
  }
}
