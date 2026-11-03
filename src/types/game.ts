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

/**
 * Every bound the server enforces and the client shows, from `core/limits.public_limits()`
 * (sent in `GET /config/defaults` and in every game state). Ranges are inclusive, except
 * `price_tolerance_above`, which must be above its minimum.
 */
export interface Limits {
  num_days: Range
  starting_cash: Range
  /** Units of one ingredient in a cup, for the recipe ranges (and so every favourite amount). */
  per_cup: Range
  /** °C, for the temperature range and every weather's range. */
  temperature: Range
  /** Opening hours (and so every favourite hour). */
  hour: Range
  /** The cup price range. */
  price: Range
  quality_swing: Range
  starting_popularity: Range
  spawn_per_hour: Range
  average_expense: Range
  /** Ingredient tolerances, in units per cup. */
  tolerance: Range
  price_tolerance_below: Range
  price_tolerance_above: Range
  weather_multiplier: Range
  unit_cost: Range
  /** Pack sizes on sale per ingredient. */
  packs: Range
  pack_size: Range
  pack_discount: Range
  fresh_days: Range
  max_days: Range
  /** Packs of one size bought in a day. */
  packs_per_size: Range
  /** The price input's step, and the what-if curve's price grid. */
  price_step: number
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
  /**
   * What the cups sold cost, oldest stock first at the price paid. On a day with no sales,
   * what the cups you could have made would have cost; null with nothing to make a cup from.
   * Games stored before this rule hold the list price on days with no sales.
   */
  cost_per_cup: number | null
  purchased: Record<IngredientName, number>
  spend: number
  revenue: number
  /** Cash result: revenue minus everything bought today, even stock used on later days. */
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
  limits: Limits
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

/**
 * The state as round events send it (`day_result`, `game_state` after `ack_day`): the history
 * is left out so a day's events do not grow with the game. The client keeps the days it holds,
 * appends `day_result.record`, and takes the summary from `game_finished`.
 */
export type DailyGameState = Omit<GameState, 'days' | 'last_day_events' | 'summary'>

// ---- socket payloads (server -> client)
export interface GameCreatedEvent { seq: number; game_id: string; session_token: string }
/** `full` states (start, resync, request_state) carry the history; daily ones (after ack_day) do not. */
export type GameStateEvent = { seq: number; full: true; state: GameState } | { seq: number; full: false; state: DailyGameState }
export interface DayResultEvent {
  seq: number
  day: number
  record: DayRecord
  events: CustomerEvent[]
  duplicate: boolean
  state: DailyGameState
}
export interface GameFinishedEvent { seq: number; summary: GameSummary }
export interface GamePersistedEvent { seq: number; public_id: string }
/** The finished game could not be saved yet; `retry_persist` tries again. */
export interface GamePersistFailedEvent { seq: number }
export interface ServerErrorEvent { code: string; message: string }

/** The what-if curve for the morning plan. Per-price lists are aligned with `prices`. No `seq`: a request-scoped reply. */
export interface PlanPreviewOk {
  request_id: string
  day: number
  prices: number[]
  chance: number[]
  expected_visitors: number
  expected_cups: number[]
  /** expected cups × (price − cost_per_cup). */
  expected_margin: number[]
  /** The cups the stock plus the planned packs make with this recipe. */
  cups_possible: number
  /** Their average cost (the one meaning of cost per cup); null when not a single cup can be made. */
  cost_per_cup: number | null
}
export interface PlanPreviewRefused {
  request_id: string
  day: number | null
  error: { code: string; message: string }
}
export type PlanPreviewEvent = PlanPreviewOk | PlanPreviewRefused

/** What the client sends with `preview_plan`, beside `request_id`, `game_id` and `day`. */
export interface PlanPreviewRequest {
  purchases: DayPlanPayload['purchases']
  recipe: DayPlanPayload['recipe']
}
