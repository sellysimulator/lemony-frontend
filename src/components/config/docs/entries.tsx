/**
 * Help for every configuration field, opened from the info buttons on the
 * config screen. Examples and charts are computed from the config being
 * edited, so they update as the player changes values.
 */
import type { ReactNode } from 'react'
import {
  INGREDIENTS,
  PERSON_TYPES,
  RECIPE_INGREDIENTS,
  WEATHER_TYPES,
  type GameConfig,
  type IngredientConfig,
  type PackOption,
  type IngredientName,
  type PersonPreferences,
  type PersonType,
  type RecipeIngredient,
  type Weather,
} from '../../../types/game'
import { money, pct, REASON_TEXT } from '../../../utils/format'
import {
  applyPopularity,
  buyDecision,
  buyProbability,
  cheapFloor,
  expectedSpawn,
  hazard,
  ingredientScore,
  midpoint,
  packPrice,
  refusalReason,
  score,
  steps,
  survival,
  weatherOdds,
  willingnessToPay,
  type Recipe,
  type ScoredRange,
} from '../../../game/configMath'
import { INGREDIENT_SERIES, PERSON_SERIES, WEATHER_SERIES } from '../../charts/chartSetup'
import { BarChart, Example, Formula, H, LineChart, List, Note, P, Table, WeatherBands, type Series } from './primitives'

export interface DocCtx {
  config: GameConfig
  person?: PersonType
  ingredient?: IngredientName
  weather?: Weather
}

interface Doc {
  title(ctx: DocCtx): string
  body(ctx: DocCtx): ReactNode
}

const UNIT: Record<RecipeIngredient, string> = { ice: 'ice cubes', sugar: 'spoons of sugar', lemons: 'lemons' }
const round2 = (n: number) => Math.round(n * 100) / 100
const roundTo = (n: number, step: number) => Math.round(n / step) * step
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function priceSteps(cfg: GameConfig): number[] {
  const r = cfg.min_max_values.price
  return steps(r, Math.max(0.05, roundTo((r.max - r.min) / 30, 0.05)))
}

function tempSteps(cfg: GameConfig): number[] {
  const r = cfg.min_max_values.temperature
  return steps(r, Math.max(1, Math.ceil((r.max - r.min) / 40)))
}

/** The temperature a "typical" day of this weather has: the middle of its range, inside the day's range. */
function typicalTemp(cfg: GameConfig, w: Weather): number {
  const t = cfg.min_max_values.temperature
  return Math.min(t.max, Math.max(t.min, midpoint(cfg.weather_temperature_ranges[w])))
}

function hours(cfg: GameConfig): number[] {
  return steps(cfg.min_max_values.hour, 1, 24)
}

/** One line per customer type for a factor's 0–1 score, with the selected type drawn thicker. */
function scoreSeries(cfg: GameConfig, factor: ScoredRange, xs: number[], selected?: PersonType): Series[] {
  return PERSON_TYPES.map((t) => ({
    label: t,
    color: PERSON_SERIES[t],
    emphasis: t === selected,
    muted: selected !== undefined && t !== selected,
    data: xs.map((x) => score(cfg, cfg.people_preferences[t], factor, x)),
  }))
}

/** One line per customer type for an ingredient's 0–1 score, from each type's own tolerances. */
function ingredientSeries(cfg: GameConfig, n: RecipeIngredient, xs: number[], selected?: PersonType): Series[] {
  return PERSON_TYPES.map((t) => ({
    label: t,
    color: PERSON_SERIES[t],
    emphasis: t === selected,
    muted: selected !== undefined && t !== selected,
    data: xs.map((x) => ingredientScore(cfg.people_preferences[t], n, x)),
  }))
}

/** One line per customer type: chance to buy at each price, for a given recipe. */
function chanceSeries(cfg: GameConfig, recipe: Recipe, xs: number[], selected?: PersonType): Series[] {
  return PERSON_TYPES.map((t) => ({
    label: t,
    color: PERSON_SERIES[t],
    emphasis: t === selected,
    muted: selected !== undefined && t !== selected,
    data: xs.map((x) => buyDecision(cfg, cfg.people_preferences[t], x, recipe).chance),
  }))
}

const favouriteRecipe = (p: PersonPreferences): Recipe => ({ ice: p.preferred_ice, sugar: p.preferred_sugar, lemons: p.preferred_lemons })

/** A plan in the middle of what customers like: the average favourite recipe and the average budget. */
function typicalPlan(cfg: GameConfig) {
  const mm = cfg.min_max_values
  const people = PERSON_TYPES.map((t) => cfg.people_preferences[t])
  const avg = (f: (p: PersonPreferences) => number) => people.reduce((sum, p) => sum + f(p), 0) / people.length
  const clamp = (v: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, v))
  const amount = (n: RecipeIngredient) => clamp(Math.round(avg((p) => p[`preferred_${n}`])), mm[n])
  return {
    price: round2(clamp(roundTo(avg((p) => p.average_expense), 0.05), mm.price)),
    recipe: { ice: amount('ice'), sugar: amount('sugar'), lemons: amount('lemons') },
  }
}

function samplePlan(cfg: GameConfig) {
  const mm = cfg.min_max_values
  return {
    price: round2(roundTo(midpoint(mm.price), 0.05)),
    recipe: { ice: Math.round(midpoint(mm.ice)), sugar: Math.round(midpoint(mm.sugar)), lemons: Math.round(midpoint(mm.lemons)) },
  }
}

function smallestPack(cfg: IngredientConfig): PackOption {
  return cfg.packs.reduce((a, b) => (b.size < a.size ? b : a))
}

/** A cup made entirely from each ingredient's biggest pack. */
function bulkCostPerCup(cfg: GameConfig, recipe: Record<RecipeIngredient, number>): number {
  const unit = (n: IngredientName) => {
    const ing = cfg.ingredients[n]
    const big = ing.packs.reduce((a, b) => (b.size > a.size ? b : a))
    return packPrice(ing, big) / big.size
  }
  return RECIPE_INGREDIENTS.reduce((sum, n) => sum + recipe[n] * unit(n), 0) + unit('cups')
}

function costPerCup(cfg: GameConfig, recipe: Record<RecipeIngredient, number>): number {
  return RECIPE_INGREDIENTS.reduce((sum, n) => sum + recipe[n] * cfg.ingredients[n].unit_cost, 0) + cfg.ingredients.cups.unit_cost
}

