---
name: IPC Contract
description: Full window.api surface — all channels exposed by preload and their main-side ipcMain handlers
type: project
---

## Preload exposes (src/preload/index.ts + index.d.ts)

| Method                                     | IPC channel       | Direction         |
|--------------------------------------------|-------------------|-------------------|
| onMovementUpdate(cb)                       | movement:update   | main → renderer   |
| forceJump()                                | pet:force-jump    | renderer → main   |
| dragStart()                                | pet:drag-start    | renderer → main   |
| dragEnd({ x, y })                          | pet:drag-end      | renderer → main   |
| triggerInteraction('petting' | 'eating')   | pet:interaction   | renderer → main   |
| quitApp()                                  | pet:quit          | renderer → main   |

## Main-side handlers (src/main/ipc.ts)
- registerIPC() sets up all ipcMain.on listeners
- Callbacks injected via: setForceJumpCallback, setDragStartCallback, setDragEndCallback, setTriggerInteractionCallback
- sendMovementUpdate(win, data) sends movement:update with full MovementData

## MovementData shape
{ x, y, mode: MovementMode, direction: 'left' | 'right' }
MovementMode covers all 10 states: idle, walking, jumping, dragging, falling, landing, petting, eating, sad, happy

## Window.api global declaration
Authoritative source: src/preload/index.d.ts (picked up globally by TS).
The inline `declare global` that used to be inside usePetAnimation.ts has been removed to avoid conflicts.
