import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import ChartBox from '../ChartBox'
import { barStyle, baseOptions, INGREDIENT_SERIES } from '../chartSetup'
import { DAY_AXIS, INGREDIENTS, perishedSeries, spoilageCaption } from './config'
import { forChart, type DayChartProps } from './shared'
import type { GameSummary } from '../../../types/game'

/** L4: one small panel per ingredient, each in its own units; nothing is added across ingredients. */
export default function SpoilagePanels({ days, plugins, summary }: DayChartProps & { summary: GameSummary }): ReactElement {
  return (
    <section className="space-y-2 lg:col-span-2" aria-label="Spoiled ingredients per day">
      <div>
        <h3 className="font-bold">Spoiled ingredients per day</h3>
        <p className="text-xs text-ink-muted">{spoilageCaption(summary)}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INGREDIENTS.map((n) => (
          <ChartBox
            key={n}
            title={`Spoiled ${n}`}
            height={160}
            table={{ head: ['Day', `Spoiled ${n} (units)`], rows: days.map((d) => [d.day, d.perished[n]]) }}
          >
            <Bar
              data={{ labels: days.map((d) => `Day ${d.day}`), datasets: [{ label: n, data: perishedSeries(days, n), ...barStyle(INGREDIENT_SERIES[n]) }] }}
              options={baseOptions<'bar'>({ xLabel: DAY_AXIS, yLabel: 'units' })}
              plugins={forChart<'bar'>(plugins)}
            />
          </ChartBox>
        ))}
      </div>
    </section>
  )
}
