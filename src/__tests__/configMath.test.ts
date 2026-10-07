import { describe, expect, it } from 'vitest'
import {
  applyPopularity,
  asymmetricKernel,
  buyDecision,
  buyProbability,
  hazard,
  kernel,
  largestDiff,
  packPrice,
  popularity,
  refusalReason,
  survival,
  weatherOdds,
  willingnessToPay,
} from '../game/configMath'
import type { GameConfig, IngredientConfig, PersonPreferences } from '../types/game'

const lemons: IngredientConfig = { unit_cost: 0.15, packs: [{ size: 50, discount: 0 }], fresh_days: 3, max_days: 7, never_perishes: false }

// Mirrors the default Adult and tests/test_core/test_engine.py.
const adult: PersonPreferences = {
  spawn_per_hour: 5,
  average_expense: 0.8,
  preferred_degrees: 20,
  preferred_weather: 'sunny',
  preferred_ice: 1,
  preferred_sugar: 1,
  preferred_lemons: 3,
  preferred_hour: 17,
  tolerances: {
    ice: { below: 1, above: 2 },
    sugar: { below: 2, above: 2 },
    lemons: { below: 1, above: 2 },
    price: { below: 0.5, above: 0.6 },
  },
}
const swingCfg = { quality_swing: 0.4 } as GameConfig

describe('buy model', () => {
  it('ingredient kernel uses a separate reach below and above', () => {
    expect(asymmetricKernel(1, 2, 1, 3)).toBe(0)
    expect(asymmetricKernel(3, 2, 1, 3)).toBeCloseTo(2 / 3)
    expect(asymmetricKernel(2, 2, 0, 0)).toBe(1)
  })

  it('a better recipe raises what they would pay', () => {
    expect(buyDecision(swingCfg, adult, 0.8, { ice: 1, sugar: 1, lemons: 3 }).quality).toBe(1)
    expect(buyDecision(swingCfg, adult, 0.8, { ice: 5, sugar: 5, lemons: 0 }).quality).toBe(0)
    expect(willingnessToPay(swingCfg, adult, 1)).toBeCloseTo(1.12)
    expect(willingnessToPay(swingCfg, adult, 0.5)).toBeCloseTo(0.8)
    expect(willingnessToPay(swingCfg, adult, 0)).toBeCloseTo(0.48)
  })

  it('half buy at what they would pay, 5% one tolerance over, 95% one under', () => {
    const reach = 0.6 * 0.8
    expect(buyProbability(adult, 1, 1)).toBeCloseTo(0.5)
    expect(buyProbability(adult, 1 + reach, 1)).toBeCloseTo(0.05)
    expect(buyProbability(adult, 1 - reach, 1)).toBeCloseTo(0.95)
  })

  it('refusal blames a suspicious price, an over-budget price, or the worst ingredient', () => {
    const favourite = { ice: 1, sugar: 1, lemons: 3 }
    const fewerLemons = { ice: 1, sugar: 1, lemons: 2 }
    const perfect = { ice: 1, sugar: 1, lemons: 1 }
    const scores = { ice: 1, sugar: 1, lemons: 0 }
    expect(refusalReason(adult, 0.3, favourite, perfect)).toBe('too_cheap')
    expect(refusalReason(adult, 0.8, favourite, perfect)).toBe('too_pricey')
    expect(refusalReason(adult, 0.8, fewerLemons, scores)).toBe('needs_more_lemon')
    expect(refusalReason(adult, 2, fewerLemons, scores)).toBe('too_pricey')
  })

  it('popularity is the mean daily rate, or the start value before any', () => {
    expect(popularity([], 0.3)).toBe(0.3)
    expect(popularity([0.5, 1, 0], 0.3)).toBeCloseTo(0.5)
  })

  it('popularity scales the chance around a neutral half, capped at 100 %', () => {
    expect(applyPopularity(0.4, 0.5)).toBeCloseTo(0.4)
    expect(applyPopularity(0.4, 0)).toBeCloseTo(0.2)
    expect(applyPopularity(0.4, 1)).toBeCloseTo(0.6)
    expect(applyPopularity(0.9, 1)).toBe(1)
  })
})

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

  it('pack price applies the pack discount and rounds to the cent', () => {
    expect(packPrice(lemons, { size: 500, discount: 0.2 })).toBe(60)
    expect(packPrice({ ...lemons, unit_cost: 0.07 }, { size: 3, discount: 0.1 })).toBe(0.19)
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
