/**
 * Pure playback math. Every actor's position is a function of the sim clock
 * and its arrival minute only, so changing speed, pausing or skipping needs
 * no state — both the 2D and 3D boards render from `actorsAt(events, clock)`.
 *
 * Times are "sim minutes" since midnight. A customer appears WALK_IN minutes
 * before their arrival, reaches the stand at `arrive_min` (the moment their
 * decision is revealed), waits AT_STAND minutes, then walks off.
 */
import { INGREDIENTS, RECIPE_INGREDIENTS, type CustomerEvent, type DayRecord, type IngredientName, type Outcome, type PersonType, type RecipeIngredient } from '../types/game'

export const WALK_IN = 6
export const AT_STAND = 2.5
export const WALK_OUT = 6

/** Sim minutes per real second at 1× (1× = one in-game hour every 20 seconds). */
export const SIM_MINUTES_PER_SECOND = 3
export const SPEEDS = [1, 2, 4, 8, 16] as const

export interface DayBounds {
  start: number
  open: number
  close: number
  end: number
}

export function dayBounds(hourMin: number, hourMax: number): DayBounds {
  const open = hourMin * 60
  const close = (hourMax + 1) * 60
  return { start: open - WALK_IN - 2, open, close, end: close + AT_STAND + WALK_OUT + 1 }
}

export type ActorPhase = 'in' | 'stand' | 'out'

export interface ActorState {
  id: number
  type: PersonType
  phase: ActorPhase
  /** 0..1 progress within the current phase. */
  progress: number
  /** -1 = left edge of the street, 0 = at the stand, 1 = right edge. */
  x: number
  /** Which side they came from. */
  side: -1 | 1
  /** 0..2, a small depth offset so a crowd does not stack on one spot. */
  lane: number
  outcome: Outcome
  reason: string | null
  revealed: boolean
  carrying: boolean
}

export function actorAt(e: CustomerEvent, clock: number): ActorState | null {
  const t0 = e.arrive_min - WALK_IN
  const t2 = e.arrive_min + AT_STAND
  const t3 = t2 + WALK_OUT
  if (clock < t0 || clock > t3) return null
  const side: -1 | 1 = e.id % 2 === 0 ? -1 : 1
  let phase: ActorPhase
  let progress: number
  let x: number
  if (clock < e.arrive_min) {
    phase = 'in'
    progress = (clock - t0) / WALK_IN
    x = side * (1 - progress)
  } else if (clock < t2) {
    phase = 'stand'
    progress = (clock - e.arrive_min) / AT_STAND
    x = 0
  } else {
    phase = 'out'
    progress = (clock - t2) / WALK_OUT
    x = -side * progress
  }
  const revealed = clock >= e.arrive_min
  return {
    id: e.id,
    type: e.type,
    phase,
    progress,
    x,
    side,
    lane: e.id % 3,
    outcome: e.outcome,
    reason: e.reason,
    revealed,
    carrying: revealed && e.outcome === 'bought' && phase === 'out',
  }
}

export function actorsAt(events: CustomerEvent[], clock: number): ActorState[] {
  const out: ActorState[] = []
  for (const e of events) {
    if (e.arrive_min - WALK_IN > clock) break // events are sorted by arrival
    const a = actorAt(e, clock)
    if (a) out.push(a)
  }
  return out
}

/** How many events have been decided by `clock` (events sorted by arrive_min). */
export function revealedCount(events: CustomerEvent[], clock: number): number {
  let lo = 0
  let hi = events.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (events[mid].arrive_min <= clock) lo = mid + 1
    else hi = mid
  }
  return lo
}

export interface LiveTally {
  visitors: number
  buyers: number
  soldOut: number
  refused: number
}

export function tally(events: CustomerEvent[], count: number): LiveTally {
  const t: LiveTally = { visitors: count, buyers: 0, soldOut: 0, refused: 0 }
  for (let i = 0; i < count; i++) {
    const o = events[i].outcome
    if (o === 'bought') t.buyers++
    else if (o === 'sold_out') t.soldOut++
    else t.refused++
  }
  return t
}

/** 0 at midnight, 0.5 at noon: drives sky colour and sun height. */
export function dayFraction(clock: number): number {
  return (((clock / 60) % 24) + 24) % 24 / 24
}

/**
 * Stock on hand when the stand opened, rebuilt from the day record: what was
 * left at close, plus what perished overnight, plus what the cups sold used.
 * Null for records that predate `inventory_end`.
 */
export function openingStock(record: DayRecord): Record<IngredientName, number> | null {
  const end = record.inventory_end
  if (!end) return null
  const perCup: Record<IngredientName, number> = { ...record.recipe, cups: 1 }
  const out = {} as Record<IngredientName, number>
  for (const n of INGREDIENTS) out[n] = end[n] + record.perished[n] + record.buyers * perCup[n]
  return out
}

/** Stock left after `sold` cups have been made from `opening`. */
export function stockAfter(opening: Record<IngredientName, number>, recipe: Record<RecipeIngredient, number>, sold: number): Record<IngredientName, number> {
  const perCup: Record<IngredientName, number> = { ...recipe, cups: 1 }
  const out = {} as Record<IngredientName, number>
  for (const n of INGREDIENTS) out[n] = Math.max(0, opening[n] - sold * perCup[n])
  return out
}

/** How many more cups `stock` can make with `recipe`. */
export function cupsLeft(stock: Record<IngredientName, number>, recipe: Record<RecipeIngredient, number>): number {
  let n = stock.cups
  for (const r of RECIPE_INGREDIENTS) if (recipe[r] > 0) n = Math.min(n, Math.floor(stock[r] / recipe[r]))
  return n
}
