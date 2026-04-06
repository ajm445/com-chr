import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron'
import { join } from 'path'

export function createTray(win: BrowserWindow): Tray {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png')).resize({ width: 16, height: 16 })
  const tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: '종료', click: () => app.quit() }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    win.show()
  })

  return tray
}
