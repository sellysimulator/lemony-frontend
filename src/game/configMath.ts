/**
 * Read-only mirrors of the backend formulas (app/core/demand.py, people.py,
 * ingredients.py, weather.py), used only to illustrate the config help. The
 * server still runs the real simulation.
 */
import { roundCents } from '../utils/money'
import { RECIPE_INGREDIENTS, WEATHER_TYPES, type GameConfig, type IngredientConfig, type PackOption, type PersonPreferences, type Range, type RecipeIngredient, type Weather } from '../types/game'

/** 1 at the preference, falling linearly to 0 at `denominator` away; clamped to [0, 1]. */
export function kernel(current: number, preferred: number, denominator: number): number {
  if (denominator <= 0) return current === preferred ? 1 : 0
  return Math.min(1, Math.max(0, 1 - Math.abs(current - preferred) / denominator))
}

/** Distance from the preference to the farther end of the range, so the kernel hits 0 exactly there. */
export function largestDiff(range: Range, preferred: number): number {
  return Math.max(preferred - range.min, range.max - preferred)
}

export type ScoredRange = 'temperature' | 'hour'

const PREFERRED: Record<ScoredRange, keyof PersonPreferences> = {
  temperature: 'preferred_degrees',
  hour: 'preferred_hour',
}

/** How much a person likes `value` of a spawn factor (0–1); the range sets the reach. */
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

export type Recipe = Record<RecipeIngredient, number>

/** Like `kernel`, with a separate reach under and over the preference. */
export function asymmetricKernel(current: number, preferred: number, below: number, above: number): number {
  return kernel(current, preferred, current < preferred ? below : above)
}

/** How much a person likes `amount` of one ingredient (0–1), from their own tolerances. */
export function ingredientScore(p: PersonPreferences, name: RecipeIngredient, amount: number): number {
  const t = p.tolerances[name]
  return asymmetricKernel(amount, p[`preferred_${name}`], t.below, t.above)
}

export function ingredientScores(p: PersonPreferences, recipe: Recipe): Recipe {
  return {
    ice: ingredientScore(p, 'ice', recipe.ice),
    sugar: ingredientScore(p, 'sugar', recipe.sugar),
    lemons: ingredientScore(p, 'lemons', recipe.lemons),
  }
}

export const recipeQuality = (s: Recipe): number => (s.ice + s.sugar + s.lemons) / 3

/** What this person would pay for a cup of this quality: budget × (1 ± quality_swing). */
export function willingnessToPay(cfg: GameConfig, p: PersonPreferences, quality: number): number {
  return p.average_expense * (1 + cfg.quality_swing * (2 * quality - 1))
}

/** Below this price the cup looks suspicious. */
export const cheapFloor = (p: PersonPreferences): number => p.average_expense * (1 - p.tolerances.price.below)

/** Chance to buy at `price` given what they would pay: half buy at `wtp`, 5 % at `wtp + above × budget`. */
export function buyProbability(p: PersonPreferences, price: number, wtp: number): number {
  const spread = (p.tolerances.price.above * p.average_expense) / Math.log(19)
  let chance: number
  if (spread <= 0) chance = price <= wtp ? 1 : 0
  else chance = 1 / (1 + Math.exp(Math.max(-60, Math.min(60, (price - wtp) / spread))))
  const floor = cheapFloor(p)
  if (price < floor) chance *= price / floor
  return chance
}

/** Mean success rate (cups sold ÷ visitors) of the days with visitors; `start` until there is one. */
export function popularity(rates: number[], start: number): number {
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : start
}

/** Scale a buy chance by 0.5 + popularity: neutral at 0.5, capped at 100 %. */
export const applyPopularity = (chance: number, pop: number): number => Math.min(1, chance * (0.5 + pop))

/** Everything a customer weighs for one plan. */
export function buyDecision(cfg: GameConfig, p: PersonPreferences, price: number, recipe: Recipe) {
  const scores = ingredientScores(p, recipe)
  const quality = recipeQuality(scores)
  const wtp = willingnessToPay(cfg, p, quality)
  return { scores, quality, wtp, chance: buyProbability(p, price, wtp) }
}

/** Why they would say no (mirrors demand.refusal_reason). */
export function refusalReason(p: PersonPreferences, price: number, recipe: Recipe, scores: Recipe): string {
  if (price < cheapFloor(p)) return 'too_cheap'
  const factor = RECIPE_INGREDIENTS.reduce((a, b) => (scores[b] < scores[a] ? b : a))
  const budget = p.average_expense
  const pressure = budget > 0 ? (price - budget) / (p.tolerances.price.above * budget) : 1
  if (scores[factor] >= 1 || pressure >= 1 - scores[factor]) return 'too_pricey'
  const tooMuch = recipe[factor] > p[`preferred_${factor}`]
  const reasons: Record<RecipeIngredient, [string, string]> = {
    ice: ['too_much_ice', 'needs_more_ice'],
    sugar: ['too_sweet', 'not_sweet_enough'],
    lemons: ['too_sour', 'needs_more_lemon'],
  }
  return reasons[factor][tooMuch ? 0 : 1]
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

/** What one pack costs, rounded to the cent (mirrors IngredientConfig.pack_price). */
export function packPrice(cfg: IngredientConfig, pack: PackOption): number {
  return roundCents(pack.size * cfg.unit_cost * (1 - pack.discount))
}
