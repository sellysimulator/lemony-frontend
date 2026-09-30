import { describe, expect, it } from 'vitest'
import { listCostPerCup, projectedCostPerCup, purchaseCost, type Purchases } from '../game/costing'
import type { GameConfig, IngredientConfig, IngredientName, InventoryLine } from '../types/game'

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
const recipe = { ice: 1, sugar: 1, lemons: 1 }
const empty = (): Record<IngredientName, InventoryLine> => {
  const line = (): InventoryLine => ({ total: 0, batches: [], expected_loss_tonight: 0 })
  return { ice: line(), sugar: line(), lemons: line(), cups: line() }
}
const none = (): Purchases => ({ ice: {}, sugar: {}, lemons: {}, cups: {} })

describe('costing', () => {
  it('prices each pack with its own discount', () => {
    expect(purchaseCost(cfg, { ...none(), lemons: { 10: 2, 100: 1 } })).toBeCloseTo(2 + 5)
  })

  it('falls back to list price with no stock', () => {
    expect(projectedCostPerCup(cfg, empty(), none(), recipe, 0)).toBeCloseTo(listCostPerCup(cfg, recipe))
  })

  it('uses discounted packs and older stock at the price paid', () => {
    const bulk: Purchases = { ice: { 100: 1 }, sugar: { 100: 1 }, lemons: { 100: 1 }, cups: { 100: 1 } }
    expect(projectedCostPerCup(cfg, empty(), bulk, recipe, 100)).toBeCloseTo(0.2)

    const inv = empty()
    inv.lemons = { total: 50, batches: [{ qty: 50, age: 2, unit_cost: 0.02, risk_tonight: 0 }], expected_loss_tonight: 0 }
    // 50 cups use the old lemons at $0.02, the other 50 use today's at $0.05.
    expect(projectedCostPerCup(cfg, inv, bulk, recipe, 100)).toBeCloseTo(0.15 + (50 * 0.02 + 50 * 0.05) / 100)
  })
})
