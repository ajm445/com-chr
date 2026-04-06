export type MovementMode =
  | 'idle'
  | 'walking'
  | 'jumping'
  | 'dragging'
  | 'falling'
  | 'landing'
  | 'petting'
  | 'eating'
  | 'sad'
  | 'happy'
export type Direction = 'left' | 'right'

export interface MovementData {
  x: number
  y: number
  mode: MovementMode
  direction: Direction
}
