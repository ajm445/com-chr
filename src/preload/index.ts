import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  onMovementUpdate: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('movement:update', handler)
    return () => {
      ipcRenderer.removeListener('movement:update', handler)
    }
  },
  forceJump: () => {
    ipcRenderer.send('pet:force-jump')
  },
  dragStart: () => {
    ipcRenderer.send('pet:drag-start')
  },
  dragMove: (dx: number, dy: number) => {
    ipcRenderer.send('pet:drag-move', { dx, dy })
  },
  dragEnd: () => {
    ipcRenderer.send('pet:drag-end')
  },
  triggerInteraction: (type: string) => {
    ipcRenderer.send('pet:interaction', { type })
  },
  quitApp: () => {
    ipcRenderer.send('pet:quit')
  }
})
