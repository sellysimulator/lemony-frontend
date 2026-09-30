import { useEffect, useId, useState, type ReactElement, type ReactNode } from 'react'
import { CalendarDays, CircleCheck, CircleX, Clock, CloudSun, CupSoda, Info, LoaderCircle, Package, RotateCcw, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { CheckboxField, NumberField, RangeField, Section, SubCard } from '../components/config/fields'
import InfoButton from '../components/config/docs/InfoButton'
import PacksEditor from '../components/config/PacksEditor'
import { DocsConfigContext } from '../components/config/docs/docsContext'
import { IngredientIcon, PersonIcon, WeatherIcon } from '../components/shared/icons'
import { hazard } from '../game/configMath'
import { errorMessage } from '../api/http'
import { getConfigDefaults, validateConfig } from '../api/rest'
import { createGame } from '../api/socketHandlers'
import { useGameStore } from '../store/gameStore'
import {
  INGREDIENTS,
  PERSON_TYPES,
  RECIPE_INGREDIENTS,
  WEATHER_TYPES,
  type GameConfig,
  type IngredientConfig,
  type PersonPreferences,
  type Weather,
} from '../types/game'
import { money } from '../utils/format'
import type { RouteDescriptor } from '../routes/registry'

const VALIDATE_DEBOUNCE_MS = 400

function HazardPreview(props: { cfg: IngredientConfig }): ReactElement {
  // Show at least a few nights past max days, so a one-night ingredient (ice) still reads as a ramp to 100%.
  const days = Math.min(Math.max(props.cfg.max_days + 1, 4), 14)
  return (
    <figure className="rounded-lg bg-surface-sunken/60 p-3" aria-label="Nightly chance to spoil by age">
      <figcaption className="mb-2 text-xs font-semibold">Nightly chance to spoil</figcaption>
      <div className="flex h-12 items-end gap-0.5">
        {Array.from({ length: days }, (_, i) => {
          const p = hazard(props.cfg, i + 1)
          return (
            <div
              key={i}
              className="flex-1 rounded-t bg-warn"
              style={{ height: `${Math.max(p * 100, 3)}%` }}
              title={`Night ${i + 1}: ${Math.round(p * 100)}%`}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-muted">
        <span>night 1</span>
        <span>night {days}</span>
      </div>
    </figure>
  )
}

/** A labelled run of fields inside a card. */
function FieldGroup(props: { title: string; children: ReactNode }): ReactElement {
  return (
    <div role="group" aria-label={props.title} className="space-y-3">
      <h3 className="text-xs font-extrabold tracking-wider text-ink-muted uppercase">{props.title}</h3>
      {props.children}
    </div>
  )
}

function SelectField(props: { label: string; value: string; options: readonly string[]; info?: ReactNode; onChange(value: string): void }): ReactElement {
  const id = useId()
  return (
    <div>
      <div className="flex min-h-7 items-center gap-1">
        <label htmlFor={id} className="text-sm font-semibold">
          {props.label}
        </label>
        {props.info}
      </div>
      <select
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 capitalize focus:border-brand-strong focus:ring-2 focus:ring-brand/60 focus:outline-none"
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function ConfigPage(): ReactElement {
  const navigate = useNavigate()
  const [defaults, setDefaults] = useState<GameConfig | null>(null)
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // The verdict is tagged with the config it was computed for; any edit makes it stale ("checking").
  const [validity, setValidity] = useState<{
    for: GameConfig | null
    valid: boolean
    message: string | null
  }>({
    for: null,
    valid: true,
    message: null,
  })
  const { creating, justCreated, lastError } = useGameStore()

  useEffect(() => {
    getConfigDefaults()
      .then((d) => {
        setDefaults(d.config)
        setConfig(structuredClone(d.config))
      })
      .catch((err) => setLoadError(errorMessage(err, 'Could not load the default configuration.')))
  }, [])

  // The server owns the rules: validate against it, never re-implement them here.
  useEffect(() => {
    if (!config) return
    const timer = setTimeout(() => {
      validateConfig(config)
        .then((r) => setValidity({ for: config, valid: r.valid, message: r.message }))
        .catch((err) =>
          setValidity({
            for: config,
            valid: false,
            message: errorMessage(err, 'Some values are not valid numbers.'),
          }),
        )
    }, VALIDATE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [config])

  useEffect(() => {
    if (!justCreated) return
    useGameStore.setState({ justCreated: false })
    navigate('/play')
  }, [justCreated, navigate])

  useEffect(() => {
    if (lastError?.code === 'ACTIVE_GAME_EXISTS' && config) {
      if (confirm('You have a game in progress. Abandon it and start this new one?')) createGame(config, true)
      useGameStore.setState({ lastError: null })
    }
  }, [lastError, config])

  if (loadError) {
    return (
      <Layout>
        <p className="text-bad">{loadError}</p>
      </Layout>
    )
  }
  if (!config || !defaults) {
    return (
      <Layout>
        <LoadingSpinner size="lg" label="Loading defaults…" />
      </Layout>
    )
  }

  const update = (fn: (c: GameConfig) => void) =>
    setConfig((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  const setPerson = <K extends keyof PersonPreferences>(kind: (typeof PERSON_TYPES)[number], key: K, value: PersonPreferences[K]) =>
    update((c) => {
      c.people_preferences[kind][key] = value
    })
  const setIngredient = <K extends keyof IngredientConfig>(name: (typeof INGREDIENTS)[number], key: K, value: IngredientConfig[K]) =>
    update((c) => {
      c.ingredients[name][key] = value
    })

  const checking = validity.for !== config
  const canStart = validity.valid && !checking && !creating

  return (
    <Layout>
      <DocsConfigContext.Provider value={config}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-extrabold">Configure your stand</h1>
              <p className="mt-1 text-ink-muted">
                Every rule of the world is editable. Tap <Info aria-label="the info icon" className="inline size-4 align-[-0.15em] text-brand-strong" /> to see
                what a value does.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfig(structuredClone(defaults))}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-300 bg-surface-raised px-3 py-2 text-sm font-semibold hover:border-brand-strong"
            >
              <RotateCcw aria-hidden className="size-4" /> Reset to defaults
            </button>
          </div>

          <div className="space-y-5">
            <Section title="Game" icon={<CalendarDays aria-hidden className="size-5 text-brand-strong" />} info={<InfoButton doc="game" />}>
              <div className="space-y-3">
                <NumberField
                  label="Number of days"
                  min={1}
                  max={30}
                  value={config.num_days}
                  info={<InfoButton doc="num_days" />}
                  onChange={(v) => update((c) => void (c.num_days = Math.round(v)))}
                />
                <NumberField
                  label="Starting cash"
                  min={0}
                  step={1}
                  suffix="$"
                  value={config.starting_cash}
                  info={<InfoButton doc="starting_cash" />}
                  onChange={(v) => update((c) => void (c.starting_cash = v))}
                />
              </div>
            </Section>

            <Section
              title="Hours, temperature and price"
              icon={<Clock aria-hidden className="size-5 text-brand-strong" />}
              info={<InfoButton doc="hours_section" />}
            >
              <div className="space-y-3">
                <RangeField
                  label="Opening hours"
                  value={config.min_max_values.hour}
                  info={<InfoButton doc="hour" />}
                  onChange={(r) => update((c) => void (c.min_max_values.hour = r))}
                />
                <RangeField
                  label="Temperature"
                  suffix="°C"
                  step={0.5}
                  value={config.min_max_values.temperature}
                  info={<InfoButton doc="temperature" />}
                  onChange={(r) => update((c) => void (c.min_max_values.temperature = r))}
                />
                <RangeField
                  label="Cup price"
                  suffix="$"
                  step={0.05}
                  value={config.min_max_values.price}
                  info={<InfoButton doc="price" />}
                  onChange={(r) => update((c) => void (c.min_max_values.price = r))}
                />
              </div>
            </Section>

            <Section title="Recipe limits" icon={<CupSoda aria-hidden className="size-5 text-brand-strong" />} info={<InfoButton doc="recipe_section" />}>
              <div className="space-y-3">
                {RECIPE_INGREDIENTS.map((name) => (
                  <RangeField
                    key={name}
                    label={
                      <span>
                        <IngredientIcon name={name} /> {name.charAt(0).toUpperCase() + name.slice(1)} per cup
                      </span>
                    }
                    value={config.min_max_values[name]}
                    info={<InfoButton doc={`range_${name}`} />}
                    onChange={(r) => update((c) => void (c.min_max_values[name] = r))}
                  />
                ))}
              </div>
            </Section>

            <Section title="Weather" icon={<CloudSun aria-hidden className="size-5 text-brand-strong" />} info={<InfoButton doc="weather_section" />}>
              <div className="space-y-3">
                {WEATHER_TYPES.map((w) => (
                  <SubCard
                    key={w}
                    title={
                      <>
                        <WeatherIcon weather={w} /> {w}
                      </>
                    }
                  >
                    <div className="space-y-3">
                      <NumberField
                        compact
                        label="Traffic multiplier"
                        suffix="×"
                        step={0.05}
                        min={0}
                        max={3}
                        value={config.weather_multipliers[w]}
                        info={<InfoButton doc="traffic_multiplier" weather={w} />}
                        onChange={(v) => update((c) => void (c.weather_multipliers[w] = v))}
                      />
                      <RangeField
                        label="Temperature range"
                        suffix="°C"
                        step={0.5}
                        value={config.weather_temperature_ranges[w]}
                        info={<InfoButton doc="weather_range" weather={w} />}
                        onChange={(r) => update((c) => void (c.weather_temperature_ranges[w] = r))}
                      />
                    </div>
                  </SubCard>
                ))}
              </div>
            </Section>

            <Section title="Customers" icon={<Users aria-hidden className="size-5 text-brand-strong" />} info={<InfoButton doc="customers_section" />}>
              <div className="space-y-3">
                {PERSON_TYPES.map((kind) => {
                  const p = config.people_preferences[kind]
                  return (
                    <SubCard
                      key={kind}
                      collapsible
                      defaultOpen={kind === 'Child'}
                      title={
                        <>
                          <PersonIcon type={kind} className="size-5" /> {kind}
                        </>
                      }
                      aside={`${p.spawn_per_hour}/h · pays ~${money(p.average_expense)}`}
                    >
                      <div className="space-y-5">
                        <FieldGroup title="Traffic">
                          <NumberField
                            compact
                            label="Base visitors / hour"
                            step={0.5}
                            min={0}
                            value={p.spawn_per_hour}
                            info={<InfoButton doc="spawn_per_hour" person={kind} />}
                            onChange={(v) => setPerson(kind, 'spawn_per_hour', v)}
                          />
                          <NumberField
                            compact
                            label="Favourite hour"
                            min={0}
                            max={23}
                            value={p.preferred_hour}
                            info={<InfoButton doc="preferred_hour" person={kind} />}
                            onChange={(v) => setPerson(kind, 'preferred_hour', Math.round(v))}
                          />
                          <NumberField
                            compact
                            label="Favourite temperature"
                            suffix="°C"
                            step={0.5}
                            value={p.preferred_degrees}
                            info={<InfoButton doc="preferred_degrees" person={kind} />}
                            onChange={(v) => setPerson(kind, 'preferred_degrees', v)}
                          />
                          <SelectField
                            label="Favourite weather"
                            value={p.preferred_weather}
                            options={WEATHER_TYPES}
                            info={<InfoButton doc="preferred_weather" person={kind} />}
                            onChange={(v) => setPerson(kind, 'preferred_weather', v as Weather)}
                          />
                        </FieldGroup>
                        <FieldGroup title="Buying">
                          <NumberField
                            compact
                            label="Expects to pay"
                            step={0.05}
                            min={0}
                            suffix="$"
                            value={p.average_expense}
                            info={<InfoButton doc="average_expense" person={kind} />}
                            onChange={(v) => setPerson(kind, 'average_expense', v)}
                          />
                          {RECIPE_INGREDIENTS.map((n) => (
                            <NumberField
                              key={n}
                              compact
                              label={
                                <span>
                                  <IngredientIcon name={n} /> Favourite {n}
                                </span>
                              }
                              min={0}
                              value={p[`preferred_${n}`]}
                              info={<InfoButton doc={`preferred_${n}`} person={kind} />}
                              onChange={(v) => setPerson(kind, `preferred_${n}`, Math.round(v))}
                            />
                          ))}
                        </FieldGroup>
                      </div>
                    </SubCard>
                  )
                })}
              </div>
            </Section>

            <Section title="Ingredients" icon={<Package aria-hidden className="size-5 text-brand-strong" />} info={<InfoButton doc="ingredients_section" />}>
              <div className="space-y-3">
                {INGREDIENTS.map((name) => {
                  const cfg = config.ingredients[name]
                  return (
                    <SubCard
                      key={name}
                      collapsible
                      defaultOpen={name === 'ice'}
                      title={
                        <>
                          <IngredientIcon name={name} /> {name}
                        </>
                      }
                      aside={cfg.never_perishes ? 'never spoils' : `${money(cfg.unit_cost)} / unit`}
                    >
                      <div className="space-y-5">
                        <FieldGroup title="Buying">
                          <NumberField
                            compact
                            label="Cost per unit"
                            step={0.01}
                            min={0}
                            suffix="$"
                            value={cfg.unit_cost}
                            info={<InfoButton doc="unit_cost" ingredient={name} />}
                            onChange={(v) => setIngredient(name, 'unit_cost', v)}
                          />
                          <PacksEditor cfg={cfg} info={<InfoButton doc="packs" ingredient={name} />} onChange={(packs) => setIngredient(name, 'packs', packs)} />
                        </FieldGroup>
                        <FieldGroup title="Spoilage">
                          <CheckboxField
                            label="Never perishes"
                            checked={cfg.never_perishes}
                            info={<InfoButton doc="never_perishes" ingredient={name} />}
                            onChange={(v) => setIngredient(name, 'never_perishes', v)}
                          />
                          {cfg.never_perishes ? null : (
                            <>
                              <NumberField
                                compact
                                label="Fresh days"
                                min={0}
                                value={cfg.fresh_days}
                                info={<InfoButton doc="fresh_days" ingredient={name} />}
                                onChange={(v) => setIngredient(name, 'fresh_days', Math.round(v))}
                              />
                              <NumberField
                                compact
                                label="Max days"
                                min={1}
                                value={cfg.max_days}
                                info={<InfoButton doc="max_days" ingredient={name} />}
                                onChange={(v) => setIngredient(name, 'max_days', Math.round(v))}
                              />
                              <HazardPreview cfg={cfg} />
                            </>
                          )}
                        </FieldGroup>
                      </div>
                    </SubCard>
                  )
                })}
              </div>
            </Section>
          </div>

          <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface-raised/95 p-4 shadow-lg backdrop-blur">
            <div className="flex-1 text-sm font-semibold" aria-live="polite">
              {checking ? (
                <span className="inline-flex items-center gap-2 text-ink-muted">
                  <LoaderCircle aria-hidden className="size-4 animate-spin" /> Checking…
                </span>
              ) : validity.valid ? (
                <span className="inline-flex items-center gap-2 text-good">
                  <CircleCheck aria-hidden className="size-4" /> Configuration is valid
                </span>
              ) : (
                <span className="inline-flex items-start gap-2 text-bad">
                  <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" /> {validity.message}
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={!canStart}
              onClick={() => createGame(config)}
              className="min-h-11 rounded-xl bg-brand px-6 py-3 font-bold text-ink shadow-sm hover:brightness-95 disabled:opacity-40"
            >
              {creating ? 'Opening…' : `Start ${config.num_days}-day game`}
            </button>
          </div>
        </div>
      </DocsConfigContext.Provider>
    </Layout>
  )
}

export const route: RouteDescriptor = {
  path: '/new',
  guard: 'auth+backend',
  element: <ConfigPage />,
}
