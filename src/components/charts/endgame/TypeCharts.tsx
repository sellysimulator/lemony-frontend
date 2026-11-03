import type { ReactElement } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { PERSON_TYPES } from '../../../types/game'
import { pct } from '../../../utils/format'
import ChartBox from '../ChartBox'
import Legend from '../Legend'
import { barStyle, baseOptions, lineStyle, PERSON_SERIES } from '../chartSetup'
import { DAY_AXIS } from './config'
import { forChart, type DayChartProps } from './shared'

const ITEMS = PERSON_TYPES.map((t) => ({ key: t, label: t, swatch: { kind: 'line' as const, color: PERSON_SERIES[t] } }))
const FILL_ITEMS = PERSON_TYPES.map((t) => ({ key: t, label: t, swatch: { kind: 'fill' as const, color: PERSON_SERIES[t] } }))

export function TypeConversionChart({ days, plugins }: DayChartProps): ReactElement {
  return (
    <ChartBox
      title="Conversion by customer type"
      legend={<Legend items={ITEMS} />}
      table={{
        head: ['Day', ...PERSON_TYPES],
        rows: days.map((d) => [d.day, ...PERSON_TYPES.map((t) => (d.by_type[t]?.conversion == null ? '—' : pct(d.by_type[t].conversion)))]),
      }}
    >
      <Line
        data={{
          labels: days.map((d) => `Day ${d.day}`),
          datasets: PERSON_TYPES.map((t) => ({
            label: t,
            data: days.map((d) => d.by_type[t]?.conversion ?? null),
            ...lineStyle(PERSON_SERIES[t]),
            spanGaps: true,
          })),
        }}
        options={baseOptions<'line'>({ percent: true, xLabel: DAY_AXIS, yLabel: 'Success rate' })}
        plugins={forChart<'line'>(plugins)}
      />
    </ChartBox>
  )
}

export function TypeVisitorsChart({ days, plugins }: DayChartProps): ReactElement {
  return (
    <ChartBox
      title="Visitors by customer type"
      legend={<Legend items={FILL_ITEMS} />}
      table={{ head: ['Day', ...PERSON_TYPES], rows: days.map((d) => [d.day, ...PERSON_TYPES.map((t) => d.by_type[t]?.visitors ?? 0)]) }}
    >
      <Bar
        data={{
          labels: days.map((d) => `Day ${d.day}`),
          datasets: PERSON_TYPES.map((t) => ({ label: t, data: days.map((d) => d.by_type[t]?.visitors ?? 0), ...barStyle(PERSON_SERIES[t]) })),
        }}
        options={baseOptions<'bar'>({ stacked: true, xLabel: DAY_AXIS, yLabel: 'people' })}
        plugins={forChart<'bar'>(plugins)}
      />
    </ChartBox>
  )
}
