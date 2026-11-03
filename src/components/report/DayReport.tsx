import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import Card, { Stat } from '../shared/Card'
import ChartBox from '../charts/ChartBox'
import { barStyle, baseOptions, OUTCOME_SERIES, PERSON_SERIES, SINGLE } from '../charts/chartSetup'
import { acknowledgeDay } from '../../api/socketHandlers'
import { useGameStore, type WatchedDay } from '../../store/gameStore'
import { INGREDIENTS, PERSON_TYPES, type GameState } from '../../types/game'
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react'
import { money, pct, REASON_TEXT } from '../../utils/format'
import { IngredientIcon, PersonIcon, WeatherIcon } from '../shared/icons'

/** One horizontal bar row: label, a bar sized against `max`, and the figures as text. */
function BarRow(props: { label: ReactElement | string; value: number; max: number; color: string; figure: ReactElement | string }): ReactElement {
  const width = props.max > 0 ? (props.value / props.max) * 100 : 0
  return (
    <li className="flex items-center gap-2">
      <span className="w-36 shrink-0 truncate">{props.label}</span>
      <span className="h-4 min-w-0 flex-1 rounded-sm bg-surface-sunken">
        <span className="block h-full rounded-sm" style={{ width: `${width}%`, backgroundColor: props.color }} />
      </span>
      <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{props.figure}</span>
    </li>
  )
}

