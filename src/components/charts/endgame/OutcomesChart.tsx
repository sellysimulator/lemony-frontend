import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import { pct } from '../../../utils/format'
import ChartBox from '../ChartBox'
import Legend from '../Legend'
import { barStyle, baseOptions, OUTCOME_SERIES } from '../chartSetup'
import { DAY_AXIS } from './config'
import { forChart, type DayChartProps } from './shared'

const ITEMS = [
  { key: 'bought', label: 'Bought', swatch: { kind: 'fill' as const, color: OUTCOME_SERIES.bought } },
  { key: 'sold_out', label: 'Sold out', swatch: { kind: 'fill' as const, color: OUTCOME_SERIES.sold_out } },
  { key: 'refused', label: 'Refused', swatch: { kind: 'fill' as const, color: OUTCOME_SERIES.refused } },
]

export default function OutcomesChart({ days, plugins }: DayChartProps): ReactElement {
  return (
    <ChartBox
      title="What happened to every visitor"
      legend={<Legend items={ITEMS} />}
      table={{ head: ['Day', 'Visitors', 'Bought', 'Sold out', 'Refused', 'Success rate'], rows: days.map((d) => [d.day, d.visitors, d.buyers, d.sold_out, d.refused, pct(d.conversion)]) }}
    >
      <Bar
        data={{
          labels: days.map((d) => `Day ${d.day}`),
          datasets: [
            { label: 'Bought', data: days.map((d) => d.buyers), ...barStyle(OUTCOME_SERIES.bought) },
            { label: 'Sold out', data: days.map((d) => d.sold_out), ...barStyle(OUTCOME_SERIES.sold_out) },
            { label: 'Refused', data: days.map((d) => d.refused), ...barStyle(OUTCOME_SERIES.refused) },
          ],
        }}
        options={baseOptions<'bar'>({ stacked: true, xLabel: DAY_AXIS, yLabel: 'people' })}
        plugins={forChart<'bar'>(plugins)}
      />
    </ChartBox>
  )
}

