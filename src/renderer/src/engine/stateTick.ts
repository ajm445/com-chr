import { useEffect, useRef } from 'react'
import { usePetStore } from '../store/petStore'
import { TICK_INTERVAL } from '../types/pet'

const SAVE_INTERVAL = 30_000 // 30초마다 메인 프로세스에 백업

export function useStateTick() {
  const tick = usePetStore((s) => s.tick)
  const resumeFromBackground = usePetStore((s) => s.resumeFromBackground)
  const hasResumed = useRef(false)

  // 시작 시 lastTickTime 만 현재 시각으로 리셋 (종료 중 스탯 동결)
  useEffect(() => {
    if (!hasResumed.current) {
      resumeFromBackground()
      hasResumed.current = true
    }
  }, [resumeFromBackground])

  // 10초 간격 tick
  useEffect(() => {
    const timer = setInterval(tick, TICK_INTERVAL)
    return () => clearInterval(timer)
  }, [tick])

  // 30초 간격 메인 프로세스 백업
  useEffect(() => {
    const timer = setInterval(() => {
      const state = usePetStore.getState()
      window.api.saveState({
        hunger: state.hunger,
        happiness: state.happiness,
        cleanliness: state.cleanliness,
        lastTickTime: state.lastTickTime,
      })
    }, SAVE_INTERVAL)
    return () => clearInterval(timer)
  }, [])
}