function refusal(cfg: GameConfig, t: PersonType, price: number, recipe: Recipe, scores: Recipe): string {
  return REASON_TEXT[refusalReason(cfg.people_preferences[t], price, recipe, scores)]
}

const KERNEL = 'score = max(0, 1 − |value − favourite| ÷ reach)\nreach = distance from the favourite to the FARTHER end of the allowed range'

const TOLERANCE_KERNEL = `score = max(0, 1 − |amount − favourite| ÷ tolerance)
tolerance = "below" if the cup has less than their favourite, "above" if more`

const BUY = `quality       = average(ice score, sugar score, lemons score)      // 0 to 1
would pay     = budget × (1 + quality swing × (2 × quality − 1))
chance to buy = 1 ÷ (1 + e^((price − would pay) ÷ spread))
spread        = price tolerance above × budget ÷ ln 19
if price < budget × (1 − price tolerance below): chance × price ÷ that floor`

/* ------------------------------------------------------------------ Game */

const game: Doc = {
  title: () => 'How a game works',
  body: ({ config }) => (
    <>
      <P>A game is a run of days. Every day follows the same loop:</P>
      <List
        items={[
          <><strong>Morning.</strong> The day’s temperature and weather are revealed. You buy ingredient packs, choose a recipe and set a cup price.</>,
          <><strong>Opening hours.</strong> Customers of four types walk by hour by hour. Each one decides to buy or not, based on your price and recipe.</>,
          <><strong>Report.</strong> You see sales, visitors, why people said no, and what you have left.</>,
          <><strong>Night.</strong> Perishable stock ages by one day and some of it may spoil.</>,
        ]}
      />
      <P>
        This card sets how long the game is and how much money you start with. Everything else on this screen defines the world the game is played in.
        This game lasts <strong>{config.num_days} days</strong> and starts with <strong>{money(config.starting_cash)}</strong>.
      </P>
    </>
  ),
}

const numDays: Doc = {
  title: () => 'Number of days',
  body: ({ config }) => {
    const odds = weatherOdds(config)
    return (
      <>
        <P>How many days the game lasts, from 1 to 30. Each day you plan in the morning, then watch the day play out.</P>
        <H>How it affects the game</H>
        <List
          items={[
            'Each day’s temperature is drawn again, independently of earlier days, so more days means the weather evens out towards its long-run odds.',
            'Longer games give you more time to learn what each customer type wants and to recover from a bad day.',
            'Spoilage matters more in long games: stock you over-buy keeps ageing night after night.',
            'Final results add up every day, so totals naturally grow with the number of days.',
          ]}
        />
        <Example title={`What ${config.num_days} days look like with your weather`}>
          The expected number of days of each weather, from your temperature range and weather ranges:
          <Table
            head={['Weather', 'Chance per day', `Expected days in ${config.num_days}`]}
            rows={WEATHER_TYPES.map((w) => [cap(w), pct(odds[w]), (odds[w] * config.num_days).toFixed(1)])}
          />
        </Example>
      </>
    )
  },
}

const startingCash: Doc = {
  title: () => 'Starting cash',
  body: ({ config }) => {
    const plan = samplePlan(config)
    const cup = costPerCup(config, plan.recipe)
    const basket = INGREDIENTS.reduce((sum, n) => sum + packPrice(config.ingredients[n], smallestPack(config.ingredients[n])), 0)
    return (
      <>
        <P>The money you have on the morning of day 1. There are no loans: you can never spend more than you have on ingredients.</P>
        <Formula>cash tomorrow = cash today − ingredients bought + cups sold × price</Formula>
        <H>How it affects the game</H>
        <List
          items={[
            'Low cash forces small purchases, so you may sell out on a busy day.',
            'High cash lets you stock up, but over-buying perishable goods turns into spoilage.',
            'You buy whole packs, so the smallest pack of each ingredient sets the minimum you can spend to make any lemonade at all.',
          ]}
        />
        <Example>
          The cheapest way to have some of everything is the smallest pack of each ingredient: <strong>{money(basket)}</strong>. Your{' '}
          {money(config.starting_cash)} covers that <strong>{basket > 0 ? (config.starting_cash / basket).toFixed(1) : '∞'}×</strong>.
          <br />
          At list prices, a mid-range recipe ({plan.recipe.ice} ice, {plan.recipe.sugar} sugar, {plan.recipe.lemons} lemons, plus a cup) costs{' '}
          <strong>{money(cup)}</strong> per cup, so your starting cash is worth about <strong>{cup > 0 ? Math.floor(config.starting_cash / cup) : '∞'} cups</strong>{' '}
          of ingredients. Pack discounts stretch that further.
        </Example>
      </>
    )
  },
}

/* ------------------------------------------------------ Hours, temp, price */

const hoursSection: Doc = {
  title: () => 'Hours, temperature and price',
  body: () => (
    <>
      <P>These three ranges set the limits of each day.</P>
      <P>
        The hour and temperature ranges also set how strongly customers react to them. A customer scores the hour and the temperature from 0 to 1: 1 at their
        favourite value, dropping in a straight line to 0 at the far end of the allowed range. Those scores change how many people come out, not whether they
        buy.
      </P>
      <Formula>{KERNEL}</Formula>
      <P>
        So <strong>widening the hour or temperature range makes customers more tolerant</strong> (the slope is gentler), and narrowing it makes them
        stricter. The price range only limits what you may charge: how customers react to a price comes from their own budget and price tolerance.
      </P>
    </>
  ),
}

const hour: Doc = {
  title: () => 'Opening hours',
  body: ({ config }) => {
    const h = config.min_max_values.hour
    const xs = hours(config)
    return (
      <>
        <P>
          The stand opens at the first hour and closes when the last hour ends. With {h.min}–{h.max} it is open from{' '}
          <strong>{h.min}:00 to {h.max + 1}:00</strong>, which is {Math.max(0, h.max - h.min + 1)} hourly slots. Customers arrive spread evenly within each hour.
        </P>
        <H>How it affects the game</H>
        <List
          items={[
            'More hours means more foot traffic in total.',
            'Each customer type has a favourite hour. Its visitor bonus is highest at that hour and fades towards the far end of the opening hours.',
            'Every customer type’s favourite hour must fall inside the opening hours.',
          ]}
        />
        <LineChart
          title="Hour score per customer type"
          labels={xs.map((x) => `${x}:00`)}
          series={scoreSeries(config, 'hour', xs)}
          xLabel="Hour"
          yLabel="Hour score"
          fmt="percent"
        />
        <P>The hour score is one third of a customer type’s visitor bonus (see “Base visitors / hour”). It changes how many people come, not whether they buy.</P>
      </>
    )
  },
}

