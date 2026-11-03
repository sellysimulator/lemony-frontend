/**
 * Help for every configuration field, opened from the info buttons on the
 * config screen. Every figure, chart and worked example is the server's, from
 * `POST /config/preview` for the config being edited (`ctx.help`, `ctx.ingredients`),
 * so it updates as the player changes values and always shows the rules the game
 * plays. Nothing here works a figure out: the help picks, labels and lays them out.
 */
import type { ReactNode } from 'react'
import {
  INGREDIENTS,
  PERSON_TYPES,
  RECIPE_INGREDIENTS,
  WEATHER_TYPES,
  type ConfigHelp,
  type GameConfig,
  type IngredientName,
  type IngredientPreview,
  type Limits,
  type PersonType,
  type RecipeIngredient,
  type Weather,
} from '../../../types/game'
import { money, pct, REASON_TEXT } from '../../../utils/format'
import { INGREDIENT_SERIES, PERSON_SERIES, WEATHER_SERIES } from '../../charts/chartSetup'
import { BarChart, Example, Formula, H, LineChart, List, Note, P, Table, WeatherBands, type Series } from './primitives'

export interface DocCtx {
  config: GameConfig
  /** The server's bounds (GET /config/defaults): the help quotes them, never a copy. */
  limits: Limits
  /** The server's help figures for `config`; null until they arrive, or while the config is invalid. */
  help: ConfigHelp | null
  /** Each ingredient's figures from the server (null for one whose settings are invalid); null until they arrive. */
  ingredients: Record<IngredientName, IngredientPreview | null> | null
  /** The server's reason the config is invalid, if it is. */
  invalid: string | null
  /** The server's figure for the busiest day's customers (`ConfigPreview.customers_per_day`); null until it has one. */
  customersPerDay: number | null
  /** The figures are for an earlier edit; newer ones are on their way. */
  stale: boolean
  person?: PersonType
  ingredient?: IngredientName
  weather?: Weather
}

interface Doc {
  title(ctx: DocCtx): string
  body(ctx: DocCtx): ReactNode
}

const UNIT: Record<RecipeIngredient, string> = { ice: 'ice cubes', sugar: 'spoons of sugar', lemons: 'lemons' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** A temperature with a true minus sign. */
const deg = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n)}°C`
const dollars = (x: number) => `$${x.toFixed(2)}`

/** Where a figure goes before the server has sent it, or while the config cannot be played. */
function Waiting(props: { ctx: DocCtx }): ReactNode {
  return (
    <p role="status" className="mt-4 rounded-xl border border-border bg-surface-sunken/60 p-3 text-sm text-ink-muted">
      {props.ctx.invalid ? <>The examples appear once the configuration is valid: {props.ctx.invalid}</> : 'Asking the server for the examples…'}
    </p>
  )
}

/** Dimmed while newer figures are on their way. */
function Figures(props: { stale: boolean; children: ReactNode }): ReactNode {
  return (
    <div className={props.stale ? 'opacity-60' : undefined} aria-busy={props.stale}>
      {props.children}
    </div>
  )
}

/** `render` with the server's help figures, or a placeholder until there are some. */
function withHelp(ctx: DocCtx, render: (help: ConfigHelp) => ReactNode): ReactNode {
  return ctx.help ? <Figures stale={ctx.stale}>{render(ctx.help)}</Figures> : <Waiting ctx={ctx} />
}

/** `render` with one ingredient's server figures, or a placeholder until there are some. */
function withIngredient(ctx: DocCtx, name: IngredientName, render: (figures: IngredientPreview) => ReactNode): ReactNode {
  const figures = ctx.ingredients?.[name]
  return figures ? <Figures stale={ctx.stale}>{render(figures)}</Figures> : <Waiting ctx={ctx} />
}

/** The cap on customers a day, which the traffic fields share, and this config's figure from the server. */
function CustomersCap(props: { ctx: DocCtx }): ReactNode {
  const { limits, customersPerDay, stale } = props.ctx
  // A backend older than the cap sends no `customers_per_day` limit: no note then.
  if (!limits.customers_per_day) return null
  return (
    <Note>
      Base visitors, opening hours and traffic multipliers add up: the busiest day they allow may expect at most{' '}
      {limits.customers_per_day.max.toLocaleString('en')} customers, or the configuration is invalid.
      {customersPerDay === null ? null : (
        <span className={stale ? 'opacity-60' : undefined}>
          {' '}
          This one: up to <strong>{customersPerDay.toLocaleString('en')}</strong> customers a day.
        </span>
      )}
    </Note>
  )
}

/** One line per customer type, with the selected type drawn thicker. */
function typeSeries(data: (t: PersonType) => number[], selected?: PersonType): Series[] {
  return PERSON_TYPES.map((t) => ({
    label: t,
    color: PERSON_SERIES[t],
    emphasis: t === selected,
    muted: selected !== undefined && t !== selected,
    data: data(t),
  }))
}

const COST_RULE = `cost per cup = the average cost of the cups your stock can make today
each ingredient: oldest stock first, at the price you paid,
                 then today's packs, the dearest per unit first`

