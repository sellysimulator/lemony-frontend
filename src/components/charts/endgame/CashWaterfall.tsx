import type { ChartOptions } from 'chart.js'
import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import type { GameSummary } from '../../../types/game'
import { money } from '../../../utils/format'
import ChartBox from '../ChartBox'
import Legend from '../Legend'
import { barStyle, baseOptions, LOSS, SINGLE } from '../chartSetup'
import { DAY_AXIS, waterfallSpans } from './config'
import { forChart, type DayChartProps } from './shared'

const ITEMS = [
  { key: 'up', label: 'Cash went up', swatch: { kind: 'fill' as const, color: SINGLE } },
  { key: 'down', label: 'Cash went down', swatch: { kind: 'fill' as const, color: LOSS } },
]

/** L3: each bar runs from the cash a day began with to the server's `cash_end`. */
export default function CashWaterfall(props: DayChartProps & { summary: GameSummary }): ReactElement {
  const { days, plugins, summary } = props
  const { up, down, spans } = waterfallSpans(summary)
  const base = baseOptions<'bar'>({ xLabel: DAY_AXIS, yLabel: 'Cash', money: true })
  const options = {
    ...base,
    scales: { ...base.scales, y: { ...base.scales?.y, beginAtZero: false } },
    plugins: {
      ...base.plugins,
      tooltip: {
        callbacks: {
          label: (item: { dataIndex: number }) => {
            const [a, b] = spans[item.dataIndex]
            return `${money(a)} → ${money(b)} (${b >= a ? '+' : ''}${money(b - a)})`
          },
        },
      },
    },
  } as unknown as ChartOptions<'bar'>
  return (
    <ChartBox
      title="Cash, day by day"
      caption={`From ${money(summary.starting_cash)} to ${money(summary.final_cash)}.`}
      ariaLabel="Floating bars of the cash at the start and end of each day"
      legend={<Legend items={ITEMS} />}
      table={{
        head: ['Day', 'Cash at start', 'Cash at end', 'Cash result'],
        rows: days.map((d, i) => [d.day, money(spans[i][0]), money(spans[i][1]), money(spans[i][1] - spans[i][0])]),
      }}
    >
      <Bar
        data={{
          labels: days.map((d) => `Day ${d.day}`),
          datasets: [
            { label: 'Cash went up', data: up as unknown as number[], ...barStyle(SINGLE), borderSkipped: false },
            { label: 'Cash went down', data: down as unknown as number[], ...barStyle(LOSS), borderSkipped: false },
          ],
        }}
        options={options}
        plugins={forChart<'bar'>(plugins)}
      />
    </ChartBox>
  )
}
