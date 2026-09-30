import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore, viewForState } from '../store/gameStore'
import type { DayRecord, GameState } from '../types/game'

const record = { day: 1 } as DayRecord
const state = (over: Partial<GameState>): GameState =>
  ({ game_id: 'g1', day: 1, phase: 'planning', days: [], last_day_events: [], summary: null, public_id: null, ...over }) as GameState

describe('gameStore', () => {
  beforeEach(() => useGameStore.getState().reset())

  it('drops stale events by seq', () => {
    const s = useGameStore.getState()
    s.handleGameCreated(1, 'g1')
    s.handleGameState(3, state({ day: 2 }))
    s.handleGameState(2, state({ day: 1 }))
    expect(useGameStore.getState().state?.day).toBe(2)
  })

  it('a refresh mid-day replays that day; a finished game opens results', () => {
    expect(viewForState(state({ phase: 'played', days: [record], last_day_events: [] })).view).toBe('day')
    expect(viewForState(state({ phase: 'finished', days: [record] })).view).toBe('over')
    expect(viewForState(state({ phase: 'planning' })).view).toBe('plan')
  })

  it('day result opens playback; acknowledging returns to planning', () => {
    const s = useGameStore.getState()
    s.handleGameCreated(1, 'g1')
    s.handleGameState(2, state({}))
    s.handleDayResult({ seq: 3, day: 1, record, events: [], duplicate: false, state: state({ phase: 'played', days: [record] }) })
    expect(useGameStore.getState().view).toBe('day')
    useGameStore.getState().setView('report')
    s.handleGameState(4, state({ phase: 'played', days: [record] }))
    expect(useGameStore.getState().view).toBe('report')
    s.handleGameState(5, state({ day: 2, phase: 'planning', days: [record] }))
    expect(useGameStore.getState().view).toBe('plan')
  })
})
