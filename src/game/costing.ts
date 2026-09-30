/**
 * Preview of what cups will cost, mirroring the engine: stock is used oldest
 * batch first at the price paid for it, and today's purchases are one lot per
 * pack size (dearest per unit used first). Display only; the server prices
 * the real day.
 */
import { INGREDIENTS, RECIPE_INGREDIENTS, type GameConfig, type IngredientName, type InventoryLine, type RecipeIngredient } from '../types/game'
import { packPrice } from './configMath'

/** {ingredient: {pack size: count}} */
export type Purchases = Record<IngredientName, Record<number, number>>

interface Lot {
  qty: number
  unitCost: number
}

export function purchaseLots(cfg: GameConfig, purchases: Purchases): Record<IngredientName, Lot[]> {
  const lots = {} as Record<IngredientName, Lot[]>
  for (const name of INGREDIENTS) {
    const ing = cfg.ingredients[name]
    lots[name] = ing.packs
      .filter((p) => (purchases[name][p.size] ?? 0) > 0)
      .map((p) => ({ qty: p.size * purchases[name][p.size], unitCost: packPrice(ing, p) / p.size }))
      .sort((a, b) => b.unitCost - a.unitCost)
  }
  return lots
}

export function purchaseCost(cfg: GameConfig, purchases: Purchases): number {
  let cost = 0
  for (const name of INGREDIENTS)
    for (const p of cfg.ingredients[name].packs) cost += packPrice(cfg.ingredients[name], p) * (purchases[name][p.size] ?? 0)
  return cost
}

export function listCostPerCup(cfg: GameConfig, recipe: Record<RecipeIngredient, number>): number {
  return RECIPE_INGREDIENTS.reduce((s, n) => s + recipe[n] * cfg.ingredients[n].unit_cost, 0) + cfg.ingredients.cups.unit_cost
}

/** Cost of using `qty` units, oldest stock first; anything beyond the stock is priced at list price. */
function fifoCost(queue: Lot[], qty: number, listPrice: number): number {
  let remaining = qty
  let cost = 0
  for (const lot of queue) {
    const take = Math.min(lot.qty, remaining)
    cost += take * lot.unitCost
    remaining -= take
    if (remaining <= 0) break
  }
  return cost + remaining * listPrice
}

/** Average cost of the next `cups` cups (at least one) from stock plus today's purchases. */
export function projectedCostPerCup(
  cfg: GameConfig,
  inventory: Record<IngredientName, InventoryLine>,
  purchases: Purchases,
  recipe: Record<RecipeIngredient, number>,
  cups: number,
): number {
  const n = Math.max(1, cups)
  const lots = purchaseLots(cfg, purchases)
  const need: Record<IngredientName, number> = { ice: recipe.ice * n, sugar: recipe.sugar * n, lemons: recipe.lemons * n, cups: n }
  let total = 0
  for (const name of INGREDIENTS) {
    const stock: Lot[] = inventory[name].batches.map((b) => ({ qty: b.qty, unitCost: b.unit_cost ?? cfg.ingredients[name].unit_cost }))
    total += fifoCost([...stock, ...lots[name]], need[name], cfg.ingredients[name].unit_cost)
  }
  return total / n
}