const temperature: Doc = {
  title: () => 'Temperature range',
  body: ({ config }) => {
    const t = config.min_max_values.temperature
    const xs = tempSteps(config)
    const odds = weatherOdds(config)
    return (
      <>
        <P>
          Each morning a temperature is drawn at random, with every value from {t.min}°C to {t.max}°C equally likely, rounded to 0.5°C. It stays the same all
          day.
        </P>
        <H>How it affects the game</H>
        <List
          items={[
            'The temperature decides the weather: the day gets whichever weather’s temperature range contains it.',
            'Each customer type has a favourite temperature. The closer the day is to it, the more of them come out.',
            'A wider range means more varied days and makes customers more tolerant of temperatures away from their favourite.',
          ]}
        />
        <LineChart
          title="Temperature score per customer type"
          labels={xs.map((x) => `${x}°`)}
          series={scoreSeries(config, 'temperature', xs)}
          xLabel="Temperature °C"
          yLabel="Temperature score"
          fmt="percent"
        />
        <Example title="Weather odds with this range">
          <Table head={['Weather', 'Chance per day']} rows={WEATHER_TYPES.map((w) => [cap(w), pct(odds[w])])} />
        </Example>
      </>
    )
  },
}

const price: Doc = {
  title: () => 'Cup price range',
  body: ({ config }) => {
    const r = config.min_max_values.price
    const xs = priceSteps(config)
    const plan = typicalPlan(config)
    return (
      <>
        <P>
          The lowest and highest price you may charge for a cup, currently {money(r.min)} to {money(r.max)}. Every customer type’s budget (“Expects to pay”)
          must fall inside it.
        </P>
        <H>How it affects the game</H>
        <P>
          The range only limits your choice. How fast customers lose interest as the price rises comes from each type’s budget, price tolerance and how much
          they like your recipe (see “Customers”).
        </P>
        <LineChart
          title={`Chance to buy at each price, with ${plan.recipe.ice} ice, ${plan.recipe.sugar} sugar, ${plan.recipe.lemons} lemons`}
          labels={xs.map((x) => `$${x.toFixed(2)}`)}
          series={chanceSeries(config, plan.recipe, xs)}
          xLabel="Cup price"
          yLabel="Chance to buy"
          fmt="percent"
        />
        <Note>A very high maximum lets you price everyone out; a very low minimum lets you sell at a loss or look suspiciously cheap.</Note>
      </>
    )
  },
}

/* ---------------------------------------------------------------- Recipe */

const recipeSection: Doc = {
  title: () => 'Recipe limits',
  body: ({ config }) => (
    <>
      <P>How much of each ingredient a single cup may contain. These are the limits of the recipe sliders on the planning screen.</P>
      <List
        items={RECIPE_INGREDIENTS.map((n) => (
          <>
            {cap(n)}: {config.min_max_values[n].min} to {config.min_max_values[n].max} {UNIT[n]} per cup.
          </>
        ))}
      />
      <P>
        Every customer type has a favourite amount of each ingredient, and it must fall inside these limits. The limits do not change how picky customers are:
        each type has its own tolerance for a cup with less or more than its favourite.
      </P>
    </>
  ),
}

function recipeRange(n: RecipeIngredient): Doc {
  return {
    title: () => `${cap(n)} per cup`,
    body: ({ config }) => {
      const r = config.min_max_values[n]
      const xs = steps(r)
      return (
        <>
          <P>
            The fewest and most {UNIT[n]} you can put in one cup: currently {r.min} to {r.max}. More {n} per cup also costs more per cup (
            {money(config.ingredients[n].unit_cost)} each).
          </P>
          <LineChart
            title={`${cap(n)} score per customer type`}
            labels={xs}
            series={ingredientSeries(config, n, xs)}
            xLabel={`${cap(n)} per cup`}
            yLabel="Score"
            fmt="percent"
          />
          <Example>
            <Table
              head={['Customer', 'Favourite', `Score at ${r.min}`, `Score at ${r.max}`]}
              rows={PERSON_TYPES.map((t) => {
                const p = config.people_preferences[t]
                return [t, p[`preferred_${n}`], pct(ingredientScore(p, n, r.min)), pct(ingredientScore(p, n, r.max))]
              })}
            />
          </Example>
          <Note>If you narrow the range so it no longer contains a customer type’s favourite amount, the configuration becomes invalid.</Note>
        </>
      )
    },
  }
}

/* --------------------------------------------------------------- Weather */

const weatherSection: Doc = {
  title: () => 'Weather',
  body: ({ config }) => {
    const odds = weatherOdds(config)
    return (
      <>
        <P>Weather is decided in two steps each morning, and then changes how many people come out:</P>
        <Formula>{`1. temperature ~ uniform(${config.min_max_values.temperature.min}°C, ${config.min_max_values.temperature.max}°C), rounded to 0.5°C
2. weather     = the type whose temperature range contains it
                 (random pick if ranges overlap)
3. visitors    × that weather's traffic multiplier`}</Formula>
        <WeatherBands config={config} />
        <P>Together the ranges must cover the whole temperature range with no gaps. Overlaps are allowed.</P>
        <BarChart
          title="Chance of each weather per day"
          labels={WEATHER_TYPES.map(cap)}
          series={[{ label: 'Chance', data: WEATHER_TYPES.map((w) => odds[w]), color: WEATHER_SERIES.sunny }]}
          xLabel="Weather"
          yLabel="Chance"
          fmt="percent"
        />
        <P>The weather types are fixed; their values are yours to tune.</P>
      </>
    )
  },
}

/** Expected visitors over a whole day of this weather, all types together, on a typical temperature for it. */
function dayVisitors(cfg: GameConfig, w: Weather): number {
  const t = typicalTemp(cfg, w)
  return hours(cfg).reduce((sum, h) => sum + PERSON_TYPES.reduce((s, k) => s + expectedSpawn(cfg, cfg.people_preferences[k], h, w, t), 0), 0)
}

