---
name: Component Architecture
description: Pet.tsx structure, animation key-restart pattern, drag/squash interaction rules, and context menu wiring
type: project
---

## File roles
- `components/Pet.tsx` — single sprite div + context menu, all interaction logic
- `hooks/usePetAnimation.ts` — subscribes to window.api.onMovementUpdate, returns MovementData
- `types/pet.ts` — MovementMode (10 values), Direction, MovementData
- `index.css` — all @keyframes (9 sprite + squash), base reset, 128x128 transparent root

## Pet.tsx key patterns

### SPRITE_CONFIG map
Record<MovementMode, { sprite, backgroundSize, animation }> — single lookup, no conditionals.

### Animation restart for non-looping sprites
modeChangeCounter (useState) increments in a useEffect whenever mode changes.
key = NON_LOOPING_MODES.has(mode) ? `${mode}-${modeChangeCounter}` : mode
This causes React to unmount/remount the div, resetting the CSS animation to frame 0.

### Squash & Stretch
- isSquashing state: switches animation to 'squash 0.4s ease-out'
- Suppressed during: active drag (isDraggingRef.current), petting, eating modes
- 400ms timeout clears the flag (matches squash keyframe duration)
- squashTimeoutRef clears previous timeout to prevent overlap

### Native Electron window drag
- Sprite div has WebkitAppRegion: 'drag' — OS-level draggable area
- onMouseDown → isDraggingRef = true + window.api.dragStart()
- document mouseup listener → if isDraggingRef, call window.api.dragEnd({x: window.screenX, y: window.screenY})
- Context menu div has WebkitAppRegion: 'no-drag' so clicks register normally

### Context menu interactions
- Feed → window.api.triggerInteraction('eating') + close menu
- Pet → window.api.triggerInteraction('petting') + close menu
- Clean → disabled (no-op close)
- Quit → window.api.quitApp()

### Direction flip
transform: scaleX(-1) when direction === 'left', else undefined.
Applied via flipTransform variable only (not combined with squash transform — squash runs its own CSS animation).

## WebkitAppRegion cast pattern
TypeScript does not know WebkitAppRegion, so style is cast as:
  style={{ ... } as React.CSSProperties & { WebkitAppRegion: string }}
