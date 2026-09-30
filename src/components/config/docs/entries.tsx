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
  type IngredientName,
  type PersonType,
  type RecipeIngredient,
  type Weather,
} from '../../../types/game'
import { money, pct, REASON_TEXT } from '../../../utils/format'
import { buyScores, expectedSpawn, hazard, midpoint, score, steps, survival, weatherOdds, type ScoredRange } from '../../../game/configMath'
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

function samplePlan(cfg: GameConfig) {
  const mm = cfg.min_max_values
  return {
    price: round2(roundTo(midpoint(mm.price), 0.05)),
    recipe: { ice: Math.round(midpoint(mm.ice)), sugar: Math.round(midpoint(mm.sugar)), lemons: Math.round(midpoint(mm.lemons)) },
  }
}

function costPerCup(cfg: GameConfig, recipe: Record<RecipeIngredient, number>): number {
  return RECIPE_INGREDIENTS.reduce((sum, n) => sum + recipe[n] * cfg.ingredients[n].unit_cost, 0) + cfg.ingredients.cups.unit_cost
}

function refusal(cfg: GameConfig, t: PersonType, price: number, recipe: Record<RecipeIngredient, number>, scores: Record<string, number>): string {
  const p = cfg.people_preferences[t]
  const factor = (Object.keys(scores) as (keyof typeof scores)[]).reduce((a, b) => (scores[b] < scores[a] ? b : a))
  if (factor === 'price') return REASON_TEXT[price < p.average_expense ? 'too_cheap' : 'too_pricey']
  const key = factor as RecipeIngredient
  const tooMuch = recipe[key] > (p[`preferred_${key}`] as number)
  const reason = { ice: ['needs_more_ice', 'too_much_ice'], sugar: ['not_sweet_enough', 'too_sweet'], lemons: ['needs_more_lemon', 'too_sour'] }[key][tooMuch ? 1 : 0]
  return REASON_TEXT[reason]
}

