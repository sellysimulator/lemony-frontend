import type { ChartOptions, Plugin } from 'chart.js'
import type { ReactElement } from 'react'
import { Line } from 'react-chartjs-2'
import ChartBox from '../ChartBox'
import Legend from '../Legend'
import { baseOptions, lineStyle, NEUTRAL, OUTCOME_SERIES, SINGLE } from '../chartSetup'
import { referenceRule } from '../plugins/referenceRule'
import { pct } from '../../../utils/format'
import { DAY_AXIS } from './config'
import { forChart, type DayChartProps } from './shared'

const ITEMS = [
  { key: 'popularity', label: 'Popularity', swatch: { kind: 'line' as const, color: SINGLE } },
  { key: 'success', label: 'Success rate', swatch: { kind: 'line' as const, color: OUTCOME_SERIES.bought } },
  { key: 'neutral', label: 'Neutral (50%)', swatch: { kind: 'line' as const, color: NEUTRAL, dash: [5, 4] } },
]

/** The 50% neutral line is a `referenceRule`, so it is no dataset: not in the tooltips and not in the table. */
export default function PopularityChart({ days, plugins }: DayChartProps): ReactElement {
  const base = baseOptions<'line'>({ percent: true, xLabel: DAY_AXIS, yLabel: 'Popularity and success rate' })
  const options = {
    ...base,
    scales: { ...base.scales, y: { ...base.scales?.y, max: 1 } },
    plugins: { ...base.plugins, referenceRule: { rules: [{ value: 0.5, label: 'Neutral (50%)', color: NEUTRAL }] } },
  } as unknown as ChartOptions<'line'>
  return (
    <ChartBox
      title="Popularity and success rate by day"
      legend={<Legend items={ITEMS} />}
      table={{
        head: ['Day', 'Popularity applied', 'Buy chance ×', 'Success rate'],
        rows: days.map((d) => [d.day, d.popularity == null ? '—' : pct(d.popularity), d.popularity == null ? '—' : `×${(0.5 + d.popularity).toFixed(2)}`, pct(d.conversion)]),
      }}
    >
      <Line
        data={{
          labels: days.map((d) => `Day ${d.day}`),
          datasets: [
            { label: 'Popularity', data: days.map((d) => d.popularity ?? null), ...lineStyle(SINGLE), spanGaps: true },
            { label: 'Success rate', data: days.map((d) => d.conversion), ...lineStyle(OUTCOME_SERIES.bought) },
          ],
        }}
        options={options}
        plugins={[...forChart<'line'>(plugins), referenceRule as Plugin<'line'>]}
      />
    </ChartBox>
  )
}
