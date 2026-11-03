/**
 * Pure builders for the end-screen charts. Every figure is a server field (`DayRecord`,
 * `GameSummary`); these only pick, position and colour them, and add nothing up.
 */
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

/** Floating bars from the server's `cash_start` of each day to its `cash_end`. */
export function waterfallSpans(summary: GameSummary): { up: (Span | null)[]; down: (Span | null)[]; spans: Span[] } {
  const spans: Span[] = summary.days.map((d) => [d.cash_start, d.cash_end])
  return {
    spans,
    up: spans.map(([a, b]) => (b >= a ? [a, b] : null)),
    down: spans.map(([a, b]) => (b < a ? [a, b] : null)),
  }
}

export function perishedSeries(days: DayRecord[], name: IngredientName): number[] {
  return days.map((d) => d.perished[name])
}

/** The server's `total_perished_value`, in words. */
export function spoilageCaption(summary: GameSummary): string {
  return `Value lost to spoilage: ${money(summary.total_perished_value)} over the game. Each panel counts its own ingredient in its own units.`
}

/** The server's success rate of one day at one hour, or null when nobody visited then. */
export function hourRate(d: DayRecord, hour: number): number | null {
  return d.by_hour.find((x) => x.hour === hour)?.conversion ?? null
}

export { INGREDIENTS }
