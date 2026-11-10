import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyGameState, DayRecord, GameState } from '../types/game'

const listeners = new Map<string, (data: unknown) => void>()
const emit = vi.fn()
const socketMock = vi.hoisted(() => ({ active: false, connected: false, connect: (() => {}) as () => void }))
vi.mock('../api/socket', () => ({
  socket: Object.assign(socketMock, { on: (event: string, fn: (data: unknown) => void) => listeners.set(event, fn), emit }),
}))

const { useGameStore } = await import('../store/gameStore')
const { useAlerts } = await import('../store/alerts')
const { CAP_RETRY_ATTEMPTS, REPLY_TIMEOUT_MS, createGame, submitDay } = await import('../api/socketHandlers')

const record = { day: 1 } as DayRecord
const full = { game_id: 'g1', day: 1, phase: 'planning', days: [], summary: null, public_id: null } as unknown as GameState
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

  it('a live day result plays the day back; one with no customer list opens the report', () => {
    const events = [{ id: 0 }, { id: 1 }]
    listeners.get('game_state')!({ seq: 2, full: true, state: full })
    listeners.get('day_result')!({ seq: 3, day: 1, record, events, duplicate: false, state: daily({}) })
    expect(useGameStore.getState()).toMatchObject({ view: 'day', watch: { day: 1, events } })

    useGameStore.getState().reset()
    listeners.get('game_state')!({ seq: 2, full: true, state: full })
    listeners.get('day_result')!({ seq: 3, day: 1, record, events: null, duplicate: true, state: daily({}) })
    expect(useGameStore.getState()).toMatchObject({ view: 'report', watch: { day: 1, record, events: [] } })
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

const alertTexts = () => useAlerts.getState().alerts.map((a) => a.message)
const CAP = 'Too many connections from your network. Try again in a minute.' // handlers/connection.py
const AUTH = 'Connection rejected by server' // python-socketio, for `return False`

describe('abuse limits on the socket', () => {
  const connect = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0) // no jitter: each wait is half its step
    useGameStore.getState().reset()
    useAlerts.setState({ alerts: [] })
    emit.mockClear()
    connect.mockClear()
    Object.assign(socketMock, { active: false, connected: false, connect })
    listeners.get('connect')!(undefined) // a clean slate: no retries counted, nothing shown
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('RATE_LIMITED is toasted in the client words and frees the start button', () => {
    useGameStore.getState().setCreating(true)
    listeners.get('error')!({ code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' })
    expect(alertTexts()).toEqual(['Too many requests from your network. Please wait a minute and try again.'])
    expect(useGameStore.getState()).toMatchObject({ creating: false, lastError: { code: 'RATE_LIMITED' } })
  })

  it('a handshake refused by the connection cap is retried with growing waits, then given up', () => {
    const refuse = () => listeners.get('connect_error')!(new Error(CAP))
    refuse()
    expect(alertTexts()).toEqual(['Too many connections from your network. Retrying…'])
    vi.advanceTimersByTime(999)
    expect(connect).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(connect).toHaveBeenCalledTimes(1) // 2 s step, half of it with no jitter

    refuse()
    vi.advanceTimersByTime(1999)
    expect(connect).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(connect).toHaveBeenCalledTimes(2) // the step doubled

    for (let i = 2; i < CAP_RETRY_ATTEMPTS; i++) {
      refuse()
      vi.advanceTimersByTime(60_000)
    }
    expect(connect).toHaveBeenCalledTimes(CAP_RETRY_ATTEMPTS)
    refuse()
    expect(alertTexts()).toContain('Too many connections from your network. Please reload the page in a few minutes.')
    vi.advanceTimersByTime(60_000)
    expect(connect).toHaveBeenCalledTimes(CAP_RETRY_ATTEMPTS) // bounded
  })

  it('a successful connect resets the retry count', () => {
    listeners.get('connect_error')!(new Error(CAP))
    vi.advanceTimersByTime(1000)
    listeners.get('connect')!(undefined)
    listeners.get('connect_error')!(new Error(CAP))
    vi.advanceTimersByTime(1000)
    expect(connect).toHaveBeenCalledTimes(2) // the first wait again, not the doubled one
  })

  it('an auth refusal is not retried as the cap', () => {
    listeners.get('connect_error')!(new Error(AUTH))
    expect(alertTexts()).toEqual(['Your sign-in was refused by the server. Try signing in again.'])
    vi.advanceTimersByTime(60_000)
    expect(connect).not.toHaveBeenCalled()
  })

  it('an unreachable server keeps its message and is left to the reconnect loop', () => {
    socketMock.active = true
    listeners.get('connect_error')!(new Error('websocket error'))
    expect(alertTexts()).toEqual(['Could not reach the game server. Retrying…'])
    vi.advanceTimersByTime(60_000)
    expect(connect).not.toHaveBeenCalled()
  })

  it('an unanswered submit_day or create_game frees its button', () => {
    listeners.get('game_state')!({ seq: 2, full: true, state: full })
    submitDay({ purchases: {}, price: 1, recipe: { ice: 1, sugar: 1, lemons: 1 } } as never)
    createGame({} as never)
    vi.advanceTimersByTime(REPLY_TIMEOUT_MS)
    expect(useGameStore.getState()).toMatchObject({ submitting: false, creating: false })
    expect(alertTexts()).toEqual(['The server did not answer. Please try again.'])
  })
})
