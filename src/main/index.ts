import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createWindow } from './window'
import { createTray } from './tray'
import { registerIPC } from './ipc'
import { startMovementEngine } from './movement'
import { initAutoUpdater } from './updater'

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ajm445.slime-pet')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const win = createWindow()
  createTray(win)
  registerIPC()
  startMovementEngine(win)

  // 자동 업데이트 (packaged 환경에서만 동작)
  if (app.isPackaged) {
    initAutoUpdater(() => (win.isDestroyed() ? null : win))
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
