/**
 * Read-only mirrors of the backend formulas (app/core/demand.py, people.py,
 * ingredients.py, weather.py), used only to illustrate the config help. The
 * server still runs the real simulation.
 */
import { WEATHER_TYPES, type GameConfig, type IngredientConfig, type PersonPreferences, type Range, type Weather } from '../types/game'

/** 1 at the preference, falling linearly to 0 at `denominator` away; clamped to [0, 1]. */
export function kernel(current: number, preferred: number, denominator: number): number {
  if (denominator <= 0) return current === preferred ? 1 : 0
  return Math.min(1, Math.max(0, 1 - Math.abs(current - preferred) / denominator))
}

/** Distance from the preference to the farther end of the range, so the kernel hits 0 exactly there. */
export function largestDiff(range: Range, preferred: number): number {
  return Math.max(preferred - range.min, range.max - preferred)
}

export type ScoredRange = 'price' | 'temperature' | 'hour' | 'ice' | 'sugar' | 'lemons'

const PREFERRED: Record<ScoredRange, keyof PersonPreferences> = {
  price: 'average_expense',
  temperature: 'preferred_degrees',
  hour: 'preferred_hour',
  ice: 'preferred_ice',
  sugar: 'preferred_sugar',
  lemons: 'preferred_lemons',
}

/** How much a person likes `value` of one factor (0–1). */
export function score(cfg: GameConfig, p: PersonPreferences, factor: ScoredRange, value: number): number {
  const preferred = p[PREFERRED[factor]] as number
  return kernel(value, preferred, largestDiff(cfg.min_max_values[factor], preferred))
}

export function spawnBonus(cfg: GameConfig, p: PersonPreferences, hour: number, weather: Weather, temperature: number): number {
  const w = weather === p.preferred_weather ? 1 : 0
  return (w + score(cfg, p, 'hour', hour) + score(cfg, p, 'temperature', temperature)) / 3
}

export function expectedSpawn(cfg: GameConfig, p: PersonPreferences, hour: number, weather: Weather, temperature: number): number {
  return p.spawn_per_hour * (1 + spawnBonus(cfg, p, hour, weather, temperature)) * cfg.weather_multipliers[weather]
}

export function buyScores(cfg: GameConfig, p: PersonPreferences, price: number, recipe: { ice: number; sugar: number; lemons: number }) {
  return {
    price: score(cfg, p, 'price', price),
    ice: score(cfg, p, 'ice', recipe.ice),
    sugar: score(cfg, p, 'sugar', recipe.sugar),
    lemons: score(cfg, p, 'lemons', recipe.lemons),
  }
}

/** Chance a unit of this age spoils at tonight's check (age 1 = first night after purchase). */
export function hazard(cfg: IngredientConfig, age: number): number {
  if (cfg.never_perishes || age <= cfg.fresh_days) return 0
  if (age >= cfg.max_days) return 1
  return (age - cfg.fresh_days) / (cfg.max_days - cfg.fresh_days)
}

/** Share of a batch still unspoiled after `age` nightly checks, if none of it is sold. */
export function survival(cfg: IngredientConfig, age: number): number {
  let alive = 1
  for (let d = 1; d <= age; d++) alive *= 1 - hazard(cfg, d)
  return alive
}

export const midpoint = (r: Range): number => (r.min + r.max) / 2

/**
 * Long-run share of days with each weather. The day's temperature is uniform
 * over the range and rounded to 0.5 °C; overlapping ranges split a temperature
 * evenly, and an uncovered temperature goes to the nearest range.
 */
export function weatherOdds(cfg: GameConfig): Record<Weather, number> {
  const { min: lo, max: hi } = cfg.min_max_values.temperature
  const odds = Object.fromEntries(WEATHER_TYPES.map((w) => [w, 0])) as Record<Weather, number>
  if (hi <= lo) return odds
  const ranges = cfg.weather_temperature_ranges
  for (let t = Math.ceil(lo * 2) / 2; t <= hi + 1e-9; t += 0.5) {
    // Each 0.5 step owns the values that round to it, clipped to [lo, hi].
    const weight = (Math.min(hi, t + 0.25) - Math.max(lo, t - 0.25)) / (hi - lo)
    if (weight <= 0) continue
    let matches = WEATHER_TYPES.filter((w) => ranges[w].min <= t && t <= ranges[w].max)
    if (!matches.length) {
      const gap = (w: Weather) => Math.min(Math.abs(ranges[w].min - t), Math.abs(ranges[w].max - t))
      matches = [WEATHER_TYPES.reduce((a, b) => (gap(b) < gap(a) ? b : a))]
    }
    for (const w of matches) odds[w] += weight / matches.length
  }
  return odds
}

/** Integer steps from min to max inclusive, capped so charts stay readable. */
export function steps(r: Range, step = 1, cap = 60): number[] {
  const out: number[] = []
  for (let v = r.min; v <= r.max + 1e-9 && out.length < cap; v += step) out.push(Math.round(v * 100) / 100)
  return out
}
