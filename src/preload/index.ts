import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  onMovementUpdate: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('movement:update', handler)
    return () => { ipcRenderer.removeListener('movement:update', handler) }
  },
  forceJump: () => { ipcRenderer.send('pet:force-jump') },
  dragStart: () => { ipcRenderer.send('pet:drag-start') },
  dragMove: (dx: number, dy: number) => { ipcRenderer.send('pet:drag-move', { dx, dy }) },
  dragEnd: () => { ipcRenderer.send('pet:drag-end') },
  triggerInteraction: (type: string) => { ipcRenderer.send('pet:interaction', { type }) },
  showContextMenu: () => { ipcRenderer.send('pet:context-menu') },
  saveState: (state: any) => { ipcRenderer.send('pet:save-state', state) },
  loadState: () => ipcRenderer.invoke('pet:load-state'),
  sendMoodModifier: (mod: any) => { ipcRenderer.send('pet:mood-modifier', mod) },
  setClickThrough: (ignore: boolean) => { ipcRenderer.send('pet:click-through', ignore) },
  expandWindow: (expanded: boolean) => { ipcRenderer.send('pet:expand-window', expanded) },
  onClean: (callback: () => void) => {
    ipcRenderer.on('pet:do-clean', () => callback())
    return () => { ipcRenderer.removeAllListeners('pet:do-clean') }
  },
  quitApp: () => { ipcRenderer.send('pet:quit') },
})
