import { describe, expect, it } from 'vitest'
import { purchaseCost, type Purchases } from '../game/costing'
import type { GameConfig, IngredientConfig } from '../types/game'

const ing = (unit_cost: number): IngredientConfig => ({
  unit_cost,
  packs: [
    { size: 10, discount: 0 },
    { size: 100, discount: 0.5 },
  ],
  fresh_days: 0,
  max_days: 1,
  never_perishes: false,
})
const cfg = { ingredients: { ice: ing(0.1), sugar: ing(0.1), lemons: ing(0.1), cups: ing(0.1) } } as unknown as GameConfig
const none = (): Purchases => ({ ice: {}, sugar: {}, lemons: {}, cups: {} })

describe('costing', () => {
  it('prices each pack with its own discount', () => {
    expect(purchaseCost(cfg, { ...none(), lemons: { 10: 2, 100: 1 } })).toBeCloseTo(2 + 5)
  })

  it('keeps no cost-per-cup formula: the server sends it with the plan preview', async () => {
    const costing = await import('../game/costing')
    expect(Object.keys(costing).sort()).toEqual(['purchaseCost'])
  })
})