const KERNEL = 'score = max(0, 1 − |value − favourite| ÷ reach)\nreach = distance from the favourite to the FARTHER end of the allowed range'

const TOLERANCE_KERNEL = `score = max(0, 1 − |amount − favourite| ÷ tolerance)
tolerance = "below" if the cup has less than their favourite, "above" if more`

const BUY = `quality       = average(ice score, sugar score, lemons score)      // 0 to 1
would pay     = budget × (1 + quality swing × (2 × quality − 1))
chance to buy = 1 ÷ (1 + e^((price − would pay) ÷ spread))
spread        = price tolerance above × budget ÷ ln 19
if price < budget × (1 − price tolerance below): chance × price ÷ that floor`

const recipeText = (r: Record<RecipeIngredient, number>) => `${r.ice} ice, ${r.sugar} sugar, ${r.lemons} lemons`

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
  body: (ctx) => {
    const { config, limits } = ctx
    return (
      <>
        <P>
          How many days the game lasts, from {limits.num_days.min} to {limits.num_days.max}. Each day you plan in the morning, then watch the day play out.
        </P>
        <H>How it affects the game</H>
        <List
          items={[
            'Each day’s temperature is drawn again, independently of earlier days, so more days means the weather evens out towards its long-run odds.',
            'Longer games give you more time to learn what each customer type wants and to recover from a bad day.',
            'Spoilage matters more in long games: stock you over-buy keeps ageing night after night.',
            'Final results add up every day, so totals naturally grow with the number of days.',
          ]}
        />
        {withHelp(ctx, (help) => (
          <Example title={`What ${config.num_days} days look like with your weather`}>
            The expected number of days of each weather, from your temperature range and weather ranges:
            <Table
              head={['Weather', 'Chance per day', `Expected days in ${config.num_days}`]}
              rows={WEATHER_TYPES.map((w) => [cap(w), pct(help.weather[w].odds), help.weather[w].expected_days.toFixed(1)])}
            />
          </Example>
        ))}
      </>
    )
  },
}

const startingCash: Doc = {
  title: () => 'Starting cash',
  body: (ctx) => (
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
      {withHelp(ctx, (help) => {
        const c = help.cup_cost.smallest
        return (
          <Example>
            The cheapest way to have some of everything is the smallest pack of each ingredient: <strong>{money(c.spend)}</strong>. Your{' '}
            {money(ctx.config.starting_cash)} covers that <strong>{c.covers === null ? '∞' : c.covers.toFixed(1)}×</strong>.
            <br />
            With a mid-range recipe ({recipeText(help.plans.sample.recipe)}, plus a cup) those packs make <strong>{c.cups_possible} cups</strong>
            {c.cost_per_cup === null ? '' : <>, at <strong>{money(c.cost_per_cup)}</strong> a cup</>}. Bigger packs with a discount lower the cost per cup.
          </Example>
        )
      })}
    </>
  ),
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
  body: (ctx) => {
    const h = ctx.config.min_max_values.hour
    return (
      <>
        <P>
          The stand opens at the first hour and closes when the last hour ends. With {h.min}–{h.max} it is open from{' '}
          <strong>{h.min}:00 to {h.max + 1}:00</strong>
          {ctx.help ? `, which is ${ctx.help.grids.hours.length} hourly slots` : ''}. Customers arrive spread evenly within each hour.
        </P>
        <H>How it affects the game</H>
        <List
          items={[
            'More hours means more foot traffic in total.',
            'Each customer type has a favourite hour. Its visitor bonus is highest at that hour and fades towards the far end of the opening hours.',
            'Every customer type’s favourite hour must fall inside the opening hours.',
          ]}
        />
        {withHelp(ctx, (help) => (
          <LineChart
            title="Hour score per customer type"
            labels={help.grids.hours.map((x) => `${x}:00`)}
            series={typeSeries((t) => help.people[t].hour_score)}
            xLabel="Hour"
            yLabel="Hour score"
            fmt="percent"
          />
        ))}
        <P>The hour score is one third of a customer type’s visitor bonus (see “Base visitors / hour”). It changes how many people come, not whether they buy.</P>
        <CustomersCap ctx={ctx} />
      </>
    )
  },
}

const temperature: Doc = {
  title: () => 'Temperature range',
  body: (ctx) => {
    const t = ctx.config.min_max_values.temperature
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
        {withHelp(ctx, (help) => (
          <>
            <LineChart
              title="Temperature score per customer type"
              labels={help.grids.temperatures.map((x) => `${x}°`)}
              series={typeSeries((p) => help.people[p].temperature_score)}
              xLabel="Temperature °C"
              yLabel="Temperature score"
              fmt="percent"
            />
            <Example title="Weather odds with this range">
              <Table head={['Weather', 'Chance per day']} rows={WEATHER_TYPES.map((w) => [cap(w), pct(help.weather[w].odds)])} />
            </Example>
          </>
        ))}
      </>
    )
  },
}

