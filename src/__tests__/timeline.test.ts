import { describe, expect, it } from 'vitest'
import { actorAt, actorsAt, AT_STAND, dayBounds, revealedCount, salesSoFar, stockNow, tally, WALK_IN, WALK_OUT } from '../game/timeline'
import type { CustomerEvent, DayRecord } from '../types/game'

const ev = (id: number, arrive: number, outcome: CustomerEvent['outcome'] = 'bought'): CustomerEvent => ({
  id,
  type: 'Adult',
  arrive_min: arrive,
  outcome,
  reason: outcome === 'refused' ? 'too_pricey' : null,
  probability: 0.5,
})

describe('timeline', () => {
  it('walks in, stands, walks out, then disappears', () => {
    const e = ev(0, 600)
    expect(actorAt(e, 600 - WALK_IN - 0.1)).toBeNull()
    const walking = actorAt(e, 600 - WALK_IN / 2)!
    expect(walking.phase).toBe('in')
    expect(walking.x).toBeCloseTo(-0.5)
    expect(walking.revealed).toBe(false)
    const standing = actorAt(e, 601)!
    expect(standing.phase).toBe('stand')
    expect(standing.x).toBe(0)
    expect(standing.revealed).toBe(true)
    const leaving = actorAt(e, 600 + AT_STAND + WALK_OUT / 2)!
    expect(leaving.phase).toBe('out')
    expect(leaving.carrying).toBe(true)
    expect(leaving.x).toBeCloseTo(0.5)
    expect(actorAt(e, 600 + AT_STAND + WALK_OUT + 0.1)).toBeNull()
  })

  it('refusers never carry a cup', () => {
    expect(actorAt(ev(1, 600, 'refused'), 600 + AT_STAND + 1)!.carrying).toBe(false)
  })

  it('counts revealed decisions and tallies outcomes', () => {
    const events = [ev(0, 540), ev(1, 560, 'refused'), ev(2, 580, 'sold_out'), ev(3, 600)]
    expect(revealedCount(events, 559)).toBe(1)
    expect(revealedCount(events, 580)).toBe(3)
    expect(tally(events, 3)).toEqual({ visitors: 3, buyers: 1, soldOut: 1, refused: 1 })
    expect(actorsAt(events, 566).map((a) => a.id)).toEqual([1])
    expect(actorsAt(events, 596).map((a) => a.id)).toEqual([3])
    expect(actorsAt(events, 585).map((a) => a.id)).toEqual([2])
  })

  it('day bounds cover opening hours with walk time either side', () => {
    const b = dayBounds(9, 17)
    expect(b.open).toBe(540)
    expect(b.close).toBe(1080)
    expect(b.start).toBeLessThan(b.open - WALK_IN + 1)
    expect(b.end).toBeGreaterThan(b.close + AT_STAND + WALK_OUT - 1)
  })
})

describe('the day as the server reports it', () => {
  const opening = { ice: 40, sugar: 20, lemons: 15, cups: 30 }
  const record = { inventory_open: opening, cups_open: 10 } as unknown as DayRecord
  // Deliberately not opening − cups × recipe: the playback shows what each event says.
  const events = [
    { ...ev(0, 540), sales: 0.5, stock: { ice: 37, sugar: 18, lemons: 14, cups: 29 }, cups_left: 9 },
    { ...ev(1, 560, 'refused'), sales: 0.5, stock: { ice: 37, sugar: 18, lemons: 14, cups: 29 }, cups_left: 9 },
    { ...ev(2, 580), sales: 1.25, stock: { ice: 1, sugar: 2, lemons: 3, cups: 4 }, cups_left: 1 },
  ]

  it('sales so far are the last revealed event’s, and nothing before the first', () => {
    expect(salesSoFar(events, 0)).toBe(0)
    expect(salesSoFar(events, 2)).toBe(0.5)
    expect(salesSoFar(events, 3)).toBe(1.25)
    expect(salesSoFar([ev(0, 540)], 1)).toBeNull()
  })

  it('stock is the opening stock until the first decision, then the last revealed event’s', () => {
    expect(stockNow(record, events, 0)).toEqual({ opening, stock: opening, cupsLeft: 10 })
    expect(stockNow(record, events, 3)).toEqual({ opening, stock: events[2].stock, cupsLeft: 1 })
  })

  it('shows nothing for a day the server kept no opening stock or event stock for', () => {
    expect(stockNow({ ...record, inventory_open: undefined }, events, 1)).toBeNull()
    expect(stockNow(record, [ev(0, 540)], 1)).toBeNull()
  })
})
