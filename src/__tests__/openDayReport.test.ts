import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from '../store/gameStore'
import type { DayRecord, GameState } from '../types/game'

const rec = (day: number): DayRecord => ({ day, cash_end: 100 + day }) as DayRecord
const state = (days: DayRecord[]): GameState =>
  ({ game_id: 'g1', day: days.length + 1, phase: 'finished', days, summary: null, public_id: null }) as unknown as GameState

describe('openDayReport', () => {
  beforeEach(() => useGameStore.getState().reset())

  it('opens the report of a day the store holds, with no events to replay', () => {
    const s = useGameStore.getState()
    s.handleGameCreated(1, 'g1')
    s.handleGameState(2, state([rec(1), rec(2), rec(3)]))
    expect(useGameStore.getState().view).toBe('over')

    useGameStore.getState().openDayReport(2)

    const after = useGameStore.getState()
    expect(after.view).toBe('report')
    expect(after.watch).toEqual({ day: 2, record: rec(2), events: [] })
    expect(after.watch?.record).toBe(after.state?.days[1])
  })

  it('changes nothing for a day it does not hold', () => {
    const s = useGameStore.getState()
    s.handleGameCreated(1, 'g1')
    s.handleGameState(2, state([rec(1), rec(2)]))
    const before = useGameStore.getState()

    useGameStore.getState().openDayReport(9)
    useGameStore.getState().openDayReport(0)

    const after = useGameStore.getState()
    expect(after.view).toBe('over')
    expect(after.watch).toBe(before.watch)
    expect(after.watch).toBeNull()
    expect(after.state).toBe(before.state)
  })

  it('changes nothing when no game is held', () => {
    useGameStore.getState().openDayReport(1)
    const after = useGameStore.getState()
    expect(after.view).toBe('plan')
    expect(after.watch).toBeNull()
  })
})