const price: Doc = {
  title: () => 'Cup price range',
  body: (ctx) => {
    const r = ctx.config.min_max_values.price
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
        {withHelp(ctx, (help) => (
          <LineChart
            title={`Chance to buy at each price, with ${recipeText(help.plans.typical.recipe)}`}
            labels={help.grids.prices.map(dollars)}
            series={typeSeries((t) => help.people[t].typical_chance)}
            xLabel="Cup price"
            yLabel="Chance to buy"
            fmt="percent"
          />
        ))}
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
    body: (ctx) => {
      const { config } = ctx
      const r = config.min_max_values[n]
      return (
        <>
          <P>
            The fewest and most {UNIT[n]} you can put in one cup: currently {r.min} to {r.max}. More {n} per cup also costs more per cup (
            {money(config.ingredients[n].unit_cost)} each).
          </P>
          {withHelp(ctx, (help) => {
            const xs = help.grids.per_cup[n]
            const last = xs.length - 1
            return (
              <>
                <LineChart
                  title={`${cap(n)} score per customer type`}
                  labels={xs}
                  series={typeSeries((t) => help.people[t].ingredient_score[n])}
                  xLabel={`${cap(n)} per cup`}
                  yLabel="Score"
                  fmt="percent"
                />
                <Example>
                  <Table
                    head={['Customer', 'Favourite', `Score at ${xs[0]}`, `Score at ${xs[last]}`]}
                    rows={PERSON_TYPES.map((t) => {
                      const scores = help.people[t].ingredient_score[n]
                      return [t, config.people_preferences[t][`preferred_${n}`], pct(scores[0]), pct(scores[last])]
                    })}
                  />
                </Example>
              </>
            )
          })}
          <Note>If you narrow the range so it no longer contains a customer type’s favourite amount, the configuration becomes invalid.</Note>
        </>
      )
    },
  }
}

/* --------------------------------------------------------------- Weather */

const weatherSection: Doc = {
  title: () => 'Weather',
  body: (ctx) => {
    const { config } = ctx
    return (
      <>
        <P>Weather is decided in two steps each morning, and then changes how many people come out:</P>
        <Formula>{`1. temperature ~ uniform(${config.min_max_values.temperature.min}°C, ${config.min_max_values.temperature.max}°C), rounded to 0.5°C
2. weather     = the type whose temperature range contains it
                 (random pick if ranges overlap)
3. visitors    × that weather's traffic multiplier`}</Formula>
        <WeatherBands config={config} />
        <P>Together the ranges must cover the whole temperature range with no gaps. Overlaps are allowed.</P>
        {withHelp(ctx, (help) => (
          <BarChart
            title="Chance of each weather per day"
            labels={WEATHER_TYPES.map(cap)}
            series={[{ label: 'Chance', data: WEATHER_TYPES.map((w) => help.weather[w].odds), color: WEATHER_SERIES.sunny }]}
            xLabel="Weather"
            yLabel="Chance"
            fmt="percent"
          />
        ))}
        <P>The weather types are fixed; their values are yours to tune.</P>
      </>
    )
  },
}

const trafficMultiplier: Doc = {
  title: ({ weather }) => `Traffic multiplier${weather ? ` (${weather})` : ''}`,
  body: (ctx) => {
    const { config, limits, weather = 'sunny' } = ctx
    const m = config.weather_multipliers[weather]
    return (
      <>
        <P>
          Scales how many people go out in this weather. It applies to every customer type, after their preference bonus. 1.0 is normal traffic, 0.5 is half,
          0.2 is one fifth. It goes from {limits.weather_multiplier.min} up to {limits.weather_multiplier.max}.
        </P>
        <Formula>expected visitors per hour = base × (1 + bonus) × multiplier</Formula>
        <P>
          In {weather} weather the multiplier is <strong>×{m}</strong>, so every customer type shows up at {pct(m)} of the rate it would with a multiplier of 1.
        </P>
        {withHelp(ctx, (help) => (
          <BarChart
            title="Expected visitors over a whole day, all customer types"
            labels={WEATHER_TYPES.map(cap)}
            series={[{ label: 'Visitors', data: WEATHER_TYPES.map((w) => help.weather[w].day_visitors), color: WEATHER_SERIES[weather] }]}
            xLabel="Weather (at the middle of its temperature range)"
            yLabel="Visitors"
          />
        ))}
        <P>
          The chart includes each type’s preference bonus, so two weathers with the same multiplier can still differ: a weather that more customer types like,
          at a temperature they like, draws a bigger crowd.
        </P>
        <CustomersCap ctx={ctx} />
      </>
    )
  },
}