const trafficMultiplier: Doc = {
  title: ({ weather }) => `Traffic multiplier${weather ? ` (${weather})` : ''}`,
  body: ({ config, weather = 'sunny' }) => {
    const m = config.weather_multipliers[weather]
    return (
      <>
        <P>
          Scales how many people go out in this weather. It applies to every customer type, after their preference bonus. 1.0 is normal traffic, 0.5 is half,
          0.2 is one fifth. It can go up to 3.
        </P>
        <Formula>expected visitors per hour = base × (1 + bonus) × multiplier</Formula>
        <P>
          In {weather} weather the multiplier is <strong>×{m}</strong>, so every customer type shows up at {pct(m)} of the rate it would with a multiplier of 1.
        </P>
        <BarChart
          title="Expected visitors over a whole day, all customer types"
          labels={WEATHER_TYPES.map(cap)}
          series={[{ label: 'Visitors', data: WEATHER_TYPES.map((w) => round2(dayVisitors(config, w))), color: WEATHER_SERIES[weather] }]}
          xLabel="Weather (at the middle of its temperature range)"
          yLabel="Visitors"
        />
        <P>
          The chart includes each type’s preference bonus, so two weathers with the same multiplier can still differ: a weather that more customer types like,
          at a temperature they like, draws a bigger crowd.
        </P>
      </>
    )
  },
}

const weatherRange: Doc = {
  title: ({ weather }) => `Temperature range${weather ? ` (${weather})` : ''}`,
  body: ({ config, weather = 'sunny' }) => {
    const odds = weatherOdds(config)
    const r = config.weather_temperature_ranges[weather]
    return (
      <>
        <P>
          The temperatures that produce {weather} weather: currently {r.min}°C to {r.max}°C. After the day’s temperature is drawn, the weather is whichever
          type’s range contains it. If two ranges overlap, one of the matching weathers is picked at random.
        </P>
        <WeatherBands config={config} />
        <Example>
          With these ranges, a day is {weather} with a chance of <strong>{pct(odds[weather])}</strong>, which is about{' '}
          <strong>{(odds[weather] * config.num_days).toFixed(1)}</strong> of your {config.num_days} days.
        </Example>
        <Note>The ranges together must cover the whole temperature range with no gaps, or the configuration is invalid.</Note>
      </>
    )
  },
}

/* ------------------------------------------------------------- Customers */

const customersSection: Doc = {
  title: () => 'Customers',
  body: ({ config }) => {
    const plan = typicalPlan(config)
    const rows = PERSON_TYPES.map((t) => {
      const d = buyDecision(config, config.people_preferences[t], plan.price, plan.recipe)
      return { t, ...d, reason: refusal(config, t, plan.price, plan.recipe, d.scores) }
    })
    return (
      <>
        <P>Four customer types walk past the stand. Each has its own favourite hour, temperature, weather, budget and recipe. Two things are simulated for them:</P>
        <H>1. How many come</H>
        <Formula>{`bonus    = average(weather match (0 or 1), hour score, temperature score)
expected = base visitors × (1 + bonus) × weather multiplier
count    = random (Poisson) around expected`}</Formula>
        <P>The bonus is between 0 and 1, so on a perfect day a type brings up to twice its base visitors (before the weather multiplier).</P>
        <H>2. Whether each one buys</H>
        <P>
          Your recipe sets what a customer is willing to pay, and your price is compared against it. Each ingredient scores 1 at their favourite amount and
          falls in a straight line to 0 at their tolerance below or above it. A cup they love raises what they would pay above their budget; a cup they dislike
          lowers it.
        </P>
        <Formula>{BUY}</Formula>
        <P>
          Half of a type buys when you charge exactly what they would pay. The chance climbs as you go under it and falls as you go over it, reaching about 5%
          one “price tolerance above” past it.
        </P>
        <P>
          When someone says no, the reason is “too cheap” if the price looked suspicious. Otherwise it is “too pricey” if the price is further over their budget
          (counted in price tolerances) than their least favourite ingredient is from perfect, or else that ingredient.
        </P>
        <H>3. How popular the stand is</H>
        <P>
          Every chance to buy is then multiplied by 0.5 + popularity (never above 100%). Popularity is the average share of visitors who bought on the days so
          far and starts at {pct(config.starting_popularity)} (see “Starting popularity”). The example below is at a neutral 50%.
        </P>
        <Example title={`Worked example: ${money(plan.price)} with ${plan.recipe.ice} ice, ${plan.recipe.sugar} sugar, ${plan.recipe.lemons} lemons`}>
          <Table
            head={['Customer', 'Ice', 'Sugar', 'Lemons', 'Quality', 'Would pay', 'Chance to buy', 'Most likely “no”']}
            rows={rows.map((r) => [
              r.t,
              pct(r.scores.ice),
              pct(r.scores.sugar),
              pct(r.scores.lemons),
              pct(r.quality),
              money(r.wtp),
              <strong key="c">{pct(r.chance)}</strong>,
              r.reason,
            ])}
          />
        </Example>
        <BarChart
          title="Chance to buy for the example plan"
          labels={PERSON_TYPES}
          series={[{ label: 'Chance to buy', data: rows.map((r) => r.chance), color: PERSON_SERIES.Child }]}
          xLabel="Customer type"
          yLabel="Chance"
          fmt="percent"
        />
        <P>The customer types are fixed; their values are yours to tune.</P>
      </>
    )
  },
}

const qualitySwing: Doc = {
  title: () => 'Recipe effect on price',
  body: ({ config }) => {
    const s = config.quality_swing
    const adult = config.people_preferences.Adult
    return (
      <>
        <P>
          How much your recipe moves what customers are willing to pay, from 0 to 1. With {s}, a cup a customer loves (quality 100%) makes them pay up to{' '}
          <strong>{pct(1 + s)}</strong> of their budget, an average cup {pct(1)}, and a cup they dislike in every way <strong>{pct(1 - s)}</strong>.
        </P>
        <Formula>would pay = budget × (1 + quality swing × (2 × quality − 1))</Formula>
        <List
          items={[
            '0 means the recipe never changes what people pay: only price matters for whether they buy.',
            'Higher values reward a recipe tuned to your customers with room to charge more, and punish a poor recipe harder.',
          ]}
        />
        <Example>
          Adults have a budget of {money(adult.average_expense)}: they would pay {money(willingnessToPay(config, adult, 1))} for their favourite cup and{' '}
          {money(willingnessToPay(config, adult, 0))} for one they dislike in every way.
        </Example>
      </>
    )
  },
}

