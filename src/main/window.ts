import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export const WINDOW_WIDTH = 128
export const WINDOW_HEIGHT = 256
export const SPRITE_SIZE = 64

export function createWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()

  const x = Math.round(workArea.x + workArea.width / 2 - WINDOW_WIDTH / 2)
  const y = workArea.y + workArea.height - WINDOW_HEIGHT

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: join(__dirname, '../preload/index.js')
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')

  // 네이티브 컨텍스트 메뉴 차단 (커스텀 메뉴 사용)
  win.webContents.on('context-menu', (e) => e.preventDefault())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
