import { useMemo, useState, type ReactElement } from 'react'
import Card, { Stat } from '../shared/Card'
import { submitDay } from '../../api/socketHandlers'
import { useGameStore } from '../../store/gameStore'
import {
  INGREDIENTS,
  RECIPE_INGREDIENTS,
  type GameState,
  type IngredientName,
  type RecipeIngredient,
} from '../../types/game'
import { Sun, TriangleAlert } from 'lucide-react'
import { money, pct } from '../../utils/format'
import { IngredientIcon, WeatherIcon } from '../shared/icons'

type Purchases = Record<IngredientName, Record<number, number>>

const emptyPurchases = (): Purchases => ({ ice: {}, sugar: {}, lemons: {}, cups: {} })

function initialRecipe(state: GameState): Record<RecipeIngredient, number> {
  const last = state.days[state.days.length - 1]
  if (last) return { ...last.recipe }
  const mm = state.config.min_max_values
  const mid = (r: { min: number; max: number }) => Math.round((r.min + r.max) / 2)
  return { ice: mid(mm.ice), sugar: mid(mm.sugar), lemons: mid(mm.lemons) }
}

function initialPrice(state: GameState): number {
  const last = state.days[state.days.length - 1]
  if (last) return last.price
  const prefs = Object.values(state.config.people_preferences)
  const avg = prefs.reduce((s, p) => s + p.average_expense, 0) / prefs.length
  return Math.round(avg * 20) / 20
}

export default function PlanDay(props: { state: GameState }): ReactElement {
  const { state } = props
  const cfg = state.config
  const submitting = useGameStore((s) => s.submitting)
  const [purchases, setPurchases] = useState<Purchases>(emptyPurchases)
  const [recipe, setRecipe] = useState(() => initialRecipe(state))
  const [price, setPrice] = useState(() => initialPrice(state))
  const [priceDraft, setPriceDraft] = useState<string | null>(null)

  // Display-only previews. The server re-validates and prices the plan itself.
  const units = useMemo(() => {
    const u = { ice: 0, sugar: 0, lemons: 0, cups: 0 } as Record<IngredientName, number>
    for (const name of INGREDIENTS)
      for (const [size, count] of Object.entries(purchases[name])) u[name] += Number(size) * count
    return u
  }, [purchases])
  const cost = INGREDIENTS.reduce((s, n) => s + units[n] * cfg.ingredients[n].unit_cost, 0)
  const cashLeft = state.cash - cost
  const costPerCup =
    RECIPE_INGREDIENTS.reduce((s, n) => s + recipe[n] * cfg.ingredients[n].unit_cost, 0) + cfg.ingredients.cups.unit_cost
  const cupsPossible = Math.min(
    state.inventory.cups.total + units.cups,
    ...RECIPE_INGREDIENTS.filter((n) => recipe[n] > 0).map((n) =>
      Math.floor((state.inventory[n].total + units[n]) / recipe[n]),
    ),
  )
  const priceRange = cfg.min_max_values.price
  const priceValid = price >= priceRange.min && price <= priceRange.max

  const changePack = (name: IngredientName, size: number, delta: number) =>
    setPurchases((prev) => {
      const next = structuredClone(prev)
      next[name][size] = Math.max(0, (next[name][size] ?? 0) + delta)
      return next
    })

  const open = () => {
    const wire: Partial<Record<IngredientName, Record<string, number>>> = {}
    for (const name of INGREDIENTS) {
      const packs = Object.entries(purchases[name]).filter(([, c]) => c > 0)
      if (packs.length) wire[name] = Object.fromEntries(packs)
    }
    submitDay({ purchases: wire, price, recipe })
  }

  const weather = state.today
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card title={`Day ${state.day} of ${state.num_days} — morning plan`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Weather" value={<span className="capitalize"><WeatherIcon weather={weather.weather} /> {weather.weather}</span>} />
            <Stat label="Temperature" value={`${weather.temperature}°C`} />
            <Stat label="Traffic" value={`×${cfg.weather_multipliers[weather.weather]}`} hint="Weather traffic multiplier" />
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
                    <span className="ml-auto text-sm tabular-nums">+{units[name]}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {ing.pack_sizes.map((size) => {
                      const count = purchases[name][size] ?? 0
                      const packCost = size * ing.unit_cost
                      return (
                        <div key={size} className="flex items-center gap-2 text-sm">
                          <span className="w-24">
                            Pack of {size} <span className="text-ink-subtle">({money(packCost)})</span>
                          </span>
                          <button type="button" aria-label={`Remove a pack of ${size} ${name}`} disabled={count === 0} onClick={() => changePack(name, size, -1)} className="ml-auto h-7 w-7 rounded-md border border-border disabled:opacity-30">
                            −
                          </button>
                          <span className="w-6 text-center tabular-nums">{count}</span>
                          <button type="button" aria-label={`Add a pack of ${size} ${name}`} disabled={packCost > cashLeft + 1e-9} onClick={() => changePack(name, size, 1)} className="h-7 w-7 rounded-md border border-border bg-brand-soft disabled:opacity-30">
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
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span>
              Spend: <strong>{money(cost)}</strong>
            </span>
            <span>
              Cash after: <strong className={cashLeft < 0 ? 'text-bad' : ''}>{money(cashLeft)}</strong>
            </span>
            <button type="button" onClick={() => setPurchases(emptyPurchases())} className="ml-auto text-ink-muted underline">
              Clear
            </button>
          </div>
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
                step={0.05}
                min={priceRange.min}
                max={priceRange.max}
                value={priceDraft ?? String(price)}
                onChange={(e) => {
                  setPriceDraft(e.target.value)
                  const n = Number(e.target.value)
                  if (e.target.value.trim() !== '' && Number.isFinite(n)) setPrice(Math.round(n * 100) / 100)
                }}
                onBlur={() => setPriceDraft(null)}
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 tabular-nums"
              />
              {!priceValid ? (
                <span className="text-xs text-bad">
                  Must be {money(priceRange.min)}–{money(priceRange.max)}
                </span>
              ) : null}
            </label>
            <Stat label="Cost per cup" value={money(costPerCup)} />
            <Stat label="Margin per cup" value={`${money(price - costPerCup)} (${costPerCup > 0 ? pct((price - costPerCup) / costPerCup) : '—'})`} tone={price >= costPerCup ? 'good' : 'bad'} />
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Inventory">
          <ul className="space-y-3">
            {INGREDIENTS.map((name) => {
              const line = state.inventory[name]
              return (
                <li key={name} className="text-sm">
                  <div className="flex items-baseline">
                    <span className="font-semibold capitalize">
                      <IngredientIcon name={name} /> {name}
                    </span>
                    <span className="ml-auto tabular-nums">
                      {line.total}
                      {units[name] ? <span className="text-good"> +{units[name]}</span> : null}
                    </span>
                  </div>
                  {line.batches.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {line.batches.map((b, i) => (
                        <span key={i} className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs" title={`${Math.round(b.risk_tonight * 100)}% spoil chance tonight`}>
                          {b.qty} × {b.age}d
                          {b.risk_tonight > 0 ? (
                            <span className="text-warn">
                              {' '}· {Math.round(b.risk_tonight * 100)}% <TriangleAlert aria-hidden className="inline size-3 align-[-0.1em]" />
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
            With this recipe you can make <strong className="tabular-nums">{Number.isFinite(cupsPossible) ? cupsPossible : 0}</strong> cups.
          </p>
          <button
            type="button"
            disabled={submitting || !priceValid || cashLeft < -1e-9}
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
