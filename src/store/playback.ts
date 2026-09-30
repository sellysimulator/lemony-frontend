import { create } from 'zustand'
import { SIM_MINUTES_PER_SECOND } from '../game/timeline'

interface PlaybackState {
  clock: number
  end: number
  speed: number
  paused: boolean
  start(from: number, end: number): void
  advance(realSeconds: number): void
  setSpeed(speed: number): void
  togglePause(): void
  skipToEnd(): void
}

export const usePlayback = create<PlaybackState>((set, get) => ({
  clock: 0,
  end: 0,
  speed: 1,
  paused: false,
  start(from, end) {
    set({ clock: from, end, paused: false })
  },
  advance(realSeconds) {
    const { clock, end, speed, paused } = get()
    if (paused || clock >= end) return
    set({ clock: Math.min(end, clock + realSeconds * SIM_MINUTES_PER_SECOND * speed) })
  },
  setSpeed(speed) {
    set({ speed, paused: false })
  },
  togglePause() {
    set((s) => ({ paused: !s.paused }))
  },
  skipToEnd() {
    set((s) => ({ clock: s.end }))
  },
}))
