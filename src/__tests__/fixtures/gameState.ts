/** A day-1 game on the backend's default configuration (app/core/defaults.py), for component tests. */
import type { GameConfig, GameState, IngredientConfig, InventoryLine, PersonPreferences } from '../../types/game'

const packs = [
  { size: 100, discount: 0 },
  { size: 300, discount: 0.05 },
  { size: 500, discount: 0.1 },
  { size: 700, discount: 0.2 },
]

const ingredient = (unit_cost: number, fresh_days: number, max_days: number, never_perishes = false): IngredientConfig => ({
  unit_cost,
  packs,
  fresh_days,
  max_days,
  never_perishes,
})

const person = (over: Partial<PersonPreferences>): PersonPreferences => ({
  spawn_per_hour: 5,
  average_expense: 0.5,
  preferred_degrees: 20,
  preferred_weather: 'sunny',
  preferred_ice: 1,
  preferred_sugar: 1,
  preferred_lemons: 2,
  preferred_hour: 12,
  tolerances: {
    ice: { below: 2, above: 2 },
    sugar: { below: 2, above: 2 },
    lemons: { below: 2, above: 2 },
    price: { below: 0.5, above: 0.5 },
  },
  ...over,
})

export const defaultConfig = (): GameConfig => ({
  num_days: 7,
  starting_cash: 100,
  min_max_values: {
    ice: { min: 0, max: 5 },
    sugar: { min: 0, max: 5 },
    lemons: { min: 1, max: 5 },
    temperature: { min: 0, max: 40 },
    hour: { min: 9, max: 17 },
    price: { min: 0.2, max: 1 },
  },
  quality_swing: 0.4,
  starting_popularity: 0.5,
  people_preferences: {
    Child: person({ average_expense: 0.3, preferred_degrees: 30, preferred_lemons: 1 }),
    Teenager: person({ spawn_per_hour: 3, average_expense: 0.4, preferred_degrees: 25, preferred_weather: 'cloudy', preferred_hour: 15 }),
    Adult: person({ average_expense: 0.8, preferred_lemons: 3, preferred_hour: 17 }),
    Senior: person({ spawn_per_hour: 2, average_expense: 0.75, preferred_degrees: 15, preferred_weather: 'cloudy', preferred_hour: 14 }),
  },
  weather_multipliers: { sunny: 1, cloudy: 0.7, rainy: 0.5, snowy: 0.2 },
  weather_temperature_ranges: {
    snowy: { min: 0, max: 5 },
    rainy: { min: 5, max: 15 },
    cloudy: { min: 15, max: 25 },
    sunny: { min: 25, max: 40 },
  },
  ingredients: {
    ice: ingredient(0.01, 0, 1),
    sugar: ingredient(0.02, 5, 10),
    lemons: ingredient(0.05, 3, 7),
    cups: ingredient(0.04, 30, 31, true),
  },
})

const empty = (): InventoryLine => ({ total: 0, batches: [], expected_loss_tonight: 0 })

export const planningState = (over: Partial<GameState> = {}): GameState => ({
  game_id: 'g1',
  day: 1,
  num_days: 7,
  phase: 'planning',
  cash: 100,
  today: { weather: 'sunny', temperature: 30 },
  popularity: 0.5,
  inventory: { ice: empty(), sugar: empty(), lemons: empty(), cups: empty() },
  days: [],
  last_day_events: [],
  config: defaultConfig(),
  persisted: false,
  public_id: null,
  summary: null,
  ...over,
})
