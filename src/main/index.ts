import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createWindow } from './window'
import { createTray } from './tray'
import { registerIPC } from './ipc'
import { startMovementEngine } from './movement'

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron.com-chr')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const win = createWindow()
  createTray(win)
  registerIPC()
  startMovementEngine(win)
})

app.on('window-all-closed', () => {
  app.quit()
})