const weatherRange: Doc = {
  title: ({ weather }) => `Temperature range${weather ? ` (${weather})` : ''}`,
  body: (ctx) => {
    const { config, limits, weather = 'sunny' } = ctx
    const r = config.weather_temperature_ranges[weather]
    return (
      <>
        <P>
          The temperatures that produce {weather} weather: currently {r.min}°C to {r.max}°C. After the day’s temperature is drawn, the weather is whichever
          type’s range contains it. If two ranges overlap, one of the matching weathers is picked at random.
        </P>
        <WeatherBands config={config} />
        {withHelp(ctx, (help) => (
          <Example>
            With these ranges, a day is {weather} with a chance of <strong>{pct(help.weather[weather].odds)}</strong>, which is about{' '}
            <strong>{help.weather[weather].expected_days.toFixed(1)}</strong> of your {config.num_days} days.
          </Example>
        ))}
        <Note>
          Each range must stay within {deg(limits.temperature.min)} to {deg(limits.temperature.max)}, and together the ranges must cover the whole temperature
          range with no gaps, or the configuration is invalid.
        </Note>
      </>
    )
  },
}

/* ------------------------------------------------------------- Customers */

const customersSection: Doc = {
  title: () => 'Customers',
  body: (ctx) => (
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
        When someone says no, the day report gives one reason. While your popularity is under 50%, a customer who would have bought at a neutral 50% says “
        {REASON_TEXT.not_popular}”. Otherwise it is “too cheap” if the price looked suspicious, “too pricey” if the price is further over their budget (counted
        in price tolerances) than their least favourite ingredient is from perfect, or else that ingredient.
      </P>
      <H>3. How popular the stand is</H>
      <P>
        Every chance to buy is then multiplied by 0.5 + popularity, never above 100%. Popularity is the average of your daily success rates so far; until a day
        has had visitors it is the starting popularity, {pct(ctx.config.starting_popularity)} (see “Starting popularity”). The example below is at a neutral 50%.
      </P>
      {withHelp(ctx, (help) => {
        const plan = help.plans.typical
        return (
          <>
            <Example title={`Worked example: ${money(plan.price)} with ${recipeText(plan.recipe)}`}>
              <Table
                head={['Customer', 'Ice', 'Sugar', 'Lemons', 'Quality', 'Would pay', 'Chance to buy', 'Most likely “no”']}
                rows={PERSON_TYPES.map((t) => {
                  const w = help.people[t].worked
                  return [
                    t,
                    pct(w.scores.ice),
                    pct(w.scores.sugar),
                    pct(w.scores.lemons),
                    pct(w.quality),
                    money(w.wtp),
                    <strong key="c">{pct(w.chance)}</strong>,
                    REASON_TEXT[w.reason] ?? w.reason,
                  ]
                })}
              />
            </Example>
            <BarChart
              title="Chance to buy for the example plan"
              labels={PERSON_TYPES}
              series={[{ label: 'Chance to buy', data: PERSON_TYPES.map((t) => help.people[t].worked.chance), color: PERSON_SERIES.Child }]}
              xLabel="Customer type"
              yLabel="Chance"
              fmt="percent"
            />
          </>
        )
      })}
      <P>The customer types are fixed; their values are yours to tune.</P>
    </>
  ),
}

const qualitySwing: Doc = {
  title: () => 'Recipe effect on price',
  body: (ctx) => {
    const { config, limits } = ctx
    const s = config.quality_swing
    const adult = config.people_preferences.Adult
    return (
      <>
        <P>
          How much your recipe moves what customers are willing to pay, from {limits.quality_swing.min} to {limits.quality_swing.max}.
        </P>
        {withHelp(ctx, (help) => (
          <P>
            With {s}, a cup a customer loves (quality 100%) makes them pay up to <strong>{pct(help.quality_swing.best)}</strong> of their budget, an average
            cup {pct(help.quality_swing.average)}, and a cup they dislike in every way <strong>{pct(help.quality_swing.worst)}</strong>.
          </P>
        ))}
        <Formula>would pay = budget × (1 + quality swing × (2 × quality − 1))</Formula>
        <List
          items={[
            '0 means the recipe never changes what people pay: only price matters for whether they buy.',
            'Higher values reward a recipe tuned to your customers with room to charge more, and punish a poor recipe harder.',
          ]}
        />
        {withHelp(ctx, (help) => (
          <Example>
            Adults have a budget of {money(adult.average_expense)}: they would pay {money(help.people.Adult.wtp_best)} for their favourite cup and{' '}
            {money(help.people.Adult.wtp_worst)} for one they dislike in every way.
          </Example>
        ))}
      </>
    )
  },
}

