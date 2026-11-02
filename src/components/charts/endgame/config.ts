/** Pure builders for the end-screen charts. Every figure is a `DayRecord` field or a sum, difference or ratio of them. */
import { INGREDIENTS, RECIPE_INGREDIENTS, type DayRecord, type GameSummary, type IngredientName } from '../../../types/game'
import { money } from '../../../utils/format'
import { sequentialColor } from '../chartSetup'

export const DAY_AXIS = 'Day'

export interface BubblePoint {
  x: number
  y: number
  r: number
  day: number
}

/** Radius in px grows with the square root of visitors, so area follows the count. */
export function bubblePoints(days: DayRecord[]): BubblePoint[] {
  const max = Math.max(1, ...days.map((d) => d.visitors))
  return days.map((d) => ({ x: d.price, y: d.conversion, r: 4 + 14 * Math.sqrt(d.visitors / max), day: d.day }))
}

/** One sequential colour per day, deeper for hotter days. */
export function temperatureColors(days: DayRecord[]): string[] {
  const temps = days.map((d) => d.temperature)
  const lo = Math.min(...temps)
  const hi = Math.max(...temps)
  return days.map((d) => sequentialColor(hi === lo ? 0.5 : (d.temperature - lo) / (hi - lo)))
}

export function recipeText(d: DayRecord): string {
  return RECIPE_INGREDIENTS.map((n) => `${n} ${d.recipe[n]}`).join(' · ')
}

export type Span = [number, number]

/**
 * Floating bars from the cash the day began with to the server's `cash_end`.
 * The start is the previous day's `cash_end` (the first day's is `starting_cash`);
 * nothing is accumulated from profit, so the bars cannot drift from the server.
 */
export function waterfallSpans(summary: GameSummary): { up: (Span | null)[]; down: (Span | null)[]; spans: Span[] } {
  let before = summary.starting_cash
  const spans: Span[] = summary.days.map((d) => {
    const span: Span = [before, d.cash_end]
    before = d.cash_end
    return span
  })
  return {
    spans,
    up: spans.map(([a, b]) => (b >= a ? [a, b] : null)),
    down: spans.map(([a, b]) => (b < a ? [a, b] : null)),
  }
}

export function perishedSeries(days: DayRecord[], name: IngredientName): number[] {
  return days.map((d) => d.perished[name])
}

export function perishedValueTotal(days: DayRecord[]): number {
  return days.reduce((sum, d) => sum + d.perished_value, 0)
}

export function spoilageCaption(days: DayRecord[]): string {
  return `Value lost to spoilage: ${money(perishedValueTotal(days))} over the game. Each panel counts its own ingredient in its own units.`
}

export interface HourTotals {
  hours: number[]
  visitors: Map<number, number>
  buyers: Map<number, number>
}

export function hourTotals(days: DayRecord[]): HourTotals {
  const visitors = new Map<number, number>()
  const buyers = new Map<number, number>()
  for (const d of days)
    for (const h of d.by_hour) {
      visitors.set(h.hour, (visitors.get(h.hour) ?? 0) + h.visitors)
      buyers.set(h.hour, (buyers.get(h.hour) ?? 0) + h.buyers)
    }
  return { hours: [...visitors.keys()].sort((a, b) => a - b), visitors, buyers }
}

/** Success rate of one day at one hour, or null when nobody visited then. */
export function hourRate(d: DayRecord, hour: number): number | null {
  const h = d.by_hour.find((x) => x.hour === hour)
  return h && h.visitors > 0 ? h.buyers / h.visitors : null
}

export { INGREDIENTS }
