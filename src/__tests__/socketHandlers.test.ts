import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyGameState, DayRecord, GameState } from '../types/game'

const listeners = new Map<string, (data: unknown) => void>()
const emit = vi.fn()
vi.mock('../api/socket', () => ({
  socket: { on: (event: string, fn: (data: unknown) => void) => listeners.set(event, fn), emit },
}))

const { useGameStore } = await import('../store/gameStore')
await import('../api/socketHandlers')

const record = { day: 1 } as DayRecord
const full = { game_id: 'g1', day: 1, phase: 'planning', days: [], last_day_events: [], summary: null, public_id: null } as unknown as GameState
const daily = (over: Partial<DailyGameState>) => ({ game_id: 'g1', day: 1, phase: 'played', public_id: null, ...over }) as DailyGameState

describe('round events on the socket', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
    emit.mockClear()
  })

  it('extend the history of the game held', () => {
    listeners.get('game_state')!({ seq: 2, full: true, state: full })
    listeners.get('day_result')!({ seq: 3, day: 1, record, events: [], duplicate: false, state: daily({}) })
    listeners.get('game_state')!({ seq: 4, full: false, state: daily({ day: 2, phase: 'planning' }) })
    expect(useGameStore.getState().state).toMatchObject({ day: 2, phase: 'planning', days: [record] })
    expect(emit).not.toHaveBeenCalled()
  })

  it('a failed save is remembered until a retry or a successful save', async () => {
    const { retryPersist } = await import('../api/socketHandlers')
    listeners.get('game_state')!({ seq: 2, full: true, state: { ...full, phase: 'finished' } })
    listeners.get('game_persist_failed')!({ seq: 3 })
    expect(useGameStore.getState().persistFailed).toBe(true)
    retryPersist()
    expect(emit).toHaveBeenCalledWith('retry_persist', { game_id: 'g1' })
    expect(useGameStore.getState().persistFailed).toBe(false) // saving again
    listeners.get('game_persist_failed')!({ seq: 4 })
    expect(useGameStore.getState().persistFailed).toBe(true)
    listeners.get('game_persisted')!({ seq: 5, public_id: 'g1' })
    expect(useGameStore.getState()).toMatchObject({ persistFailed: false, publicId: 'g1' })
    listeners.get('game_persist_failed')!({ seq: 3 }) // stale: dropped by seq
    expect(useGameStore.getState().persistFailed).toBe(false)
  })

  it('ask for the full state when no history of that game is held', () => {
    listeners.get('day_result')!({ seq: 3, day: 1, record, events: [], duplicate: false, state: daily({}) })
    listeners.get('game_state')!({ seq: 4, full: false, state: daily({ day: 2, phase: 'planning' }) })
    expect(useGameStore.getState().state).toBeNull()
    expect(emit.mock.calls).toEqual([
      ['request_state', { game_id: 'g1' }],
      ['request_state', { game_id: 'g1' }],
    ])
  })
})