const startingPopularity: Doc = {
  title: () => 'Starting popularity',
  body: (ctx) => {
    const { config, limits } = ctx
    const s = config.starting_popularity
    return (
      <>
        <P>
          Popularity is how well liked your stand is, from 0% to 100%. It multiplies every customer’s chance to buy, on top of what your price and recipe give.
          This is where it starts{ctx.help ? <>: with {s}, day 1’s chances are multiplied by <strong>×{ctx.help.popularity.start_factor.toFixed(2)}</strong></> : null}.
        </P>
        <H>How it is worked out</H>
        <Formula>{`success rate = cups sold ÷ visitors           // one day
popularity   = the plain average of the success rates
               of every day so far that had visitors`}</Formula>
        <List
          items={[
            'The starting popularity is used only until a day has had visitors. From then on it is dropped: it is not part of the average.',
            'It is worked out each morning and holds for the whole day.',
            'Every day counts the same, however many visitors it had, so in a long game one day moves it less and less.',
            'Visitors who find you sold out count as not sold. Days with no visitors are skipped.',
          ]}
        />
        <H>How it changes sales</H>
        <Formula>{`chance to buy = price-and-recipe chance × (0.5 + popularity)      // at most 100%`}</Formula>
        <List
          items={[
            '50% is neutral: customers buy exactly as price and recipe say. At 0% every chance is halved; at 100% it is 1.5 times as high.',
            <>
              Under 50%, some visitors who would have bought at a neutral 50% say no. The day report counts them as “{REASON_TEXT.not_popular}”. At 50% or more,
              popularity never causes a no.
            </>,
          ]}
        />
        <H>What makes it go up or down</H>
        <List
          items={[
            'A day raises popularity when its success rate is above the popularity it was played with, and lowers it when below. 50% is not the line: at 30% popularity, selling to 40% of your visitors raises it.',
            'The weather changes who comes out. Each customer type has its own budget and taste, so the same price and recipe can sell to a different share of visitors on a rainy day than on a sunny one.',
          ]}
        />
        {withHelp(ctx, (help) => {
          const plan = help.plans.typical
          return (
            <>
              <LineChart
                title={`Chance to buy ${money(plan.price)} with ${recipeText(plan.recipe)}, by popularity`}
                labels={help.grids.popularity.map((x) => pct(x))}
                series={PERSON_TYPES.map((t) => ({ label: t, data: help.people[t].popularity_chance, color: PERSON_SERIES[t] }))}
                xLabel="Popularity"
                yLabel="Chance to buy"
                fmt="percent"
              />
              <Example>
                <Table
                  head={['Popularity', 'Multiplier', 'Adult buys their favourite cup at their budget']}
                  rows={help.popularity.probes.map((p) => [
                    p.popularity === s ? <strong key="p">{pct(p.popularity)} (start)</strong> : pct(p.popularity),
                    `×${p.factor.toFixed(2)}`,
                    pct(p.favourite_at_budget.Adult),
                  ])}
                />
              </Example>
            </>
          )
        })}
        <H>On the end screen</H>
        <P>
          <strong>Success rate</strong> is all cups sold ÷ all visitors of the game, so a busy day counts more. <strong>Final popularity</strong> is the average
          of the daily success rates, so every day counts the same. They differ when days have different crowds: 90 of 100 visitors one day and 1 of 10 the
          next is an 83% success rate but a 50% final popularity.
        </P>
        <Note>
          Must be between {limits.starting_popularity.min} and {limits.starting_popularity.max}. 0.5 makes day 1 play exactly on price and recipe.
        </Note>
      </>
    )
  },
}

const spawnPerHour: Doc = {
  title: ({ person }) => `Base visitors / hour${person ? ` (${person})` : ''}`,
  body: (ctx) => {
    const { config, person = 'Child' } = ctx
    const p = config.people_preferences[person]
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
        {withHelp(ctx, (help) => (
          <>
            <LineChart
              title={`Expected ${person.toLowerCase()} visitors per hour, by weather`}
              labels={help.grids.hours.map((x) => `${x}:00`)}
              series={WEATHER_TYPES.map((w) => ({
                label: `${cap(w)} (${help.weather[w].typical_temperature}°C)`,
                color: WEATHER_SERIES[w],
                emphasis: w === p.preferred_weather,
                data: help.people[person].spawn[w],
              }))}
              xLabel="Hour"
              yLabel="Visitors / hour"
            />
            <Example>
              At {p.preferred_hour}:00 on a {p.preferred_weather} day at {help.weather[p.preferred_weather].typical_temperature}°C, expect about{' '}
              <strong>{help.people[person].preferred_hour_spawn[p.preferred_weather].toFixed(1)}</strong> {person.toLowerCase()} visitors that hour.
            </Example>
          </>
        ))}
        <CustomersCap ctx={ctx} />
      </>
    )
  },
}

const averageExpense: Doc = {
  title: ({ person }) => `Expects to pay${person ? ` (${person})` : ''}`,
  body: (ctx) => {
    const { config, person = 'Child' } = ctx
    const p = config.people_preferences[person]
    return (
      <>
        <P>
          The budget of a {person.toLowerCase()}: what they would pay for an average cup, {money(p.average_expense)}. A recipe they like raises what they would
          pay, one they dislike lowers it (see “Recipe effect on price”).
          {ctx.help ? <> For their favourite cup they would pay {money(ctx.help.people[person].wtp_best)}.</> : null}
        </P>
        <List
          items={[
            'Half of them buy at exactly what they would pay; more buy below it, fewer above.',
            ctx.help
              ? `Under ${money(ctx.help.people[person].cheap_floor)} the cup looks suspiciously cheap, and fewer buy the cheaper it gets (see “Price tolerance”).`
              : 'Well under their budget the cup looks suspiciously cheap, and fewer buy the cheaper it gets (see “Price tolerance”).',
            'The chances below are at a neutral popularity of 50%; popularity scales them up or down (see “Starting popularity”).',
            'It must fall inside the cup price range.',
          ]}
        />
        {withHelp(ctx, (help) => (
          <>
            <LineChart
              title="Chance to buy their favourite cup"
              labels={help.grids.prices.map(dollars)}
              series={typeSeries((t) => help.people[person].favourite_chance[t], person)}
              xLabel="Cup price"
              yLabel="Chance to buy"
              fmt="percent"
            />
            <Example>
              <Table
                head={['You charge', 'Chance to buy their favourite cup']}
                rows={help.people[person].favourite_probes.map((x) => [money(x.price), pct(x.chance)])}
              />
            </Example>
          </>
        ))}
      </>
    )
  },
}

