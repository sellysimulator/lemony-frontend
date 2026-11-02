import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import type { DayRecord } from '../../../types/game'
import { pct } from '../../../utils/format'
import ChartBox from '../ChartBox'
import Legend from '../Legend'
import { barStyle, baseOptions, NEUTRAL, OUTCOME_SERIES, sequentialColor } from '../chartSetup'
import { hourRate, hourTotals } from './config'

const ITEMS = [
  { key: 'bought', label: 'Bought', swatch: { kind: 'fill' as const, color: OUTCOME_SERIES.bought } },
  { key: 'no', label: 'Did not buy', swatch: { kind: 'fill' as const, color: NEUTRAL } },
]

function HourGrid({ days, hours }: { days: DayRecord[]; hours: number[] }): ReactElement {
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
      <p className="mb-2 font-bold">Success rate by day and hour</p>
      <table role="table" aria-label="Success rate by day and hour" className="w-full text-xs tabular-nums">
        <thead>
          <tr>
            <th scope="col" className="px-2 py-1 text-left font-semibold">Day</th>
            {hours.map((h) => (
              <th key={h} scope="col" className="px-2 py-1 text-center font-semibold">{h}:00</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row" className="px-2 py-1 text-left font-semibold">{d.day}</th>
              {hours.map((h) => {
                const rate = hourRate(d, h)
                return (
                  <td key={h} className="px-2 py-1 text-center" style={rate == null ? undefined : { backgroundColor: sequentialColor(rate * 0.7) , color: rate > 0.6 ? '#fff' : undefined }}>
                    {rate == null ? '—' : pct(rate)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** L5: stacked Bought and Did not buy per hour, then a day-by-hour grid of success rate. */
export default function TrafficByHour({ days }: { days: DayRecord[] }): ReactElement {
  const t = hourTotals(days)
  const bought = t.hours.map((h) => t.buyers.get(h) ?? 0)
  const didNot = t.hours.map((h) => (t.visitors.get(h) ?? 0) - (t.buyers.get(h) ?? 0))
  return (
    <div className="min-w-0">
    <ChartBox
      title="Traffic by hour (all days)"
      legend={<Legend items={ITEMS} />}
      table={{ head: ['Hour', 'Bought', 'Did not buy'], rows: t.hours.map((h, i) => [`${h}:00`, bought[i], didNot[i]]) }}
    >
      <Bar
        data={{
          labels: t.hours.map((h) => `${h}:00`),
          datasets: [
            { label: 'Bought', data: bought, ...barStyle(OUTCOME_SERIES.bought) },
            { label: 'Did not buy', data: didNot, ...barStyle(NEUTRAL) },
          ],
        }}
        options={baseOptions<'bar'>({ stacked: true, xLabel: 'Hour of day', yLabel: 'people' })}
      />
    </ChartBox>
    <HourGrid days={days} hours={t.hours} />
    </div>
  )
}
