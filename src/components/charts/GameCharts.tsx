import type { ReactElement } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import ChartBox from './ChartBox'
import { barStyle, baseOptions, NEUTRAL, INGREDIENT_SERIES, lineStyle, OUTCOME_SERIES, PERSON_SERIES, SINGLE } from './chartSetup'
import { INGREDIENTS, PERSON_TYPES, type GameSummary } from '../../types/game'
import { money, pct } from '../../utils/format'

/** End-of-game (and profile) charts. Every chart has one y-axis and a table view. */
export default function GameCharts(props: { summary: GameSummary }): ReactElement {
  const days = props.summary.days
  const labels = days.map((d) => `Day ${d.day}`)

  const hours = new Map<number, { visitors: number; buyers: number }>()
  for (const d of days)
    for (const h of d.by_hour) {
      const cur = hours.get(h.hour) ?? { visitors: 0, buyers: 0 }
      cur.visitors += h.visitors
      cur.buyers += h.buyers
      hours.set(h.hour, cur)
    }
  const hourKeys = [...hours.keys()].sort((a, b) => a - b)
  // Games finished before popularity existed carry none.
  const hasPopularity = days.some((d) => d.popularity != null)
  const popularityOptions = baseOptions<'line'>({ percent: true })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartBox
        title="Cash at the end of each day"
        table={{ head: ['Day', 'Cash', 'Profit'], rows: days.map((d) => [d.day, money(d.cash_end), money(d.profit)]) }}
      >
        <Line
          data={{ labels: ['Start', ...labels], datasets: [{ label: 'Cash', data: [props.summary.starting_cash, ...days.map((d) => d.cash_end)], ...lineStyle(SINGLE), fill: false }] }}
          options={{ ...baseOptions<'line'>({ money: true }), plugins: { ...baseOptions<'line'>({ money: true }).plugins, legend: { display: false } } }}
        />
      </ChartBox>

      <ChartBox
        title="Profit per day (sales − purchases)"
        table={{ head: ['Day', 'Revenue', 'Spend', 'Profit'], rows: days.map((d) => [d.day, money(d.revenue), money(d.spend), money(d.profit)]) }}
      >
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: 'Profit',
                data: days.map((d) => d.profit),
                ...barStyle(SINGLE),
                backgroundColor: days.map((d) => (d.profit >= 0 ? SINGLE : '#e34948')),
              },
            ],
          }}
          options={{ ...baseOptions<'bar'>({ money: true }), plugins: { ...baseOptions<'bar'>({ money: true }).plugins, legend: { display: false } } }}
        />
      </ChartBox>

      <ChartBox
        title="What happened to every visitor"
        table={{ head: ['Day', 'Visitors', 'Bought', 'Sold out', 'Refused', 'Conversion'], rows: days.map((d) => [d.day, d.visitors, d.buyers, d.sold_out, d.refused, pct(d.conversion)]) }}
      >
        <Bar
          data={{
            labels,
            datasets: [
              { label: 'Bought', data: days.map((d) => d.buyers), ...barStyle(OUTCOME_SERIES.bought) },
              { label: 'Sold out', data: days.map((d) => d.sold_out), ...barStyle(OUTCOME_SERIES.sold_out) },
              { label: 'Refused', data: days.map((d) => d.refused), ...barStyle(OUTCOME_SERIES.refused) },
            ],
          }}
          options={baseOptions<'bar'>({ stacked: true, yLabel: 'people' })}
        />
      </ChartBox>

      <ChartBox
        title="Conversion by customer type"
        table={{
          head: ['Day', ...PERSON_TYPES],
          rows: days.map((d) => [d.day, ...PERSON_TYPES.map((t) => (d.by_type[t]?.visitors ? pct(d.by_type[t].buyers / d.by_type[t].visitors) : '—'))]),
        }}
      >
        <Line
          data={{
            labels,
            datasets: PERSON_TYPES.map((t) => ({
              label: t,
              data: days.map((d) => (d.by_type[t]?.visitors ? d.by_type[t].buyers / d.by_type[t].visitors : null)),
              ...lineStyle(PERSON_SERIES[t]),
              spanGaps: true,
            })),
          }}
          options={baseOptions<'line'>({ percent: true })}
        />
      </ChartBox>

      {hasPopularity ? (
        <ChartBox
          title="Popularity and success rate by day"
          table={{
            head: ['Day', 'Popularity applied', 'Buy chance ×', 'Success rate'],
            rows: days.map((d) => [d.day, d.popularity == null ? '—' : pct(d.popularity), d.popularity == null ? '—' : `×${(0.5 + d.popularity).toFixed(2)}`, pct(d.conversion)]),
          }}
        >
          <Line
            data={{
              labels,
              datasets: [
                { label: 'Popularity', data: days.map((d) => d.popularity ?? null), ...lineStyle(SINGLE), spanGaps: true },
                { label: 'Success rate', data: days.map((d) => d.conversion), ...lineStyle(OUTCOME_SERIES.bought) },
                { label: 'Neutral (50%)', data: days.map(() => 0.5), ...lineStyle(NEUTRAL), borderDash: [5, 4], pointRadius: 0 },
              ],
            }}
            options={{ ...popularityOptions, scales: { ...popularityOptions.scales, y: { ...popularityOptions.scales?.y, max: 1 } } }}
          />
        </ChartBox>
      ) : null}

      <ChartBox
        title="Spoiled ingredients per day"
        table={{ head: ['Day', ...INGREDIENTS, 'Value lost'], rows: days.map((d) => [d.day, ...INGREDIENTS.map((n) => d.perished[n]), money(d.perished_value)]) }}
      >
        <Bar
          data={{ labels, datasets: INGREDIENTS.map((n) => ({ label: n, data: days.map((d) => d.perished[n]), ...barStyle(INGREDIENT_SERIES[n]) })) }}
          options={baseOptions<'bar'>({ stacked: true, yLabel: 'units' })}
        />
      </ChartBox>

      <ChartBox
        title="Temperature and weather"
        table={{ head: ['Day', 'Weather', '°C', 'Price'], rows: days.map((d) => [d.day, d.weather, d.temperature, money(d.price)]) }}
      >
        <Line
          data={{
            labels: days.map((d) => [`Day ${d.day}`, d.weather]),
            datasets: [{ label: 'Temperature °C', data: days.map((d) => d.temperature), ...lineStyle(SINGLE) }],
          }}
          options={{ ...baseOptions<'line'>({ yLabel: '°C' }), plugins: { ...baseOptions<'line'>({}).plugins, legend: { display: false } } }}
        />
      </ChartBox>

      <ChartBox
        title="Traffic by hour (all days)"
        table={{ head: ['Hour', 'Visitors', 'Buyers'], rows: hourKeys.map((h) => [`${h}:00`, hours.get(h)!.visitors, hours.get(h)!.buyers]) }}
      >
        <Bar
          data={{
            labels: hourKeys.map((h) => `${h}:00`),
            datasets: [
              { label: 'Visitors', data: hourKeys.map((h) => hours.get(h)!.visitors), ...barStyle(NEUTRAL) },
              { label: 'Buyers', data: hourKeys.map((h) => hours.get(h)!.buyers), ...barStyle(OUTCOME_SERIES.bought) },
            ],
          }}
          options={baseOptions<'bar'>({ yLabel: 'people' })}
        />
      </ChartBox>

      <ChartBox
        title="Visitors by customer type"
        table={{ head: ['Day', ...PERSON_TYPES], rows: days.map((d) => [d.day, ...PERSON_TYPES.map((t) => d.by_type[t]?.visitors ?? 0)]) }}
      >
        <Bar
          data={{ labels, datasets: PERSON_TYPES.map((t) => ({ label: t, data: days.map((d) => d.by_type[t]?.visitors ?? 0), ...barStyle(PERSON_SERIES[t]) })) }}
          options={baseOptions<'bar'>({ stacked: true, yLabel: 'people' })}
        />
      </ChartBox>
    </div>
  )
}