function priceToleranceDoc(): Doc {
  return {
    title: ({ person }) => `Price tolerance${person ? ` (${person})` : ''}`,
    body: (ctx) => {
      const { config, limits, person = 'Child' } = ctx
      const p = config.people_preferences[person]
      const t = p.tolerances.price
      return (
        <>
          <P>How a {person.toLowerCase()} reacts to your price, as shares of their budget ({money(p.average_expense)}).</P>
          {withHelp(ctx, (help) => {
            const f = help.people[person]
            return (
              <>
                <List
                  items={[
                    <>
                      <strong>Below ({pct(t.below)}).</strong> A price more than {pct(t.below)} under their budget looks suspicious: under {money(f.cheap_floor)}{' '}
                      the chance to buy shrinks in proportion to the price, and the day report says “{REASON_TEXT.too_cheap}”.
                    </>,
                    <>
                      <strong>Above ({pct(t.above)}).</strong> How quickly interest fades once you charge more than they would pay. {pct(t.above)} of their budget (
                      {money(f.price_reach)}) past what they would pay, only about 5% still buy.
                    </>,
                  ]}
                />
                <Example>
                  For their favourite cup they would pay {money(f.wtp_best)}: half buy at that price, about 95% at {money(f.sure_price)}, and about 5% at{' '}
                  {money(f.long_shot_price)}.
                </Example>
              </>
            )
          })}
          <Note>
            Below must be between {pct(limits.price_tolerance_below.min)} and {pct(limits.price_tolerance_below.max)}; above must be more than{' '}
            {pct(limits.price_tolerance_above.min)} and at most {pct(limits.price_tolerance_above.max)}.
          </Note>
        </>
      )
    },
  }
}

const preferredDegrees: Doc = {
  title: ({ person }) => `Favourite temperature${person ? ` (${person})` : ''}`,
  body: (ctx) => {
    const { config, person = 'Child' } = ctx
    const p = config.people_preferences[person]
    return (
      <>
        <P>
          The temperature {person.toLowerCase()} customers like best: {p.preferred_degrees}°C. The closer the day is to it, the more of them come out. It does
          not change whether they buy.
        </P>
        <P>The temperature score is one third of their visitor bonus.</P>
        {withHelp(ctx, (help) => (
          <LineChart
            title="Temperature score"
            labels={help.grids.temperatures.map((x) => `${x}°`)}
            series={typeSeries((t) => help.people[t].temperature_score, person)}
            xLabel="Temperature °C"
            yLabel="Temperature score"
            fmt="percent"
          />
        ))}
        <Note>It must fall inside the temperature range, or the configuration is invalid.</Note>
      </>
    )
  },
}

const preferredWeather: Doc = {
  title: ({ person }) => `Favourite weather${person ? ` (${person})` : ''}`,
  body: (ctx) => {
    const { config, person = 'Child' } = ctx
    const p = config.people_preferences[person]
    return (
      <>
        <P>
          The weather {person.toLowerCase()} customers like best: {p.preferred_weather}. When the day matches, the weather part of their visitor bonus is 1;
          otherwise it is 0. It is all or nothing, and adds up to a third of the bonus.
        </P>
        <P>This works on top of the weather’s traffic multiplier, which applies to everyone.</P>
        {withHelp(ctx, (help) => (
          <BarChart
            title={`Expected ${person.toLowerCase()} visitors at ${p.preferred_hour}:00, by weather`}
            labels={WEATHER_TYPES.map(cap)}
            series={[{ label: 'Visitors / hour', data: WEATHER_TYPES.map((w) => help.people[person].preferred_hour_spawn[w]), color: PERSON_SERIES[person] }]}
            xLabel="Weather (at the middle of its temperature range)"
            yLabel="Visitors / hour"
          />
        ))}
      </>
    )
  },
}

