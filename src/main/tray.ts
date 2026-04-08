import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron'
import { join } from 'path'

export function createTray(win: BrowserWindow): Tray {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/tray.png'))
  const tray = new Tray(icon)
  tray.setToolTip('슬라임 펫')

  const contextMenu = Menu.buildFromTemplate([
    { label: '종료', click: () => app.quit() }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    win.show()
  })

  return tray
}