export default function DayReport(props: { watch: WatchedDay; state: GameState }): ReactElement {
  const { record } = props.watch
  const setView = useGameStore((s) => s.setView)
  const finished = props.state.phase === 'finished'
  const reasons = Object.entries(record.refusal_reasons).sort((a, b) => b[1] - a[1])
  const maxReason = Math.max(0, ...reasons.map(([, n]) => n))
  const maxVisitors = Math.max(0, ...PERSON_TYPES.map((t) => record.by_type[t].visitors))
  const perishedAny = INGREDIENTS.some((n) => record.perished[n] > 0)
  // Popularity applied today, and what the next day starts with (later days carry their own).
  const nextPopularity = props.state.days.find((d) => d.day === record.day + 1)?.popularity ?? props.state.popularity
  const trend = record.popularity == null || nextPopularity === record.popularity ? null : nextPopularity > record.popularity ? 'up' : 'down'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">Day {record.day} report</h1>
        <span className="rounded-full bg-surface-sunken px-3 py-1 text-sm capitalize">
          <WeatherIcon weather={record.weather} /> {record.weather} · {record.temperature}°C
        </span>
        <div className="ml-auto flex gap-2">
          {props.watch.events.length > 0 ? (
            <button type="button" onClick={() => setView('day')} className="rounded-xl border border-border px-4 py-2 text-sm">
              Replay day
            </button>
          ) : null}
          {finished ? (
            <button type="button" onClick={() => setView('over')} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2 font-bold">
              See final results <Trophy aria-hidden className="size-4" />
            </button>
          ) : (
            <button type="button" onClick={() => acknowledgeDay(record.day)} className="rounded-xl bg-leaf px-5 py-2 font-bold text-white">
              Plan day {record.day + 1} →
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Visitors" value={record.visitors} />
        <Stat label="Cups sold" value={record.buyers} />
        <Stat label="Success rate" value={pct(record.conversion)} tone={record.conversion >= 0.5 ? 'good' : 'bad'} hint="Share of visitors who bought" />
        <Stat
          label="Popularity"
          value={record.popularity == null ? '—' : pct(record.popularity)}
          sub={
            <span className="inline-flex items-center gap-1">
              {finished ? 'final' : 'tomorrow'} {pct(nextPopularity)}
              {trend === 'up' ? <ArrowUp aria-label="up" className="size-3.5 text-good" /> : null}
              {trend === 'down' ? <ArrowDown aria-label="down" className="size-3.5 text-bad" /> : null}
            </span>
          }
          hint="Popularity applied today, and the average success rate so far that the next day starts with"
        />
        <Stat label="Sold-out misses" value={record.sold_out} tone={record.sold_out ? 'bad' : 'neutral'} hint="Wanted to buy but you ran out" />
        <Stat label="Revenue" value={money(record.revenue)} />
        <Stat
          label="Cash result"
          value={money(record.profit)}
          tone={record.profit >= 0 ? 'good' : 'bad'}
          hint="Revenue minus everything bought today, even stock you will use on later days"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <ChartBox
            title="Customers by hour"
            table={{ head: ['Hour', 'Visitors', 'Bought', 'Sold out'], rows: record.by_hour.map((h) => [`${h.hour}:00`, h.visitors, h.buyers, h.sold_out]) }}
          >
            <Bar
              data={{
                labels: record.by_hour.map((h) => `${h.hour}:00`),
                datasets: [
                  { label: 'Bought', data: record.by_hour.map((h) => h.buyers), ...barStyle(OUTCOME_SERIES.bought) },
                  { label: 'Sold out', data: record.by_hour.map((h) => h.sold_out), ...barStyle(OUTCOME_SERIES.sold_out) },
                  { label: 'Refused', data: record.by_hour.map((h) => h.refused), ...barStyle(OUTCOME_SERIES.refused) },
                ],
              }}
              options={baseOptions<'bar'>({ stacked: true, yLabel: 'people' })}
            />
          </ChartBox>
        </div>

        <Card title="Spoiled overnight">
          {perishedAny ? (
            <ul className="space-y-1 text-sm">
              {INGREDIENTS.filter((n) => record.perished[n] > 0).map((n) => (
                <li key={n} className="flex">
                  <span className="capitalize">
                    <IngredientIcon name={n} /> {n}
                  </span>
                  <span className="ml-auto font-semibold text-warn tabular-nums">−{record.perished[n]}</span>
                </li>
              ))}
              <li className="flex border-t border-border pt-1">
                <span>Value lost</span>
                <span className="ml-auto font-semibold tabular-nums">{money(record.perished_value)}</span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Nothing spoiled.</p>
          )}
          <p className="mt-2 text-xs text-ink-muted">Spoiled units were removed from your inventory automatically.</p>
          {record.inventory_end ? (
            <div className="mt-3 text-sm">
              <div className="font-semibold">Left in stock</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {INGREDIENTS.map((n) => (
                  <span key={n} className="rounded bg-surface-sunken px-2 py-0.5">
                    <IngredientIcon name={n} /> {record.inventory_end![n]}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="By customer type">
          <ul aria-label="Visitors by customer type" className="space-y-2 text-sm">
            {PERSON_TYPES.map((t) => {
              const st = record.by_type[t]
              return (
                <BarRow
                  key={t}
                  label={
                    <>
                      <PersonIcon type={t} /> {t}
                    </>
                  }
                  value={st.visitors}
                  max={maxVisitors}
                  color={PERSON_SERIES[t]}
                  figure={
                    <>
                      {st.visitors} <span className="font-normal text-ink-muted">· {st.conversion == null ? '—' : pct(st.conversion)}</span>
                    </>
                  }
                />
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">Bar length is visitors; the percentage is the share who bought.</p>
        </Card>
        <Card title="Why people said no">
          {reasons.length ? (
            <ul aria-label="Why people said no" className="space-y-2 text-sm">
              {reasons.map(([reason, n]) => (
                <BarRow key={reason} label={REASON_TEXT[reason] ?? reason} value={n} max={maxReason} color={SINGLE} figure={String(n)} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Nobody turned you down!</p>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            “{REASON_TEXT.not_popular}” means they would have bought if your popularity were a neutral 50%; it only happens while it is lower. Otherwise each refusal
            names the price when it looked suspicious or sat further over the customer's budget than their least favourite ingredient sat from perfect, and that
            ingredient otherwise. Price {money(record.price)} · recipe <IngredientIcon name="ice" /> {record.recipe.ice} <IngredientIcon name="sugar" />{' '}
            {record.recipe.sugar} <IngredientIcon name="lemons" /> {record.recipe.lemons} · cost/cup {record.cost_per_cup == null ? '–' : money(record.cost_per_cup)}
          </p>
        </Card>
      </div>
    </div>
  )
}