const preferredHour: Doc = {
  title: ({ person }) => `Favourite hour${person ? ` (${person})` : ''}`,
  body: (ctx) => {
    const { config, person = 'Child' } = ctx
    const p = config.people_preferences[person]
    return (
      <>
        <P>
          The hour {person.toLowerCase()} customers most like to be out: {p.preferred_hour}:00. Their traffic peaks at this hour and fades towards the far end of
          the opening hours. It is one third of their visitor bonus and does not change whether they buy.
        </P>
        {withHelp(ctx, (help) => (
          <LineChart
            title="Hour score"
            labels={help.grids.hours.map((x) => `${x}:00`)}
            series={typeSeries((t) => help.people[t].hour_score, person)}
            xLabel="Hour"
            yLabel="Hour score"
            fmt="percent"
          />
        ))}
        <Note>It must be within the opening hours, or the configuration is invalid.</Note>
      </>
    )
  },
}

/** Each type's score for one ingredient across its recipe range, the selected type drawn thicker. */
function ingredientChart(ctx: DocCtx, n: RecipeIngredient, person: PersonType): ReactNode {
  return withHelp(ctx, (help) => (
    <LineChart
      title={`${cap(n)} score`}
      labels={help.grids.per_cup[n]}
      series={typeSeries((t) => help.people[t].ingredient_score[n], person)}
      xLabel={`${cap(n)} per cup`}
      yLabel="Score"
      fmt="percent"
    />
  ))
}

function preferredIngredient(n: RecipeIngredient): Doc {
  return {
    title: ({ person }) => `Favourite ${n}${person ? ` (${person})` : ''}`,
    body: (ctx) => {
      const { config, person = 'Child' } = ctx
      const p = config.people_preferences[person]
      const fav = p[`preferred_${n}`] as number
      const t = p.tolerances[n]
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
          {ingredientChart(ctx, n, person)}
          <Note>It must fall inside the recipe limits for {n}.</Note>
        </>
      )
    },
  }
}

function ingredientToleranceDoc(n: RecipeIngredient): Doc {
  return {
    title: ({ person }) => `${cap(n)} tolerance${person ? ` (${person})` : ''}`,
    body: (ctx) => {
      const { config, person = 'Child' } = ctx
      const p = config.people_preferences[person]
      const fav = p[`preferred_${n}`] as number
      const t = p.tolerances[n]
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
          {ingredientChart(ctx, n, person)}
        </>
      )
    },
  }
}

/* ----------------------------------------------------------- Ingredients */

const ingredientsSection: Doc = {
  title: () => 'Ingredients and spoilage',
  body: (ctx) => {
    const { config } = ctx
    const perishable = INGREDIENTS.filter((n) => !config.ingredients[n].never_perishes)
    // The chart's x-axis: enough nights to see the slowest ingredient spoil, at most 30.
    const days = Math.min(Math.max(10, ...perishable.map((n) => config.ingredients[n].max_days)), 30)
    const xs = Array.from({ length: days + 1 }, (_, i) => i)
    const figures = perishable.map((n) => ctx.ingredients?.[n] ?? null)
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
        {!perishable.length ? null : figures.every((f) => f !== null) ? (
          <Figures stale={ctx.stale}>
            <LineChart
              title="Share of a batch still good, if none of it is sold"
              labels={xs.map((x) => (x === 0 ? 'Bought' : `Night ${x}`))}
              series={perishable.map((n, i) => ({ label: cap(n), color: INGREDIENT_SERIES[n], data: figures[i]!.survival.slice(0, days + 1) }))}
              xLabel="Nights since purchase"
              yLabel="Still good"
              fmt="percent"
            />
          </Figures>
        ) : (
          <Waiting ctx={ctx} />
        )}
      </>
    )
  },
}

const unitCost: Doc = {
  title: ({ ingredient }) => `Cost per unit${ingredient ? ` (${ingredient})` : ''}`,
  body: (ctx) => {
    const { config, ingredient = 'lemons' } = ctx
    return (
      <>
        <P>
          The list price of one unit of {ingredient}: {money(config.ingredients[ingredient].unit_cost)}. A unit is one ice cube, one spoon of sugar, one lemon or
          one cup. Each pack size can knock a discount off this price (see “Packs on sale”).
        </P>
        <Formula>{`pack price   = size × unit cost × (1 − pack discount)
${COST_RULE}`}</Formula>
        <P>
          So the cost per cup comes from the stock you actually hold, at the price you paid for it. Cheap bulk stock lowers it, and so does using up older stock
          bought at a discount. The planning screen shows it for the plan you are making.
        </P>
        {withHelp(ctx, (help) => {
          const { smallest, biggest, usage } = help.cup_cost
          return (
            <Example title="A mid-range cup on day 1">
              <Table
                head={['Ingredient', 'Units per cup', 'List price per unit']}
                rows={INGREDIENTS.map((n) => [cap(n), usage[n], money(config.ingredients[n].unit_cost)])}
              />
              <p className="mt-2">
                {smallest.cost_per_cup === null ? (
                  'One smallest pack of each ingredient does not make a single cup of this recipe.'
                ) : (
                  <>
                    One smallest pack of each ingredient makes {smallest.cups_possible} cups at <strong>{money(smallest.cost_per_cup)}</strong> a cup. Selling at{' '}
                    {money(help.plans.sample.price)} leaves <strong>{money(smallest.margin_per_cup ?? 0)}</strong> per cup sold.{' '}
                  </>
                )}
                {biggest.cost_per_cup === null ? null : (
                  <>
                    One biggest pack of each makes {biggest.cups_possible} cups at <strong>{money(biggest.cost_per_cup)}</strong> a cup.
                  </>
                )}
              </p>
            </Example>
          )
        })}
      </>
    )
  },
}

