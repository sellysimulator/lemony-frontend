import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '../types/game'

const listeners = new Map<string, (data: unknown) => void>()
const emit = vi.fn()
vi.mock('../api/socket', () => ({
  socket: { on: (event: string, fn: (data: unknown) => void) => listeners.set(event, fn), emit },
}))

const { useGameStore } = await import('../store/gameStore')
const { useAlerts } = await import('../store/alerts')
const { previewPlan } = await import('../api/socketHandlers')

const full = { game_id: 'g1', day: 3, phase: 'planning', days: [], last_day_events: [], summary: null, public_id: null } as unknown as GameState
const plan = { purchases: { ice: { '100': 1 } }, recipe: { ice: 1, sugar: 2, lemons: 3 }, price: 0.45 }

const ok = (request_id: string, margin = 1) => ({
  request_id,
  day: 3,
  prices: [0.25, 0.3],
  chance: [0.5, 0.4],
  expected_visitors: 20,
  expected_cups: [10, 8],
  expected_margin: [margin, margin + 1],
  cups_possible: 50,
  cost_per_cup: 0.21,
})

/** The request_ids emitted so far, in order. */
const sentIds = (): string[] => emit.mock.calls.filter((c) => c[0] === 'preview_plan').map((c) => (c[1] as { request_id: string }).request_id)

beforeEach(() => {
  useGameStore.getState().reset()
  useAlerts.setState({ alerts: [] })
  emit.mockClear()
  listeners.get('game_state')!({ seq: 5, full: true, state: full })
})

describe('previewPlan emit', () => {
  it('sends the plan and its price with the game, the day and a fresh request_id each time', () => {
    previewPlan(plan)
    previewPlan(plan)
    const calls = emit.mock.calls.filter((c) => c[0] === 'preview_plan')
    expect(calls).toHaveLength(2)
    expect(calls[0][1]).toMatchObject({ game_id: 'g1', day: 3, purchases: plan.purchases, recipe: plan.recipe, price: 0.45 })
    const [a, b] = sentIds()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(1)
    expect(a.length).toBeLessThanOrEqual(64)
  })

  it('does nothing without a game held', () => {
    useGameStore.getState().reset()
    previewPlan(plan)
    expect(emit).not.toHaveBeenCalled()
  })
})

describe('plan_preview replies', () => {
  it('keeps the reply to the latest request', () => {
    previewPlan(plan)
    const [id] = sentIds()
    listeners.get('plan_preview')!(ok(id))
    expect(useGameStore.getState().planPreview.reply).toMatchObject({ request_id: id })
    expect(useGameStore.getState().planPreview.waiting).toBe(false)
  })

  it('ignores a stale request_id, even when it arrives after the newer reply', () => {
    previewPlan(plan)
    previewPlan(plan)
    const [first, second] = sentIds()
    listeners.get('plan_preview')!(ok(second, 7))
    listeners.get('plan_preview')!(ok(first, 1))
    expect(useGameStore.getState().planPreview.reply?.request_id).toBe(second)
    expect(useGameStore.getState().planPreview.reply?.expected_margin[0]).toBe(7)
  })

  it('ignores a stale reply that arrives first and stays waiting for the newest', () => {
    previewPlan(plan)
    previewPlan(plan)
    const [first, second] = sentIds()
    listeners.get('plan_preview')!(ok(first))
    expect(useGameStore.getState().planPreview.reply).toBeNull()
    expect(useGameStore.getState().planPreview.waiting).toBe(true)
    listeners.get('plan_preview')!(ok(second))
    expect(useGameStore.getState().planPreview.reply?.request_id).toBe(second)
  })

  it('keeps the previous reply while a new request is waiting', () => {
    previewPlan(plan)
    listeners.get('plan_preview')!(ok(sentIds()[0]))
    previewPlan(plan)
    const s = useGameStore.getState().planPreview
    expect(s.reply?.request_id).toBe(sentIds()[0])
    expect(s.waiting).toBe(true)
  })

  it('stores a refusal without toasting or touching lastError, and drops the reply', () => {
    previewPlan(plan)
    listeners.get('plan_preview')!(ok(sentIds()[0]))
    previewPlan(plan)
    listeners.get('plan_preview')!({ request_id: sentIds()[1], day: 3, error: { code: 'INVALID_PLAN', message: 'Too much ice' } })
    const s = useGameStore.getState()
    expect(s.planPreview.refused).toBe(true)
    expect(s.planPreview.message).toBe('Too much ice')
    expect(s.planPreview.reply).toBeNull()
    expect(s.planPreview.waiting).toBe(false)
    expect(s.lastError).toBeNull()
    expect(useAlerts.getState().alerts).toEqual([])
  })

  it('a refused game (NO_GAME) in a preview reply does not clear the game', () => {
    previewPlan(plan)
    listeners.get('plan_preview')!({ request_id: sentIds()[0], day: null, error: { code: 'NO_GAME', message: 'No such game' } })
    expect(useGameStore.getState().gameId).toBe('g1')
    expect(useGameStore.getState().state).not.toBeNull()
  })
})

describe('plan_preview and the seq gate', () => {
  it('leaves lastSeq alone, with or without a seq on the reply', () => {
    previewPlan(plan)
    const [id] = sentIds()
    listeners.get('plan_preview')!(ok(id))
    expect(useGameStore.getState().lastSeq).toBe(5)
    listeners.get('plan_preview')!({ ...ok(id), seq: 999 })
    expect(useGameStore.getState().lastSeq).toBe(5)
    listeners.get('plan_preview')!({ ...ok(id), seq: 0 })
    expect(useGameStore.getState().lastSeq).toBe(5)
  })

  it('is applied even though its seq (absent) is not newer than lastSeq, and later state events still apply', () => {
    previewPlan(plan)
    listeners.get('plan_preview')!(ok(sentIds()[0]))
    expect(useGameStore.getState().planPreview.reply).not.toBeNull()
    listeners.get('game_state')!({ seq: 6, full: true, state: { ...full, day: 4 } })
    expect(useGameStore.getState().state?.day).toBe(4)
    expect(useGameStore.getState().lastSeq).toBe(6)
  })

  it('a sequenced event with a low seq is still dropped (the gate is intact)', () => {
    listeners.get('game_state')!({ seq: 2, full: true, state: { ...full, day: 9 } })
    expect(useGameStore.getState().state?.day).toBe(3)
  })
})
