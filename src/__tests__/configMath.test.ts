import { describe, expect, it } from 'vitest'
import { hazard, kernel, largestDiff, survival, weatherOdds } from '../game/configMath'
import type { GameConfig, IngredientConfig } from '../types/game'

const lemons: IngredientConfig = { unit_cost: 0.15, pack_sizes: [50], fresh_days: 3, max_days: 7, never_perishes: false }

describe('configMath', () => {
  it('kernel is 1 at the preference and 0 at the reach', () => {
    const reach = largestDiff({ min: 0, max: 3 }, 0.2)
    expect(reach).toBeCloseTo(2.8)
    expect(kernel(0.2, 0.2, reach)).toBe(1)
    expect(kernel(3, 0.2, reach)).toBeCloseTo(0)
    expect(kernel(1.6, 0.2, reach)).toBeCloseTo(0.5)
  })

  it('hazard ramps linearly between fresh and max days', () => {
    expect([1, 3, 4, 5, 7, 9].map((d) => hazard(lemons, d))).toEqual([0, 0, 0.25, 0.5, 1, 1])
    expect(hazard({ ...lemons, never_perishes: true }, 99)).toBe(0)
  })

  it('survival compounds nightly hazards', () => {
    expect(survival(lemons, 3)).toBe(1)
    expect(survival(lemons, 5)).toBeCloseTo(0.75 * 0.5)
    expect(survival(lemons, 7)).toBe(0)
  })

  it('weather odds follow the share of the temperature range each weather covers', () => {
    const cfg = {
      min_max_values: { temperature: { min: 0, max: 40 } },
      weather_temperature_ranges: {
        snowy: { min: 0, max: 5 },
        rainy: { min: 5, max: 15 },
        cloudy: { min: 15, max: 25 },
        sunny: { min: 25, max: 40 },
      },
    } as unknown as GameConfig
    const odds = weatherOdds(cfg)
    expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(odds.sunny).toBeCloseTo(15 / 40, 2)
    expect(odds.snowy).toBeCloseTo(5 / 40, 2)
  })
})
