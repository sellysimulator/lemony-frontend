import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import Card, { Stat } from '../shared/Card'
import ChartBox from '../charts/ChartBox'
import { barStyle, baseOptions, OUTCOME_SERIES } from '../charts/chartSetup'
import { acknowledgeDay } from '../../api/socketHandlers'
import { useGameStore, type WatchedDay } from '../../store/gameStore'
import { INGREDIENTS, PERSON_TYPES, type GameState } from '../../types/game'
import { Trophy } from 'lucide-react'
import { money, pct, REASON_TEXT } from '../../utils/format'
import { IngredientIcon, PersonIcon, WeatherIcon } from '../shared/icons'

export default function DayReport(props: { watch: WatchedDay; state: GameState }): ReactElement {
  const { record } = props.watch
  const setView = useGameStore((s) => s.setView)
  const finished = props.state.phase === 'finished'
  const reasons = Object.entries(record.refusal_reasons).sort((a, b) => b[1] - a[1])
  const perishedAny = INGREDIENTS.some((n) => record.perished[n] > 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">Day {record.day} report</h1>
        <span className="rounded-full bg-surface-sunken px-3 py-1 text-sm capitalize">
          <WeatherIcon weather={record.weather} /> {record.weather} · {record.temperature}°C
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setView('day')} className="rounded-xl border border-border px-4 py-2 text-sm">
            Replay day
          </button>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Visitors" value={record.visitors} />
        <Stat label="Cups sold" value={record.buyers} />
        <Stat label="Success rate" value={pct(record.conversion)} hint="Share of visitors who bought" />
        <Stat label="Sold-out misses" value={record.sold_out} tone={record.sold_out ? 'bad' : 'neutral'} hint="Wanted to buy but you ran out" />
        <Stat label="Revenue" value={money(record.revenue)} />
        <Stat label="Profit" value={money(record.profit)} tone={record.profit >= 0 ? 'good' : 'bad'} hint="Revenue minus today's purchases" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
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
                  { label: 'Refused', data: record.by_hour.map((h) => h.visitors - h.buyers - h.sold_out), ...barStyle(OUTCOME_SERIES.refused) },
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
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="py-1">Type</th>
                <th>Visitors</th>
                <th>Bought</th>
                <th>Sold out</th>
                <th>Success</th>
              </tr>
            </thead>
            <tbody>
              {PERSON_TYPES.map((t) => {
                const s = record.by_type[t]
                return (
                  <tr key={t} className="border-t border-border">
                    <td className="py-1">
                      <PersonIcon type={t} /> {t}
                    </td>
                    <td>{s.visitors}</td>
                    <td>{s.buyers}</td>
                    <td>{s.sold_out}</td>
                    <td>{s.visitors ? pct(s.buyers / s.visitors) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
        <Card title="Why people said no">
          {reasons.length ? (
            <ul className="space-y-1 text-sm">
              {reasons.map(([reason, n]) => (
                <li key={reason} className="flex">
                  <span>{REASON_TEXT[reason] ?? reason}</span>
                  <span className="ml-auto font-semibold tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Nobody turned you down!</p>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            Each refusal is attributed to the customer's lowest-scoring factor. Price {money(record.price)} · recipe <IngredientIcon name="ice" /> {record.recipe.ice}{' '}
            <IngredientIcon name="sugar" /> {record.recipe.sugar} <IngredientIcon name="lemons" /> {record.recipe.lemons} · cost/cup {money(record.cost_per_cup)}
          </p>
        </Card>
      </div>
    </div>
  )
}
