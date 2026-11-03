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

/** A pack on sale as the server prices it (`ingredients.pack_offers`): what a purchase charges. */
export interface PackOffer {
  size: number
  discount: number
  price: number
  /** Price per unit of this pack. */
  unit_price: number
  /** What the discount takes off the list price. */
  saving: number
  /** The size of a smaller pack that is cheaper per unit, or null. */
  dearer_than: number | null
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
  /**
   * Customers the busiest day of a config may expect: no single field, but what the traffic
   * fields add up to. `ConfigPreview.customers_per_day` is the config's own figure. Absent from
   * a backend older than 2026-11-03 (the frontend deploys first), so every reader checks it.
   */
  customers_per_day?: Range
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
  /** After this visitor: the sales so far, the stock left and the cups it still makes. Absent on days played before the server sent them. */
  sales?: number
  stock?: Record<IngredientName, number>
  cups_left?: number
}

export interface TypeStats {
  visitors: number
  buyers: number
  sold_out: number
  /** Buyers ÷ visitors (server); null with no visitors. */
  conversion: number | null
}

export interface HourStats {
  hour: number
  visitors: number
  buyers: number
  sold_out: number
  /** Visitors who said no (server). */
  refused: number
  /** Buyers ÷ visitors (server); null with no visitors. */
  conversion: number | null
}

/** One opening hour over every day of a game (server `summary.hour_totals`). */
export interface HourTotal {
  hour: number
  visitors: number
  buyers: number
  not_bought: number
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
  /** What that popularity multiplied every buy chance by; null without a popularity. */
  popularity_factor: number | null
  perished: Record<IngredientName, number>
  perished_value: number
  /** The cash the day began with (the day before's `cash_end`). */
  cash_start: number
  cash_end: number
  /** Stock when the stand opened, the day's packs included; absent on days stored before it was kept. */
  inventory_open?: Record<IngredientName, number>
  /** The cups that opening stock made; null without it. */
  cups_open: number | null
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
  /** What that popularity multiplies every buy chance by. */
  popularity_factor: number
  inventory: Record<IngredientName, InventoryLine>
  /** The packs on sale, priced by the server. */
  packs: Record<IngredientName, PackOffer[]>
  /** Where the plan screen starts: the last day's price and recipe, else the server's opening plan. */
  suggested_plan: { price: number; recipe: Record<RecipeIngredient, number> }
  days: DayRecord[]
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
  /** All cups sold ÷ all visitors; null with no visitors. */
  conversion: number | null
  /** Popularity after the last day; null on games finished before popularity existed. */
  final_popularity?: number | null
  /** The popularity that leaves buy chances as price and recipe make them. */
  neutral_popularity: number
  perished_totals: Record<IngredientName, number>
  /** What spoilage cost over the game. */
  total_perished_value: number
  hour_totals: HourTotal[]
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
export type DailyGameState = Omit<GameState, 'days' | 'summary'>

// ---- socket payloads (server -> client)
export interface GameCreatedEvent { seq: number; game_id: string; session_token: string }
/** `full` states (start, resync, request_state) carry the history; daily ones (after ack_day) do not. */
export type GameStateEvent = { seq: number; full: true; state: GameState } | { seq: number; full: false; state: DailyGameState }
export interface DayResultEvent {
  seq: number
  day: number
  record: DayRecord
  /**
   * Every customer of the day, in arrival order, for the playback. Sent once, with the result
   * of the submission that played the day; the server keeps no copy. `null` means "not
   * available" (a day sent again, `duplicate: true`): skip the replay and open the report.
   */
  events: CustomerEvent[] | null
  duplicate: boolean
  state: DailyGameState
}
export interface GameFinishedEvent { seq: number; summary: GameSummary }
export interface GamePersistedEvent { seq: number; public_id: string }
/** The finished game could not be saved yet; `retry_persist` tries again. */
export interface GamePersistFailedEvent { seq: number }
export interface ServerErrorEvent { code: string; message: string }

/** The what-if figures at the player's own price. */
export interface PricePoint {
  chance: number
  expected_cups: number
  expected_margin: number
  /** Price minus cost per cup; null when not a single cup can be made. */
  margin_per_cup: number | null
  /** Its share of the price; null without a cost or at a price of 0. */
  margin_share: number | null
}

/** The what-if curve and every figure of the morning plan. Per-price lists are aligned with `prices`. No `seq`: a request-scoped reply. */
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
  /** What the planned packs cost, and the cash left after paying for them. */
  spend: number
  cash_after: number
  /** Units each ingredient's planned packs add. */
  units: Record<IngredientName, number>
  /** Per ingredient and pack size: whether one more of that pack passes the server's purchase rules and fits the cash. */
  can_add: Record<IngredientName, Record<string, boolean>>
  /** With a price in the request: the price charged (to the cent), the server's objection to it, and the curve at it. */
  price?: number | null
  price_error?: string | null
  at_price?: PricePoint | null
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
  price: number
}