const KERNEL = 'score = max(0, 1 − |value − favourite| ÷ reach)\nreach = distance from the favourite to the FARTHER end of the allowed range'

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
    const basket = INGREDIENTS.reduce((sum, n) => sum + Math.min(...config.ingredients[n].pack_sizes) * config.ingredients[n].unit_cost, 0)
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
          A mid-range recipe ({plan.recipe.ice} ice, {plan.recipe.sugar} sugar, {plan.recipe.lemons} lemons, plus a cup) costs{' '}
          <strong>{money(cup)}</strong> per cup, so your starting cash is worth about <strong>{cup > 0 ? Math.floor(config.starting_cash / cup) : '∞'} cups</strong>{' '}
          of ingredients.
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
      <P>These three ranges set the limits of each day. Each one also does a second, less obvious job: it sets how picky customers are.</P>
      <P>
        A customer scores every factor (hour, temperature, price, and each recipe ingredient) from 0 to 1. The score is 1 at their favourite value and drops
        in a straight line to 0 at the far end of the allowed range:
      </P>
      <Formula>{KERNEL}</Formula>
      <P>
        So <strong>widening a range makes customers more tolerant</strong> (the slope is gentler), and narrowing it makes them stricter. Open the help on
        each range to see the curves for your current settings.
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
    const child = config.people_preferences.Child
    const reach = Math.max(child.average_expense - r.min, r.max - child.average_expense)
    const probe = round2(Math.min(r.max, child.average_expense + reach / 3))
    return (
      <>
        <P>
          The lowest and highest price you may charge for a cup, currently {money(r.min)} to {money(r.max)}.
        </P>
        <H>How it affects the game</H>
        <P>
          Besides limiting your choice, the range sets how fast customers lose interest as your price moves away from what they expect to pay. The price
          score is one of the four equal parts of every customer’s chance to buy.
        </P>
        <Formula>{KERNEL.replace(/value/, 'your price').replace(/favourite/g, 'expected price')}</Formula>
        <LineChart
          title="Price score per customer type"
          labels={xs.map((x) => `$${x.toFixed(2)}`)}
          series={scoreSeries(config, 'price', xs)}
          xLabel="Cup price"
          yLabel="Price score"
          fmt="percent"
        />
        <Example>
          Children expect to pay {money(child.average_expense)}. The farther end of the range is {money(reach)} away, so charging {money(probe)} gives a price
          score of 1 − {money(probe - child.average_expense)} ÷ {money(reach)} = <strong>{pct(score(config, child, 'price', probe))}</strong>.
        </Example>
        <Note>The penalty is symmetric: a cup far cheaper than expected also scores low, because it looks suspicious.</Note>
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
        Every customer type has a favourite amount of each ingredient, and it must fall inside these limits. Like the other ranges, they also set how picky
        customers are: a customer’s score for an ingredient falls from 1 at their favourite to 0 at the far end of the range. Each ingredient score is one
        quarter of the chance to buy.
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
            series={scoreSeries(config, n, xs)}
            xLabel={`${cap(n)} per cup`}
            yLabel="Score"
            fmt="percent"
          />
          <Example>
            <Table
              head={['Customer', 'Favourite', `Score at ${r.min}`, `Score at ${r.max}`]}
              rows={PERSON_TYPES.map((t) => {
                const p = config.people_preferences[t]
                return [t, p[`preferred_${n}`], pct(score(config, p, n, r.min)), pct(score(config, p, n, r.max))]
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
    const plan = samplePlan(config)
    const rows = PERSON_TYPES.map((t) => {
      const s = buyScores(config, config.people_preferences[t], plan.price, plan.recipe)
      const chance = (s.price + s.ice + s.sugar + s.lemons) / 4
      return { t, s, chance, reason: refusal(config, t, plan.price, plan.recipe, s) }
    })
    return (
      <>
        <P>Four customer types walk past the stand. Each has its own favourite hour, temperature, weather, price and recipe. Two things are simulated for them:</P>
        <H>1. How many come</H>
        <Formula>{`bonus    = average(weather match (0 or 1), hour score, temperature score)
expected = base visitors × (1 + bonus) × weather multiplier
count    = random (Poisson) around expected`}</Formula>
        <P>The bonus is between 0 and 1, so on a perfect day a type brings up to twice its base visitors (before the weather multiplier).</P>
        <H>2. Whether each one buys</H>
        <Formula>{`chance to buy = average(price score, ice score, sugar score, lemons score)`}</Formula>
        <P>
          Each score is 1 when you hit their preference exactly and falls in a straight line to 0 at the far end of the allowed range. When someone says no, the
          reason shown is their lowest-scoring factor.
        </P>
        <Example title={`Worked example: ${money(plan.price)} with ${plan.recipe.ice} ice, ${plan.recipe.sugar} sugar, ${plan.recipe.lemons} lemons`}>
          <Table
            head={['Customer', 'Price', 'Ice', 'Sugar', 'Lemons', 'Chance to buy', 'Most likely “no”']}
            rows={rows.map((r) => [r.t, pct(r.s.price), pct(r.s.ice), pct(r.s.sugar), pct(r.s.lemons), <strong key="c">{pct(r.chance)}</strong>, r.reason])}
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
    const probes = [p.average_expense, round2(Math.min(r.max, p.average_expense + 0.5)), round2(Math.max(r.min, p.average_expense - 0.5)), r.max]
    return (
      <>
        <P>
          What a {person.toLowerCase()} expects to pay for a cup: {money(p.average_expense)}. Their price score is 1 at exactly that price and falls to 0 at the
          farther end of the price range ({money(r.min)} to {money(r.max)}).
        </P>
        <List
          items={[
            'Much higher than expected feels expensive.',
            'Much lower than expected feels suspicious, and is penalised just as much.',
            'The price score is one quarter of their chance to buy.',
          ]}
        />
        <LineChart title="Price score" labels={xs.map((x) => `$${x.toFixed(2)}`)} series={scoreSeries(config, 'price', xs, person)} xLabel="Cup price" yLabel="Price score" fmt="percent" />
        <Example>
          <Table head={['You charge', 'Price score', 'Effect on chance to buy']} rows={[...new Set(probes)].map((x) => [money(x), pct(score(config, p, 'price', x)), `up to −${pct((1 - score(config, p, 'price', x)) / 4)}`])} />
        </Example>
      </>
    )
  },
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
      const r = config.min_max_values[n]
      const xs = steps(r)
      const [low, high] = { ice: ['Needs more ice', 'Too much ice'], sugar: ['Not sweet enough', 'Too sweet'], lemons: ['Needs more lemon', 'Too sour'] }[n]
      return (
        <>
          <P>
            How many {UNIT[n]} a {person.toLowerCase()} likes in a cup: {fav}. Their {n} score is 1 at exactly that amount and falls to 0 at the farther end of
            the allowed range ({r.min} to {r.max}). It is one quarter of their chance to buy.
          </P>
          <P>
            When {n} is their lowest score and they refuse, the day report says “{low}” if the cup had too little, or “{high}” if it had too much.
          </P>
          <LineChart title={`${cap(n)} score`} labels={xs} series={scoreSeries(config, n, xs, person)} xLabel={`${cap(n)} per cup`} yLabel="Score" fmt="percent" />
          <Note>It must fall inside the recipe limits for {n}.</Note>
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
        <P>Every cup uses your recipe’s ice, sugar and lemons, plus one cup. You buy ingredients each morning in whole packs.</P>
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
          The price of one unit of {ingredient}: {money(config.ingredients[ingredient].unit_cost)}. A unit is one ice cube, one spoon of sugar, one lemon or one
          cup. Packs cost pack size × unit cost, with no bulk discount.
        </P>
        <Formula>cost per cup = ice × ice cost + sugar × sugar cost + lemons × lemon cost + 1 cup</Formula>
        <Example title="Cost of a mid-range cup">
          <Table head={['Ingredient', 'Units', 'Unit cost', 'Subtotal']} rows={lines.map(([name, qty, c]) => [name, qty, money(c), money(qty * c)])} />
          <p className="mt-2">
            Total: <strong>{money(costPerCup(config, plan.recipe))}</strong> per cup. Selling at {money(plan.price)} leaves{' '}
            <strong>{money(plan.price - costPerCup(config, plan.recipe))}</strong> per cup sold.
          </p>
        </Example>
      </>
    )
  },
}

const packSizes: Doc = {
  title: ({ ingredient }) => `Pack sizes${ingredient ? ` (${ingredient})` : ''}`,
  body: ({ config, ingredient = 'lemons' }) => {
    const cfg = config.ingredients[ingredient]
    return (
      <>
        <P>The pack sizes you can buy each morning, separated by commas. You always buy whole packs, and you can buy any number of each size.</P>
        <List items={['Between 1 and 8 sizes.', 'Each size must be a whole number from 1 to 10,000, with no repeats.', 'Changes apply when you leave the field.']} />
        <P>Packs have no bulk discount, so the choice is about granularity: small packs let you buy close to what you need; big packs over-buy and risk spoilage.</P>
        <Example title={`Current ${ingredient} packs`}>
          <Table head={['Pack', 'Price', 'Share of starting cash']} rows={cfg.pack_sizes.map((s) => [`${s} units`, money(s * cfg.unit_cost), pct(config.starting_cash ? (s * cfg.unit_cost) / config.starting_cash : 0)])} />
        </Example>
      </>
    )
  },
}

const neverPerishes: Doc = {
  title: ({ ingredient }) => `Never perishes${ingredient ? ` (${ingredient})` : ''}`,
  body: () => (
    <>
      <P>Turn this on for goods that never spoil, like cups. Stock of this ingredient then lasts for the whole game, however long you keep it.</P>
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
  average_expense: averageExpense,
  preferred_degrees: preferredDegrees,
  preferred_weather: preferredWeather,
  preferred_hour: preferredHour,
  preferred_ice: preferredIngredient('ice'),
  preferred_sugar: preferredIngredient('sugar'),
  preferred_lemons: preferredIngredient('lemons'),
  ingredients_section: ingredientsSection,
  unit_cost: unitCost,
  pack_sizes: packSizes,
  never_perishes: neverPerishes,
  fresh_days: spoilageDoc('fresh_days'),
  max_days: spoilageDoc('max_days'),
} satisfies Record<string, Doc>

export type DocKey = keyof typeof DOCS