const POPULARITY_STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

const startingPopularity: Doc = {
  title: () => 'Starting popularity',
  body: ({ config }) => {
    const s = config.starting_popularity
    const plan = typicalPlan(config)
    const chances = PERSON_TYPES.map((t) => buyDecision(config, config.people_preferences[t], plan.price, plan.recipe).chance)
    const adult = config.people_preferences.Adult
    const adultChance = buyProbability(adult, adult.average_expense, willingnessToPay(config, adult, 1))
    const probes = [...new Set([0, 0.25, 0.5, 0.75, 1, s])].sort((a, b) => a - b)
    return (
      <>
        <P>
          Popularity is how well liked your stand is, from 0 (0%) to 1 (100%). It carries over from day to day and multiplies every customer’s chance to buy, on
          top of what your price and recipe give. This is where it starts: with {s}, day 1’s chances are multiplied by <strong>×{(0.5 + s).toFixed(2)}</strong>.
        </P>
        <H>How it changes</H>
        <Formula>{`success rate = cups sold ÷ visitors                      // one day, 0 to 1
popularity   = average(success rate of every day so far that had visitors)
             = starting popularity, until a day has had visitors`}</Formula>
        <List
          items={[
            'It is worked out each morning from the days already played, then holds for the whole day.',
            'Visitors who find you sold out count as not sold, so running out of stock lowers popularity.',
            'Days with no visitors are skipped: they say nothing about how well liked you are.',
            'Every day counts the same, so in a long game one day moves popularity less and less.',
          ]}
        />
        <H>How it changes sales</H>
        <Formula>{`chance to buy = price-and-recipe chance × (0.5 + popularity)      // at most 100%`}</Formula>
        <List
          items={[
            '0.5 (50%) is neutral: customers buy exactly as price and recipe say.',
            'At 0 every chance is halved; at 1 every chance is raised by half.',
            'It feeds itself: sell to more than half your visitors and popularity rises, lifting tomorrow’s chances; sell to fewer and it sinks.',
          ]}
        />
        <LineChart
          title={`Chance to buy ${money(plan.price)} with ${plan.recipe.ice} ice, ${plan.recipe.sugar} sugar, ${plan.recipe.lemons} lemons, by popularity`}
          labels={POPULARITY_STEPS.map((x) => pct(x))}
          series={PERSON_TYPES.map((t, i) => ({ label: t, data: POPULARITY_STEPS.map((x) => applyPopularity(chances[i], x)), color: PERSON_SERIES[t] }))}
          xLabel="Popularity"
          yLabel="Chance to buy"
          fmt="percent"
        />
        <Example>
          <Table
            head={['Popularity', 'Multiplier', 'Adult buys their favourite cup at their budget']}
            rows={probes.map((x) => [
              x === s ? <strong key="p">{pct(x)} (start)</strong> : pct(x),
              `×${(0.5 + x).toFixed(2)}`,
              pct(applyPopularity(adultChance, x)),
            ])}
          />
        </Example>
        <Note>Must be between 0 and 1. The default, 0.5, makes day 1 play exactly on price and recipe.</Note>
      </>
    )
  },
}

const spawnPerHour: Doc = {
  title: ({ person }) => `Base visitors / hour${person ? ` (${person})` : ''}`,
  body: ({ config, person = 'Child' }) => {
    const p = config.people_preferences[person]
    const xs = hours(config)
    const best = expectedSpawn(config, p, p.preferred_hour, p.preferred_weather, typicalTemp(config, p.preferred_weather))
    return (
      <>
        <P>
          The base number of {person.toLowerCase()} customers walking by each hour. The real number is random and grows when conditions match what they like.
        </P>
        <Formula>{`bonus    = average(weather match, hour score, temperature score)   // 0 to 1
expected = ${p.spawn_per_hour} × (1 + bonus) × weather multiplier
count    ~ Poisson(expected)`}</Formula>
        <List
          items={[
            'Base 0 means this type never shows up.',
            'On a perfect hour (favourite hour, weather and temperature) the bonus is 1, which doubles the base.',
            'The count is random: with an expected 4 visitors, an hour typically sees anything from 2 to 6.',
          ]}
        />
        <LineChart
          title={`Expected ${person.toLowerCase()} visitors per hour, by weather`}
          labels={xs.map((x) => `${x}:00`)}
          series={WEATHER_TYPES.map((w) => ({
            label: `${cap(w)} (${typicalTemp(config, w)}°C)`,
            color: WEATHER_SERIES[w],
            emphasis: w === p.preferred_weather,
            data: xs.map((h) => round2(expectedSpawn(config, p, h, w, typicalTemp(config, w)))),
          }))}
          xLabel="Hour"
          yLabel="Visitors / hour"
        />
        <Example>
          At {p.preferred_hour}:00 on a {p.preferred_weather} day at {typicalTemp(config, p.preferred_weather)}°C, expect about{' '}
          <strong>{best.toFixed(1)}</strong> {person.toLowerCase()} visitors that hour.
        </Example>
      </>
    )
  },
}