const packs: Doc = {
  title: ({ ingredient }) => `Packs on sale${ingredient ? ` (${ingredient})` : ''}`,
  body: (ctx) => {
    const { config, limits, ingredient = 'lemons' } = ctx
    const cfg = config.ingredients[ingredient]
    const shares = ctx.help?.pack_cash_share[ingredient]
    return (
      <>
        <P>
          The packs you can buy each morning. Each pack has a size and its own discount, so bigger packs can be cheaper per unit. You always buy whole
          packs, up to {limits.packs_per_size.max} of each size a day.
        </P>
        <Formula>pack price = size × unit cost × (1 − discount), rounded to the cent</Formula>
        <List
          items={[
            `From ${limits.packs.min} to ${limits.packs.max} pack sizes. Sizes are whole numbers from ${limits.pack_size.min} to ${limits.pack_size.max.toLocaleString('en')}, with no repeats.`,
            `Discounts go from ${pct(limits.pack_discount.min)} to ${pct(limits.pack_discount.max)}. Only pack discounts exist; there is no discount for buying many packs.`,
            'A warning appears when a bigger pack costs more per unit than a smaller one. It is allowed, but players will rarely buy that pack.',
          ]}
        />
        {withIngredient(ctx, ingredient, (f) => (
          <>
            <BarChart
              title={`${cap(ingredient)}: price per unit by pack`}
              labels={f.packs.map((p) => `${p.size}`)}
              series={[{ label: 'Price per unit', data: f.packs.map((p) => p.unit_price), color: INGREDIENT_SERIES[ingredient] }]}
              xLabel="Pack size (units)"
              yLabel="Price per unit"
              fmt="money"
            />
            <Example title={`Current ${ingredient} packs`}>
              <Table
                head={['Pack', 'Discount', 'Price', 'Per unit', 'Share of starting cash']}
                rows={f.packs.map((p, i) => [`${p.size} units`, pct(p.discount), money(p.price), money(p.unit_price), shares ? pct(shares[i]) : '…'])}
              />
            </Example>
            {f.break_even_units !== null && !cfg.never_perishes ? (
              <>
                <H>The catch: spoilage</H>
                <P>
                  A discount only pays off if you use the stock before it spoils. The pack of {f.biggest.size} costs {money(f.biggest.price)}. Buying the same
                  units in packs of {f.smallest.size} would cost {money(f.smallest.unit_price)} each, so the big pack is only the better deal if you use at least{' '}
                  <strong>{f.break_even_units}</strong> of its {f.biggest.size} units. The rest can spoil and you still come out ahead.
                </P>
              </>
            ) : null}
          </>
        ))}
        <H>Cost and margin per cup</H>
        <Formula>{COST_RULE}</Formula>
        <P>
          Every purchase is kept as its own batch with the price you paid. The planning screen’s cost per cup is the average cost of the cups you can make today:
          your oldest stock first, then today’s packs, the dearest per unit first, so the cheapest stock is kept longest. The what-if chart’s expected margin
          uses the same cost. Margin per cup is the price minus that cost; its percentage is the share of the price you keep.
        </P>
        <P>
          The day report shows what the cups you sold cost. On a day with no sales it shows what the cups you could have made would have cost, or “–” if you had
          nothing to make a cup from.
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
    body: (ctx) => {
      const { config, ingredient = 'lemons' } = ctx
      const cfg = config.ingredients[ingredient]
      // The charts' x-axis: every night up to max days, at most 30.
      const days = Math.min(Math.max(cfg.max_days, 1), 30)
      const nights = Array.from({ length: days }, (_, i) => i + 1)
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
          {withIngredient(ctx, ingredient, (f) => {
            const [first, second] = f.example_batch.after
            return (
              <>
                <BarChart
                  title={`${cap(ingredient)}: chance to spoil each night`}
                  labels={nights.map((d) => `Night ${d}`)}
                  series={[{ label: 'Chance to spoil', data: f.hazard.slice(0, days), color: '#eb6834' }]}
                  xLabel="Nights since purchase"
                  yLabel="Chance"
                  fmt="percent"
                />
                <LineChart
                  title={`${cap(ingredient)}: share of a batch still good`}
                  labels={nights.map((d) => `Night ${d}`)}
                  series={[{ label: 'Still good', data: f.survival.slice(1, days + 1), color: INGREDIENT_SERIES[ingredient] }]}
                  xLabel="Nights since purchase"
                  yLabel="Still good"
                  fmt="percent"
                />
                <Example>
                  Buy {f.example_batch.size} {ingredient} and sell none: after night {first.night} you would have about <strong>{first.left}</strong> left, and
                  after night {second.night} about <strong>{second.left}</strong>.
                </Example>
              </>
            )
          })}
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
