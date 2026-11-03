/**
 * What today's planned packs cost, for the plan screen's "Spend" and "Cash after" and
 * the buy buttons. Display only: the server prices the real day. Cost per cup is not
 * computed here; the server sends it with the plan preview (`plan_preview.cost_per_cup`).
 */
import { INGREDIENTS, type GameConfig, type IngredientName } from '../types/game'
import { packPrice } from './configMath'

/** {ingredient: {pack size: count}} */
export type Purchases = Record<IngredientName, Record<number, number>>

export function purchaseCost(cfg: GameConfig, purchases: Purchases): number {
  let cost = 0
  for (const name of INGREDIENTS)
    for (const p of cfg.ingredients[name].packs) cost += packPrice(cfg.ingredients[name], p) * (purchases[name][p.size] ?? 0)
  return cost
}