const averageExpense: Doc = {
  title: ({ person }) => `Expects to pay${person ? ` (${person})` : ''}`,
  body: ({ config, person = 'Child' }) => {
    const p = config.people_preferences[person]
    const r = config.min_max_values.price
    const xs = priceSteps(config)
    const fav = favouriteRecipe(p)
    const best = willingnessToPay(config, p, 1)
    const probes = [...new Set([cheapFloor(p), p.average_expense, best, r.max].map((x) => round2(Math.min(r.max, Math.max(r.min, x)))))]
    return (
      <>
        <P>
          The budget of a {person.toLowerCase()}: what they would pay for an average cup, {money(p.average_expense)}. A recipe they like raises what they would
          pay, one they dislike lowers it (see “Recipe effect on price”). For their favourite cup they would pay {money(best)}.
        </P>
        <List
          items={[
            'Half of them buy at exactly what they would pay; more buy below it, fewer above.',
            `Under ${money(cheapFloor(p))} the cup looks suspiciously cheap, and fewer buy the cheaper it gets (see “Price tolerance”).`,
            'The chances below are at a neutral popularity of 50%; popularity scales them up or down (see “Starting popularity”).',
            'It must fall inside the cup price range.',
          ]}
        />
        <LineChart
          title="Chance to buy their favourite cup"
          labels={xs.map((x) => `$${x.toFixed(2)}`)}
          series={chanceSeries(config, fav, xs, person)}
          xLabel="Cup price"
          yLabel="Chance to buy"
          fmt="percent"
        />
        <Example>
          <Table head={['You charge', 'Chance to buy their favourite cup']} rows={probes.map((x) => [money(x), pct(buyProbability(p, x, best))])} />
        </Example>
      </>
    )
  },
}

function priceToleranceDoc(): Doc {
  return {
    title: ({ person }) => `Price tolerance${person ? ` (${person})` : ''}`,
    body: ({ config, person = 'Child' }) => {
      const p = config.people_preferences[person]
      const t = p.tolerances.price
      const best = willingnessToPay(config, p, 1)
      return (
        <>
          <P>How a {person.toLowerCase()} reacts to your price, as shares of their budget ({money(p.average_expense)}).</P>
          <List
            items={[
              <>
                <strong>Below ({pct(t.below)}).</strong> A price more than {pct(t.below)} under their budget looks suspicious: under{' '}
                {money(cheapFloor(p))} the chance to buy shrinks in proportion to the price, and the day report says “{REASON_TEXT.too_cheap}”.
              </>,
              <>
                <strong>Above ({pct(t.above)}).</strong> How quickly interest fades once you charge more than they would pay. {pct(t.above)} of their budget (
                {money(t.above * p.average_expense)}) past what they would pay, only about 5% still buy.
              </>,
            ]}
          />
          <Example>
            For their favourite cup they would pay {money(best)}: half buy at that price, about 95% at {money(best - t.above * p.average_expense)}, and about
            5% at {money(best + t.above * p.average_expense)}.
          </Example>
          <Note>Below must be between 0% and 100%; above must be more than 0% and at most 500%.</Note>
        </>
      )
    },
  }
}

const preferredDegrees: Doc = {
  title: ({ person }) => `Favourite temperature${person ? ` (${person})` : ''}`,
  body: ({ config, person = 'Child' }) => {
    const p = config.people_preferences[person]
    const xs = tempSteps(config)
    return (
      <>
        <P>
          The temperature {person.toLowerCase()} customers like best: {p.preferred_degrees}°C. The closer the day is to it, the more of them come out. It does
          not change whether they buy.
        </P>
        <P>The temperature score is one third of their visitor bonus.</P>
        <LineChart title="Temperature score" labels={xs.map((x) => `${x}°`)} series={scoreSeries(config, 'temperature', xs, person)} xLabel="Temperature °C" yLabel="Temperature score" fmt="percent" />
        <Note>It must fall inside the temperature range, or the configuration is invalid.</Note>
      </>
    )
  },
}

const preferredWeather: Doc = {
  title: ({ person }) => `Favourite weather${person ? ` (${person})` : ''}`,
  body: ({ config, person = 'Child' }) => {
    const p = config.people_preferences[person]
    return (
      <>
        <P>
          The weather {person.toLowerCase()} customers like best: {p.preferred_weather}. When the day matches, the weather part of their visitor bonus is 1;
          otherwise it is 0. It is all or nothing, and adds up to a third of the bonus.
        </P>
        <P>This works on top of the weather’s traffic multiplier, which applies to everyone.</P>
        <BarChart
          title={`Expected ${person.toLowerCase()} visitors at ${p.preferred_hour}:00, by weather`}
          labels={WEATHER_TYPES.map(cap)}
          series={[{ label: 'Visitors / hour', data: WEATHER_TYPES.map((w) => round2(expectedSpawn(config, p, p.preferred_hour, w, typicalTemp(config, w)))), color: PERSON_SERIES[person] }]}
          xLabel="Weather (at the middle of its temperature range)"
          yLabel="Visitors / hour"
        />
      </>
    )
  },
}

const preferredHour: Doc = {
  title: ({ person }) => `Favourite hour${person ? ` (${person})` : ''}`,
  body: ({ config, person = 'Child' }) => {
    const p = config.people_preferences[person]
    const xs = hours(config)
    return (
      <>
        <P>
          The hour {person.toLowerCase()} customers most like to be out: {p.preferred_hour}:00. Their traffic peaks at this hour and fades towards the far end of
          the opening hours. It is one third of their visitor bonus and does not change whether they buy.
        </P>
        <LineChart title="Hour score" labels={xs.map((x) => `${x}:00`)} series={scoreSeries(config, 'hour', xs, person)} xLabel="Hour" yLabel="Hour score" fmt="percent" />
        <Note>It must be within the opening hours, or the configuration is invalid.</Note>
      </>
    )
  },
}

function preferredIngredient(n: RecipeIngredient): Doc {
  return {
    title: ({ person }) => `Favourite ${n}${person ? ` (${person})` : ''}`,
    body: ({ config, person = 'Child' }) => {
      const p = config.people_preferences[person]
      const fav = p[`preferred_${n}`] as number
      const t = p.tolerances[n]
      const xs = steps(config.min_max_values[n])
      const [low, high] = { ice: ['Needs more ice', 'Too much ice'], sugar: ['Not sweet enough', 'Too sweet'], lemons: ['Needs more lemon', 'Too sour'] }[n]
      return (
        <>
          <P>
            How many {UNIT[n]} a {person.toLowerCase()} likes in a cup: {fav}. Their {n} score is 1 at exactly that amount and falls to 0 at {t.below} under it
            or {t.above} over it (their {n} tolerance). It is one third of the recipe quality, which sets what they would pay.
          </P>
          <P>
            When {n} is the reason they refuse, the day report says “{low}” if the cup had too little, or “{high}” if it had too much.
          </P>
          <LineChart title={`${cap(n)} score`} labels={xs} series={ingredientSeries(config, n, xs, person)} xLabel={`${cap(n)} per cup`} yLabel="Score" fmt="percent" />
          <Note>It must fall inside the recipe limits for {n}.</Note>
        </>
      )
    },
  }
}