// ---- POST /config/preview (backend core/config_preview.py)

/** One ingredient's figures, from its own settings. */
export interface IngredientPreview {
  packs: PackOffer[]
  smallest: PackOffer
  biggest: PackOffer
  /** Units of the biggest pack you must use for it to beat the smallest; null with one size. */
  break_even_units: number | null
  /** `hazard[n - 1]`: the chance a unit spoils on night n (nights 1–30). */
  hazard: number[]
  /** `survival[n]`: the share of a batch still good after n nights (0–30). */
  survival: number[]
  example_batch: { size: number; after: { night: number; left: number }[] }
}

export interface PlanExample {
  price: number
  recipe: Record<RecipeIngredient, number>
}

export interface CupCostExample {
  purchases: DayPlanPayload['purchases']
  spend: number
  cups_possible: number
  cost_per_cup: number | null
  /** Starting cash ÷ spend; null when the packs cost nothing. */
  covers: number | null
  /** The sample price minus the cost per cup. */
  margin_per_cup: number | null
}

export interface PersonHelp {
  /** Aligned with `grids.hours`. */
  hour_score: number[]
  /** Aligned with `grids.temperatures`. */
  temperature_score: number[]
  /** Aligned with `grids.per_cup[ingredient]`. */
  ingredient_score: Record<RecipeIngredient, number[]>
  /** Chance to buy the typical recipe at each of `grids.prices`. */
  typical_chance: number[]
  /** Each type's chance to buy this type's favourite cup at each of `grids.prices`. */
  favourite_chance: Record<PersonType, number[]>
  /** Expected visitors per hour (`grids.hours`), each weather at its typical temperature. */
  spawn: Record<Weather, number[]>
  /** Expected visitors at the favourite hour, by weather. */
  preferred_hour_spawn: Record<Weather, number>
  wtp_best: number
  wtp_worst: number
  cheap_floor: number
  price_reach: number
  sure_price: number
  long_shot_price: number
  favourite_probes: { price: number; chance: number }[]
  favourite_at_budget: number
  worked: { scores: Record<RecipeIngredient, number>; quality: number; wtp: number; chance: number; reason: string }
  /** The typical plan's chance at each of `grids.popularity`. */
  popularity_chance: number[]
}

export interface ConfigHelp {
  grids: { hours: number[]; temperatures: number[]; prices: number[]; per_cup: Record<RecipeIngredient, number[]>; popularity: number[] }
  plans: { sample: PlanExample; typical: PlanExample }
  weather: Record<Weather, { odds: number; expected_days: number; typical_temperature: number; day_visitors: number }>
  people: Record<PersonType, PersonHelp>
  quality_swing: { best: number; average: number; worst: number }
  popularity: { start_factor: number; probes: { popularity: number; factor: number; favourite_at_budget: Record<PersonType, number> }[] }
  cup_cost: { usage: Record<IngredientName, number>; smallest: CupCostExample; biggest: CupCostExample }
  pack_cash_share: Record<IngredientName, number[]>
}

export interface ConfigPreview {
  valid: boolean
  message: string | null
  /**
   * The most customers one day can expect (the server's safe upper bound), capped at
   * `limits.customers_per_day.max`. Sent whenever the config is valid apart from that cap,
   * so with `valid: false` it is the cap that refused the config (`message` says why);
   * null when anything else is invalid.
   */
  customers_per_day: number | null
  /** Null for an ingredient whose own settings are invalid. */
  ingredients: Record<IngredientName, IngredientPreview | null>
  /** Null unless the whole config is valid. */
  help: ConfigHelp | null
}
