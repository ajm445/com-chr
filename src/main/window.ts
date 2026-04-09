import { BrowserWindow, screen, ipcMain, Display } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export const WINDOW_WIDTH = 160
export const WINDOW_HEIGHT = 256 // 고정 높이: 스프라이트(64) + 점프/UI 공간(192)
export const SPRITE_SIZE = 64

/**
 * 화면 바닥에서 슬라임 스프라이트 바닥까지 **절대** 확보해야 하는 최소 여유 픽셀.
 * Windows 11 기본 작업표시줄이 약 48px 이므로, 작업표시줄이 어떤 이유로든
 * workArea 에 반영되지 않아도 이 값만큼 띄우면 가려지지 않는다.
 */
export const MIN_BOTTOM_SAFE_MARGIN = 48

/**
 * 작업표시줄이 workArea 에 정상 반영된 환경에서도 스프라이트 바닥과 작업표시줄 윗선
 * 사이에 확보하는 최소 여유. 0px 이면 DPI 라운딩 / z-order 경합으로 스프라이트
 * 하단 몇 px 이 작업표시줄에 덮여 "작업표시줄 아래로 떨어진 것처럼" 보일 수 있다.
 */
export const WORKAREA_GAP = 6

/**
 * 디스플레이의 "유효 anchorY" — 슬라임의 윈도우 top 이 위치해야 하는 Y 좌표.
 *
 * 두 기준 중 더 **위쪽(=작은 y)** 을 선택한다:
 *   1. workArea 기준 바닥 − WORKAREA_GAP (정상 reservation 된 경우 이 값이 정답)
 *   2. display bounds 기준 바닥 − MIN_BOTTOM_SAFE_MARGIN (절대 안전선)
 *
 * 이렇게 하면:
 * - 정상 환경: 작업표시줄 바로 위에 WORKAREA_GAP 만큼 띄워 안착 (z-order 경합 방어)
 * - 자동 숨김 작업표시줄 / 풀스크린 보호: workArea==bounds → 안전선이 더 위 → 48px 여유
 * - 부분 reservation 버그(일부 Windows 11 설정): workArea 가 살짝만 줄어도 안전선이 더 위로 올라가 확실히 가려지지 않음
 */
export function getEffectiveAnchorY(display: Display): number {
  const { workArea, bounds } = display
  const workAreaAnchor = workArea.y + workArea.height - WINDOW_HEIGHT - WORKAREA_GAP
  const safeAnchor = bounds.y + bounds.height - WINDOW_HEIGHT - MIN_BOTTOM_SAFE_MARGIN
  return Math.min(workAreaAnchor, safeAnchor)
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