function ingredientToleranceDoc(n: RecipeIngredient): Doc {
  return {
    title: ({ person }) => `${cap(n)} tolerance${person ? ` (${person})` : ''}`,
    body: ({ config, person = 'Child' }) => {
      const p = config.people_preferences[person]
      const fav = p[`preferred_${n}`] as number
      const t = p.tolerances[n]
      const xs = steps(config.min_max_values[n])
      return (
        <>
          <P>
            How far from their favourite {fav} {UNIT[n]} a {person.toLowerCase()} still enjoys a cup. The score falls in a straight line from 1 at the favourite to 0
            at <strong>{t.below}</strong> under it (below) or <strong>{t.above}</strong> over it (above).
          </P>
          <Formula>{TOLERANCE_KERNEL}</Formula>
          <List
            items={[
              'A small tolerance makes this type picky about this ingredient; a large one makes them easygoing.',
              'Below and above can differ: someone who loves sweet drinks may barely mind extra sugar but hate too little.',
              '0 means only the exact favourite amount scores anything.',
            ]}
          />
          <LineChart title={`${cap(n)} score`} labels={xs} series={ingredientSeries(config, n, xs, person)} xLabel={`${cap(n)} per cup`} yLabel="Score" fmt="percent" />
        </>
      )
    },
  }
}

/* ----------------------------------------------------------- Ingredients */

const ingredientsSection: Doc = {
  title: () => 'Ingredients and spoilage',
  body: ({ config }) => {
    const perishable = INGREDIENTS.filter((n) => !config.ingredients[n].never_perishes)
    const days = Math.min(Math.max(10, ...perishable.map((n) => config.ingredients[n].max_days)), 30)
    const xs = Array.from({ length: days + 1 }, (_, i) => i)
    return (
      <>
        <P>Every cup uses your recipe’s ice, sugar and lemons, plus one cup. You buy ingredients each morning in whole packs, and bigger packs can carry a discount.</P>
        <H>Batches and spoilage</H>
        <P>
          Each purchase is tracked as its own batch, so the game knows how old every unit is. Sales always use the oldest batch first. At the end of every day
          each batch ages by one day, and each unit in it may spoil:
        </P>
        <Formula>{`age 1 = the first night after purchase
chance to spoil tonight = 0                              if age ≤ fresh days
                        = (age − fresh) ÷ (max − fresh)  in between
                        = 1                              if age ≥ max days`}</Formula>
        <P>Spoiled units are removed automatically and shown in the day report. The planning screen warns you how many may spoil tonight.</P>
        {perishable.length ? (
          <LineChart
            title="Share of a batch still good, if none of it is sold"
            labels={xs.map((x) => (x === 0 ? 'Bought' : `Night ${x}`))}
            series={perishable.map((n) => ({ label: cap(n), color: INGREDIENT_SERIES[n], data: xs.map((d) => survival(config.ingredients[n], d)) }))}
            xLabel="Nights since purchase"
            yLabel="Still good"
            fmt="percent"
          />
        ) : null}
      </>
    )
  },
}

const unitCost: Doc = {
  title: ({ ingredient }) => `Cost per unit${ingredient ? ` (${ingredient})` : ''}`,
  body: ({ config, ingredient = 'lemons' }) => {
    const plan = samplePlan(config)
    const lines = [...RECIPE_INGREDIENTS.map((n) => [cap(n), plan.recipe[n], config.ingredients[n].unit_cost] as const), ['Cups', 1, config.ingredients.cups.unit_cost] as const]
    return (
      <>
        <P>
          The list price of one unit of {ingredient}: {money(config.ingredients[ingredient].unit_cost)}. A unit is one ice cube, one spoon of sugar, one lemon or
          one cup. Each pack size can knock a discount off this price (see “Packs on sale”).
        </P>
        <Formula>{`pack price   = size × unit cost × (1 − pack discount)
cost per cup = ice + sugar + lemons + 1 cup, each at the unit price you paid`}</Formula>
        <P>
          In the game, the cost per cup comes from the stock you actually use, oldest first, at the price you paid for it. Cheap bulk stock lowers it, and
          so does using up older stock bought at a discount.
        </P>
        <Example title="Cost of a mid-range cup at list price">
          <Table head={['Ingredient', 'Units', 'Unit cost', 'Subtotal']} rows={lines.map(([name, qty, c]) => [name, qty, money(c), money(qty * c)])} />
          <p className="mt-2">
            Total: <strong>{money(costPerCup(config, plan.recipe))}</strong> per cup. Selling at {money(plan.price)} leaves{' '}
            <strong>{money(plan.price - costPerCup(config, plan.recipe))}</strong> per cup sold. Bought entirely from the biggest packs, the cup would cost{' '}
            <strong>{money(bulkCostPerCup(config, plan.recipe))}</strong>.
          </p>
        </Example>
      </>
    )
  },
}

