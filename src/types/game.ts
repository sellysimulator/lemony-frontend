/** Wire types. Mirrors app/core (backend) — the server computes, the client renders. */

export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy'
export type PersonType = 'Child' | 'Teenager' | 'Adult' | 'Senior'
export type IngredientName = 'ice' | 'sugar' | 'lemons' | 'cups'
export type RecipeIngredient = 'ice' | 'sugar' | 'lemons'
export type Phase = 'planning' | 'played' | 'finished'
export type Outcome = 'bought' | 'refused' | 'sold_out'

export const WEATHER_TYPES: Weather[] = ['sunny', 'cloudy', 'rainy', 'snowy']
export const PERSON_TYPES: PersonType[] = ['Child', 'Teenager', 'Adult', 'Senior']
export const INGREDIENTS: IngredientName[] = ['ice', 'sugar', 'lemons', 'cups']
export const RECIPE_INGREDIENTS: RecipeIngredient[] = ['ice', 'sugar', 'lemons']

export interface Range {
  min: number
  max: number
}

/** How far below / above a preference a customer still accepts, down to a score of 0. */
export interface Tolerance {
  below: number
  above: number
}

/** Ingredients in units per cup; price as a share of the customer's budget. */
export type Tolerances = Record<RecipeIngredient | 'price', Tolerance>

export interface PersonPreferences {
  spawn_per_hour: number
  average_expense: number
  preferred_degrees: number
  preferred_weather: Weather
  preferred_ice: number
  preferred_sugar: number
  preferred_lemons: number
  preferred_hour: number
  tolerances: Tolerances
}

/** One pack on sale: `size` units at `unit_cost` each, less `discount` (0–0.9). */
export interface PackOption {
  size: number
  discount: number
}

export interface IngredientConfig {
  unit_cost: number
  packs: PackOption[]
  fresh_days: number
  max_days: number
  never_perishes: boolean
}

export interface GameConfig {
  num_days: number
  starting_cash: number
  min_max_values: Record<RecipeIngredient | 'temperature' | 'hour' | 'price', Range>
  /** How much the recipe moves what customers will pay (0–1). */
  quality_swing: number
  /** Popularity before the first day with visitors (0–1); buy chances scale by 0.5 + popularity. */
  starting_popularity: number
  people_preferences: Record<PersonType, PersonPreferences>
  weather_multipliers: Record<Weather, number>
  weather_temperature_ranges: Record<Weather, Range>
  ingredients: Record<IngredientName, IngredientConfig>
}

export interface BatchView {
  qty: number
  age: number
  /** Price paid per unit (after the pack discount). */
  unit_cost: number
  risk_tonight: number
}

export interface InventoryLine {
  total: number
  batches: BatchView[]
  expected_loss_tonight: number
}

export interface CustomerEvent {
  id: number
  type: PersonType
  arrive_min: number
  outcome: Outcome
  reason: string | null
  probability: number
}

export interface TypeStats {
  visitors: number
  buyers: number
  sold_out: number
}

export interface HourStats {
  hour: number
  visitors: number
  buyers: number
  sold_out: number
}

export interface DayRecord {
  day: number
  weather: Weather
  temperature: number
  price: number
  recipe: Record<RecipeIngredient, number>
  /** What the cups sold actually cost (discounts included); list price if none were sold. */
  cost_per_cup: number
  purchased: Record<IngredientName, number>
  spend: number
  revenue: number
  profit: number
  visitors: number
  buyers: number
  sold_out: number
  refused: number
  conversion: number
  /** Popularity applied to this day's buy chances; absent on games finished before popularity existed. */
  popularity?: number | null
  perished: Record<IngredientName, number>
  perished_value: number
  cash_end: number
  inventory_end?: Record<IngredientName, number>
  by_type: Record<PersonType, TypeStats>
  by_hour: HourStats[]
  refusal_reasons: Record<string, number>
}

export interface GameState {
  game_id: string
  day: number
  num_days: number
  phase: Phase
  cash: number
  today: { weather: Weather; temperature: number }
  /** Current popularity (0–1): what the next day played will use. */
  popularity: number
  inventory: Record<IngredientName, InventoryLine>
  days: DayRecord[]
  last_day_events: CustomerEvent[]
  config: GameConfig
  persisted: boolean
  public_id: string | null
  /** Present once the game is finished. */
  summary: GameSummary | null
}

export interface GameSummary {
  public_id?: string | null
  num_days: number
  days_played: number
  starting_cash: number
  final_cash: number
  total_profit: number
  total_revenue: number
  total_spend: number
  total_visitors: number
  total_buyers: number
  total_sold_out: number
  /** Popularity after the last day; null on games finished before popularity existed. */
  final_popularity?: number | null
  perished_totals: Record<IngredientName, number>
  days: DayRecord[]
  config?: GameConfig | null
  started_at?: string
  finished_at?: string
}

export interface DayPlanPayload {
  purchases: Partial<Record<IngredientName, Record<string, number>>>
  price: number
  recipe: Record<RecipeIngredient, number>
}

// ---- socket payloads (server -> client)
export interface GameCreatedEvent { seq: number; game_id: string; session_token: string }
export interface GameStateEvent { seq: number; state: GameState }
export interface DayResultEvent {
  seq: number
  day: number
  record: DayRecord
  events: CustomerEvent[]
  duplicate: boolean
  state: GameState
}
export interface GameFinishedEvent { seq: number; summary: GameSummary }
export interface GamePersistedEvent { seq: number; public_id: string }
export interface ServerErrorEvent { code: string; message: string }
