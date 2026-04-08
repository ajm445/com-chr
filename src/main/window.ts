import { BrowserWindow, screen, ipcMain, Display } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export const WINDOW_WIDTH = 160
export const WINDOW_HEIGHT = 256 // 고정 높이: 스프라이트(64) + 점프/UI 공간(192)
export const SPRITE_SIZE = 64

/**
 * 자동 숨김 작업표시줄·기타 환경에서 슬라임이 가려지지 않도록 화면 바닥에서 확보하는 여유 픽셀.
 * 일반 작업표시줄은 일반적으로 40~48px. 48이면 99% 환경에서 가려지지 않는다.
 */
export const TASKBAR_AUTOHIDE_RESERVE = 48

/**
 * 디스플레이의 "유효 anchorY" — 슬라임의 윈도우 top 이 위치해야 하는 Y 좌표.
 *
 * 핵심: workArea 가 bounds 와 동일하면 (예: 자동 숨김 작업표시줄, 풀스크린 모드 등으로
 * Windows 가 작업표시줄 공간을 reservation 하지 않은 상태) 슬라임이 화면 바닥에 붙어
 * 작업표시줄에 가려지므로, 안전 여유를 둔다.
 */
export function getEffectiveAnchorY(display: Display): number {
  const { workArea, bounds } = display
  const noReservation =
    workArea.x === bounds.x &&
    workArea.y === bounds.y &&
    workArea.width === bounds.width &&
    workArea.height === bounds.height
  const reserve = noReservation ? TASKBAR_AUTOHIDE_RESERVE : 0
  return workArea.y + workArea.height - WINDOW_HEIGHT - reserve
}

export function createWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { workArea } = display

  const x = Math.round(workArea.x + workArea.width / 2 - WINDOW_WIDTH / 2)
  const y = getEffectiveAnchorY(display)

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

  // 투명 영역 클릭 통과
  win.setIgnoreMouseEvents(true, { forward: true })

  // 렌더러에서 스프라이트 hover → 인터랙티브 전환
  ipcMain.on('pet:click-through', (_e, ignore: boolean) => {
    if (!win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : undefined)
    }
  })

  win.webContents.on('context-menu', (e) => e.preventDefault())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
