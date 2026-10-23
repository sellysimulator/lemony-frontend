import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore, viewForState } from '../store/gameStore'
import type { CustomerEvent, DailyGameState, DayRecord, GameState, GameSummary } from '../types/game'

const record = { day: 1 } as DayRecord
const state = (over: Partial<GameState>): GameState =>
  ({ game_id: 'g1', day: 1, phase: 'planning', days: [], last_day_events: [], summary: null, public_id: null, ...over }) as GameState
/** What round events carry: the state without its history. */
const daily = (over: Partial<DailyGameState>): DailyGameState =>
  ({ game_id: 'g1', day: 1, phase: 'planning', public_id: null, ...over }) as DailyGameState
const events = [{ id: 0 }] as CustomerEvent[]

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
    s.handleDayResult({ seq: 3, day: 1, record, events: [], duplicate: false, state: daily({ phase: 'played' }) })
    expect(useGameStore.getState().view).toBe('day')
    useGameStore.getState().setView('report')
    s.handleGameState(4, state({ phase: 'played', days: [record] }))
    expect(useGameStore.getState().view).toBe('report')
    s.handleGameState(5, state({ day: 2, phase: 'planning', days: [record] }))
    expect(useGameStore.getState().view).toBe('plan')
  })

  it('a day result appends its record to the history held, once', () => {
    const s = useGameStore.getState()
    s.handleGameCreated(1, 'g1')
    s.handleGameState(2, state({}))
    s.handleDayResult({ seq: 3, day: 1, record, events, duplicate: false, state: daily({ phase: 'played' }) })
    expect(useGameStore.getState().state?.days).toEqual([record])
    expect(useGameStore.getState().state?.last_day_events).toEqual(events)
    // A replayed result (duplicate submit) never duplicates the day.
    s.handleDayResult({ seq: 4, day: 1, record, events, duplicate: true, state: daily({ phase: 'played' }) })
    expect(useGameStore.getState().state?.days).toEqual([record])

    const day2 = { day: 2 } as DayRecord
    s.handleDailyState(5, daily({ day: 2, phase: 'planning' }))
    expect(useGameStore.getState().state).toMatchObject({ day: 2, phase: 'planning', days: [record], last_day_events: [] })
    s.handleDayResult({ seq: 6, day: 2, record: day2, events, duplicate: false, state: daily({ day: 2, phase: 'played' }) })
    expect(useGameStore.getState().state?.days).toEqual([record, day2])
  })

  it('a daily state keeps the history held; a full state replaces it', () => {
    const s = useGameStore.getState()
    s.handleGameCreated(1, 'g1')
    s.handleGameState(2, state({ day: 2, days: [record] }))
    s.handleDailyState(3, daily({ day: 2, phase: 'planning' }))
    expect(useGameStore.getState().state?.days).toEqual([record])
    s.handleGameState(4, state({ day: 2, days: [] }))
    expect(useGameStore.getState().state?.days).toEqual([])
  })

  it('the summary of the last day comes from game_finished, not the daily state', () => {
    const s = useGameStore.getState()
    s.handleGameCreated(1, 'g1')
    s.handleGameState(2, state({}))
    s.handleDayResult({ seq: 3, day: 1, record, events, duplicate: false, state: daily({ phase: 'finished' }) })
    expect(useGameStore.getState().state?.summary).toBeNull()
    s.handleGameFinished(4, { days_played: 1 } as GameSummary)
    expect(useGameStore.getState().summary?.days_played).toBe(1)
  })
})
