import { useState, useEffect } from 'react'
import type { MovementData } from '../types/pet'

export function usePetAnimation() {
  const [movement, setMovement] = useState<MovementData>({
    x: 0,
    y: 0,
    mode: 'idle',
    direction: 'right',
  })

  useEffect(() => {
    const cleanup = window.api.onMovementUpdate(setMovement)
    return cleanup
  }, [])

  return movement
}
