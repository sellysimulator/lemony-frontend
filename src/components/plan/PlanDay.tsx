import { useEffect, useState, type ReactElement } from 'react'
import Card, { Stat } from '../shared/Card'
import { previewPlan, submitDay } from '../../api/socketHandlers'
import { useGameStore } from '../../store/gameStore'
import { INGREDIENTS, RECIPE_INGREDIENTS, type GameState, type IngredientName } from '../../types/game'
import { Sun, TriangleAlert } from 'lucide-react'
import { money, pct } from '../../utils/format'
import { IngredientIcon, WeatherIcon } from '../shared/icons'
import WhatIfChart from './WhatIfChart'

const PREVIEW_DEBOUNCE_MS = 250

/** {ingredient: {pack size: count}}: the player's choice, as typed. The server prices it. */
type Purchases = Record<IngredientName, Record<number, number>>

function toWire(purchases: Purchases): Partial<Record<IngredientName, Record<string, number>>> {
  const wire: Partial<Record<IngredientName, Record<string, number>>> = {}
  for (const name of INGREDIENTS) {
    const packs = Object.entries(purchases[name]).filter(([, c]) => c > 0)
    if (packs.length) wire[name] = Object.fromEntries(packs)
  }
  return wire
}

const emptyPurchases = (): Purchases => ({ ice: {}, sugar: {}, lemons: {}, cups: {} })

/**
 * The morning plan. Every figure on it comes from the server: pack prices from the state,
 * and the spend, cash after, units, which packs still fit, cost and margin per cup and the
 * what-if curve from `plan_preview`, asked for (debounced) whenever the plan or price
 * changes. Until a reply arrives the figures wait ("…"); a server verdict (a refused plan,
 * a price out of range, a pack that no longer fits) only gates a button once it has
 * arrived, so the screen still works if no reply ever comes, and `submit_day` judges anyway.
 */
