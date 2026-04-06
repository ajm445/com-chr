---
name: Sprite Sheet System
description: All 9 sprite configs with frame counts, CSS animation strings, and looping classification used in SPRITE_CONFIG map
type: project
---

All sprites live at `src/renderer/src/assets/sprites/`. Display div is 64x64px. `background-size` scales the sheet to fit.

## SPRITE_CONFIG (Pet.tsx)

| Mode     | File          | Frames | background-size | animation string                          | Loops |
|----------|---------------|--------|-----------------|-------------------------------------------|-------|
| idle     | chr_idle.png  | 4      | 256px 64px      | sprite-idle 0.6s steps(4) infinite       | yes   |
| walking  | chr_idle.png  | 4      | 256px 64px      | sprite-idle 0.6s steps(4) infinite       | yes   |
| jumping  | chr_jump.png  | 6      | 384px 64px      | sprite-jump 0.83s steps(6) 1 forwards    | no    |
| dragging | chr_grab.png  | 2      | 128px 64px      | sprite-grab 0.4s steps(2) 1 forwards     | no    |
| falling  | chr_fall.png  | 3      | 192px 64px      | sprite-fall 0.5s steps(3) infinite       | yes   |
| landing  | chr_land.png  | 4      | 256px 64px      | sprite-land 0.4s steps(4) 1 forwards     | no    |
| petting  | chr_pet.png   | 4      | 256px 64px      | sprite-pet 1.2s steps(4) 1 forwards      | no    |
| eating   | chr_eat.png   | 6      | 384px 64px      | sprite-eat 1.2s steps(6) 1 forwards      | no    |
| sad      | chr_sad.png   | 4      | 256px 64px      | sprite-sad 1.6s steps(4) infinite        | yes   |
| happy    | chr_happy.png | 4      | 256px 64px      | sprite-happy 0.8s steps(4) infinite      | yes   |

## Non-looping modes (NON_LOOPING_MODES Set)
jumping, dragging, landing, petting, eating

These require key={`${mode}-${modeChangeCounter}`} to restart CSS animation on re-entry.
Looping modes use stable key={mode}.

## CSS Keyframes (index.css)
All 9 @keyframes defined: sprite-idle, sprite-jump, sprite-grab, sprite-fall, sprite-land, sprite-pet, sprite-eat, sprite-sad, sprite-happy.
Plus the squash keyframe for click interaction.