const packs: Doc = {
  title: ({ ingredient }) => `Packs on sale${ingredient ? ` (${ingredient})` : ''}`,
  body: ({ config, ingredient = 'lemons' }) => {
    const cfg = config.ingredients[ingredient]
    const small = smallestPack(cfg)
    const big = cfg.packs.reduce((a, b) => (b.size > a.size ? b : a))
    const smallUnit = packPrice(cfg, small) / small.size
    const breakEven = smallUnit > 0 ? Math.ceil(packPrice(cfg, big) / smallUnit) : 0
    return (
      <>
        <P>
          The packs you can buy each morning. Each pack has a size and its own discount, so bigger packs can be cheaper per unit. You always buy whole
          packs, and any number of each.
        </P>
        <Formula>pack price = size × unit cost × (1 − discount), rounded to the cent</Formula>
        <List
          items={[
            'From 1 to 8 packs. Sizes are whole numbers from 1 to 10,000, with no repeats.',
            'Discounts go from 0% to 90%. Only pack discounts exist; there is no discount for buying many packs.',
            'A warning appears when a bigger pack costs more per unit than a smaller one. It is allowed, but players will rarely buy that pack.',
          ]}
        />
        <BarChart
          title={`${cap(ingredient)}: price per unit by pack`}
          labels={cfg.packs.map((p) => `${p.size}`)}
          series={[{ label: 'Price per unit', data: cfg.packs.map((p) => packPrice(cfg, p) / p.size), color: INGREDIENT_SERIES[ingredient] }]}
          xLabel="Pack size (units)"
          yLabel="Price per unit"
          fmt="money"
        />
        <Example title={`Current ${ingredient} packs`}>
          <Table
            head={['Pack', 'Discount', 'Price', 'Per unit', 'Share of starting cash']}
            rows={cfg.packs.map((p) => [
              `${p.size} units`,
              pct(p.discount),
              money(packPrice(cfg, p)),
              money(packPrice(cfg, p) / p.size),
              pct(config.starting_cash ? packPrice(cfg, p) / config.starting_cash : 0),
            ])}
          />
        </Example>
        {big.size > small.size && !cfg.never_perishes ? (
          <>
            <H>The catch: spoilage</H>
            <P>
              A discount only pays off if you use the stock before it spoils. The pack of {big.size} costs {money(packPrice(cfg, big))}. Buying the same
              units in packs of {small.size} would cost {money(smallUnit)} each, so the big pack is only the better deal if you use at least{' '}
              <strong>{breakEven}</strong> of its {big.size} units. The rest can spoil and you still come out ahead.
            </P>
          </>
        ) : null}
        <H>Margin per cup</H>
        <P>
          Every purchase is kept as its own batch with the price you paid. The planning screen’s cost per cup is the average cost of the cups you can make
          today, oldest stock first. The day report shows what the cups you sold actually cost.
        </P>
      </>
    )
  },
}

const neverPerishes: Doc = {
  title: ({ ingredient }) => `Never perishes${ingredient ? ` (${ingredient})` : ''}`,
  body: () => (
    <>
      <P>Turn this on for goods that never perish, like cups. Stock of this ingredient then lasts for the whole game, however long you keep it.</P>
      <P>While it is on, fresh days and max days have no effect, so they are hidden. Turn it off to set how quickly the ingredient goes bad.</P>
    </>
  ),
}

function spoilageDoc(which: 'fresh_days' | 'max_days'): Doc {
  return {
    title: ({ ingredient }) => `${which === 'fresh_days' ? 'Fresh days' : 'Max days'}${ingredient ? ` (${ingredient})` : ''}`,
    body: ({ config, ingredient = 'lemons' }) => {
      const cfg = config.ingredients[ingredient]
      const days = Math.min(Math.max(cfg.max_days, 1), 30)
      const xs = Array.from({ length: days }, (_, i) => i + 1)
      return (
        <>
          {which === 'fresh_days' ? (
            <P>
              How many nights a unit is guaranteed not to spoil after purchase. With {cfg.fresh_days}, {ingredient} bought today{' '}
              {cfg.fresh_days === 0 ? 'can already spoil tonight' : `is safe for ${cfg.fresh_days} night${cfg.fresh_days === 1 ? '' : 's'}`}.
            </P>
          ) : (
            <P>By the end of this day of age, every remaining unit has spoiled. With {cfg.max_days}, no {ingredient} survives its night {cfg.max_days}.</P>
          )}
          <Formula>{`chance to spoil on night d = (d − ${cfg.fresh_days}) ÷ (${cfg.max_days} − ${cfg.fresh_days})   between the two
                           = 0 up to night ${cfg.fresh_days}, 1 from night ${cfg.max_days}`}</Formula>
          <P>Fresh days must be less than max days. Between the two, the nightly chance rises in a straight line.</P>
          <BarChart
            title={`${cap(ingredient)}: chance to spoil each night`}
            labels={xs.map((d) => `Night ${d}`)}
            series={[{ label: 'Chance to spoil', data: xs.map((d) => hazard(cfg, d)), color: '#eb6834' }]}
            xLabel="Nights since purchase"
            yLabel="Chance"
            fmt="percent"
          />
          <LineChart
            title={`${cap(ingredient)}: share of a batch still good`}
            labels={xs.map((d) => `Night ${d}`)}
            series={[{ label: 'Still good', data: xs.map((d) => survival(cfg, d)), color: INGREDIENT_SERIES[ingredient] }]}
            xLabel="Nights since purchase"
            yLabel="Still good"
            fmt="percent"
          />
          <Example>
            Buy 100 {ingredient} and sell none: after night {Math.min(cfg.fresh_days + 1, cfg.max_days)} you would have about{' '}
            <strong>{Math.round(100 * survival(cfg, Math.min(cfg.fresh_days + 1, cfg.max_days)))}</strong> left, and after night{' '}
            {Math.min(cfg.fresh_days + 2, cfg.max_days)} about <strong>{Math.round(100 * survival(cfg, Math.min(cfg.fresh_days + 2, cfg.max_days)))}</strong>.
          </Example>
        </>
      )
    },
  }
}

export const DOCS = {
  game,
  num_days: numDays,
  starting_cash: startingCash,
  hours_section: hoursSection,
  hour,
  temperature,
  price,
  recipe_section: recipeSection,
  range_ice: recipeRange('ice'),
  range_sugar: recipeRange('sugar'),
  range_lemons: recipeRange('lemons'),
  weather_section: weatherSection,
  traffic_multiplier: trafficMultiplier,
  weather_range: weatherRange,
  customers_section: customersSection,
  spawn_per_hour: spawnPerHour,
  quality_swing: qualitySwing,
  starting_popularity: startingPopularity,
  average_expense: averageExpense,
  tolerance_price: priceToleranceDoc(),
  tolerance_ice: ingredientToleranceDoc('ice'),
  tolerance_sugar: ingredientToleranceDoc('sugar'),
  tolerance_lemons: ingredientToleranceDoc('lemons'),
  preferred_degrees: preferredDegrees,
  preferred_weather: preferredWeather,
  preferred_hour: preferredHour,
  preferred_ice: preferredIngredient('ice'),
  preferred_sugar: preferredIngredient('sugar'),
  preferred_lemons: preferredIngredient('lemons'),
  ingredients_section: ingredientsSection,
  unit_cost: unitCost,
  packs,
  never_perishes: neverPerishes,
  fresh_days: spoilageDoc('fresh_days'),
  max_days: spoilageDoc('max_days'),
} satisfies Record<string, Doc>

export type DocKey = keyof typeof DOCS