export default function PlanDay(props: { state: GameState }): ReactElement {
  const { state } = props
  const cfg = state.config
  const submitting = useGameStore((s) => s.submitting)
  const [purchases, setPurchases] = useState<Purchases>(emptyPurchases)
  const [recipe, setRecipe] = useState(() => ({ ...state.suggested_plan.recipe }))
  const [price, setPrice] = useState(() => state.suggested_plan.price)
  const [priceDraft, setPriceDraft] = useState<string | null>(null)
  const priceRange = cfg.min_max_values.price
  const packsPerSize = state.limits.packs_per_size

  // A count outside what the server accepts is never stored: the buttons stop at the bounds.
  const changePack = (name: IngredientName, size: number, delta: number) =>
    setPurchases((prev) => {
      const count = (prev[name][size] ?? 0) + delta
      if (count < packsPerSize.min || count > packsPerSize.max) return prev
      const next = structuredClone(prev)
      next[name][size] = count
      return next
    })

  const open = () => submitDay({ purchases: toWire(purchases), price, recipe })

  // Every figure of the plan comes from the server; ask once the plan has settled.
  useEffect(() => {
    const timer = setTimeout(() => previewPlan({ purchases: toWire(purchases), recipe, price }), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [purchases, recipe, price])
  const preview = useGameStore((s) => s.planPreview)
  const shown = preview.reply && preview.reply.day === state.day ? preview.reply : null
  const refusal = preview.refused ? (preview.message ?? 'The server refused this plan.') : null
  const point = shown?.at_price ?? null
  const costPerCup = shown?.cost_per_cup ?? null
  const margin = point?.margin_per_cup ?? null
  const busy = preview.waiting ? 'opacity-50' : ''
  const figure = (value: (reply: NonNullable<typeof shown>) => string) => (shown ? value(shown) : '…')

  const weather = state.today
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card title={`Day ${state.day} of ${state.num_days} — morning plan`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Weather" value={<span className="capitalize"><WeatherIcon weather={weather.weather} /> {weather.weather}</span>} />
            <Stat label="Temperature" value={`${weather.temperature}°C`} />
            <Stat label="Traffic" value={`×${cfg.weather_multipliers[weather.weather]}`} hint="Weather traffic multiplier" />
            <Stat
              label="Popularity"
              value={pct(state.popularity)}
              sub={`buy chance ×${state.popularity_factor.toFixed(2)}`}
              hint="Average of the daily success rates so far (the starting popularity until a day has had visitors). Every buy chance today is multiplied by 0.5 + popularity, up to 100%."
            />
            <Stat label="Cash" value={money(state.cash)} />
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Open {cfg.min_max_values.hour.min}:00 – {cfg.min_max_values.hour.max + 1}:00. The weather holds all day.
          </p>
        </Card>

        <Card title="Buy ingredients">
          <div className="grid gap-3 sm:grid-cols-2">
            {INGREDIENTS.map((name) => {
              const ing = cfg.ingredients[name]
              return (
                <div key={name} className="rounded-xl border border-border p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold capitalize">
                      <IngredientIcon name={name} /> {name}
                    </span>
                    <span className="text-xs text-ink-muted">{money(ing.unit_cost)} / unit</span>
                    <span className={`ml-auto text-sm tabular-nums ${busy}`}>+{figure((r) => String(r.units[name]))}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {state.packs[name].map((pack) => {
                      const size = pack.size
                      const count = purchases[name][size] ?? 0
                      // The server's verdict once it has one; until then only the served cap stops the button.
                      const fits = shown ? shown.can_add[name]?.[String(size)] !== false : true
                      return (
                        <div key={size} className="flex items-center gap-2 text-sm">
                          <span>
                            Pack of {size} <span className="text-ink-subtle">({money(pack.price)})</span>
                          </span>
                          {pack.discount > 0 ? (
                            <span className="rounded-full bg-good/10 px-1.5 py-0.5 text-xs font-bold text-good" title={`${money(pack.unit_price)} per unit`}>
                              −{pct(pack.discount)}
                            </span>
                          ) : null}
                          <button type="button" aria-label={`Remove a pack of ${size} ${name}`} disabled={count === 0} onClick={() => changePack(name, size, -1)} className="ml-auto h-7 w-7 rounded-md border border-border disabled:opacity-30">
                            −
                          </button>
                          <span className="w-6 text-center tabular-nums">{count}</span>
                          <button
                            type="button"
                            aria-label={`Add a pack of ${size} ${name}`}
                            title={count >= packsPerSize.max ? `Up to ${packsPerSize.max} packs of one size a day` : fits ? undefined : 'Not enough cash for another'}
                            disabled={!fits || count >= packsPerSize.max}
                            onClick={() => changePack(name, size, 1)}
                            className="h-7 w-7 rounded-md border border-border bg-brand-soft disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <div className={`mt-3 flex flex-wrap gap-4 text-sm ${busy}`} aria-busy={preview.waiting}>
            <span>
              Spend: <strong>{figure((r) => money(r.spend))}</strong>
            </span>
            <span>
              Cash after: <strong>{figure((r) => money(r.cash_after))}</strong>
            </span>
            <button type="button" onClick={() => setPurchases(emptyPurchases())} className="ml-auto text-ink-muted underline">
              Clear
            </button>
          </div>
          {refusal ? (
            <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-bad">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {refusal}
            </p>
          ) : null}
        </Card>

        <Card title="Recipe and price">
          <div className="grid gap-4 sm:grid-cols-3">
            {RECIPE_INGREDIENTS.map((name) => {
              const r = cfg.min_max_values[name]
              return (
                <label key={name} className="block">
                  <span className="text-sm font-semibold capitalize">
                    <IngredientIcon name={name} /> {name} per cup: <strong className="tabular-nums">{recipe[name]}</strong>
                  </span>
                  <input type="range" min={r.min} max={r.max} step={1} value={recipe[name]} onChange={(e) => setRecipe({ ...recipe, [name]: Number(e.target.value) })} className="mt-2 w-full accent-yellow-500" />
                </label>
              )
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-semibold">Price per cup ($)</span>
              <input
                type="number"
                step={state.limits.price_step}
                min={priceRange.min}
                max={priceRange.max}
                value={priceDraft ?? String(price)}
                onChange={(e) => {
                  setPriceDraft(e.target.value)
                  const n = Number(e.target.value)
                  if (e.target.value.trim() !== '' && Number.isFinite(n)) setPrice(n)
                }}
                onBlur={() => setPriceDraft(null)}
                // A wheel would step the focused value; see NumberField in config/fields.tsx.
                onWheel={(e) => e.currentTarget.blur()}
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 tabular-nums"
              />
              {shown?.price_error ? <span className="text-xs text-bad">{shown.price_error}</span> : null}
            </label>
            <Stat
              label="Cost per cup"
              value={shown ? (costPerCup === null ? '–' : money(costPerCup)) : '…'}
              sub={shown && costPerCup === null ? 'No stock for a cup' : undefined}
              hint="Average cost of the cups you can make today: oldest stock first at the price you paid, then today's packs with their discounts, dearest first."
            />
            <Stat
              label="Margin per cup"
              value={
                margin === null
                  ? shown
                    ? '–'
                    : '…'
                  : `${money(margin)} (${point?.margin_share == null ? '—' : pct(point.margin_share)})`
              }
              tone={margin === null ? 'neutral' : margin >= 0 ? 'good' : 'bad'}
              hint="Price minus cost per cup; the percentage is the share of the price you keep."
            />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            The day report’s <strong>Cash result</strong> is today’s sales minus everything you buy today ({figure((r) => money(r.spend))} so far), even stock you
            will use on later days. So a cup can make money while the day’s cash result is negative: for example, a $0.40 margin per cup and a −$6.70 cash
            result after buying packs for the week.
          </p>
        </Card>

        {shown ? (
          <Card title="What the price does">
            <WhatIfChart preview={shown} price={shown.price ?? price} waiting={preview.waiting} />
          </Card>
        ) : null}
      </div>

      <div className="space-y-5">
        <Card title="Inventory">
          <ul className="space-y-3">
            {INGREDIENTS.map((name) => {
              const line = state.inventory[name]
              const adding = shown?.units[name] ?? 0
              return (
                <li key={name} className="text-sm">
                  <div className="flex items-baseline">
                    <span className="font-semibold capitalize">
                      <IngredientIcon name={name} /> {name}
                    </span>
                    <span className="ml-auto tabular-nums">
                      {line.total}
                      {adding ? <span className={`text-good ${busy}`}> +{adding}</span> : null}
                    </span>
                  </div>
                  {line.batches.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {line.batches.map((b, i) => (
                        <span key={i} className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs" title={`${pct(b.risk_tonight)} spoil chance tonight`}>
                          {b.qty} × {b.age}d
                          {b.risk_tonight > 0 ? (
                            <span className="text-warn">
                              {' '}· {pct(b.risk_tonight)} <TriangleAlert aria-hidden className="inline size-3 align-[-0.1em]" />
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {line.expected_loss_tonight > 0 ? (
                    <div className="text-xs text-warn">~{Math.round(line.expected_loss_tonight)} may spoil tonight if unsold</div>
                  ) : null}
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Newly bought units spoil tonight too if their fresh period is 0 (ice melts the same day).
          </p>
        </Card>

        <Card>
          <p className="text-sm">
            With this recipe you can make <strong className="tabular-nums">{shown ? shown.cups_possible : '…'}</strong> cups.
          </p>
          <button
            type="button"
            disabled={submitting || Boolean(refusal) || Boolean(shown?.price_error)}
            onClick={open}
            className="mt-4 w-full rounded-xl bg-leaf px-5 py-3 text-lg font-bold text-white shadow-sm hover:brightness-95 disabled:opacity-40"
          >
            {submitting ? (
              'Opening the stand…'
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                Open the stand <Sun aria-hidden className="size-5" />
              </span>
            )}
          </button>
        </Card>
      </div>
    </div>
  )
}
