import type { ChartOptions } from 'chart.js'
import type { ReactElement } from 'react'
import { Bubble } from 'react-chartjs-2'
import type { DayRecord } from '../../../types/game'
import { money, pct } from '../../../utils/format'
import ChartBox from '../ChartBox'
import { baseOptions, GRID, SURFACE } from '../chartSetup'
import { bubblePoints, recipeText, temperatureColors } from './config'

/** L1: one bubble per day. x price, y success rate, size visitors, colour depth temperature. */
export default function PriceSuccessChart(props: { days: DayRecord[]; onSelectDay?: (day: number) => void }): ReactElement {
  const { days, onSelectDay } = props
  const base = baseOptions<'line'>({ xLabel: 'Price per cup', yLabel: 'Success rate', percent: true })
  const options = {
    ...base,
    interaction: { mode: 'nearest', intersect: true },
    scales: {
      x: { ...base.scales?.x, beginAtZero: false, grid: { color: GRID }, ticks: { callback: (v: number | string) => money(Number(v)) } },
      y: { ...base.scales?.y, max: 1 },
    },
    plugins: {
      ...base.plugins,
      tooltip: {
        callbacks: {
          title: (items: { dataIndex: number }[]) => `Day ${days[items[0].dataIndex].day}`,
          label: (item: { dataIndex: number }) => {
            const d = days[item.dataIndex]
            return [
              `Price ${money(d.price)} · success ${pct(d.conversion)} · ${d.visitors} visitors`,
              `${d.weather}, ${d.temperature}°C`,
              `Recipe: ${recipeText(d)}`,
            ]
          },
        },
      },
    },
    ...(onSelectDay
      ? {
          onClick: (_e: unknown, elements: { index: number }[]) => {
            const el = elements[0]
            if (el && days[el.index]) onSelectDay(days[el.index].day)
          },
          onHover: (e: { native?: Event | null }, elements: unknown[]) => {
            const target = e.native?.target
            if (target instanceof HTMLElement) target.style.cursor = elements.length > 0 ? 'pointer' : 'default'
          },
        }
      : {}),
  } as unknown as ChartOptions<'bubble'>
  return (
    <ChartBox
      title="Price vs success rate"
      caption={`One bubble per day. Size is visitors; a darker colour is a hotter day.${onSelectDay ? ' Click a bubble to open that day.' : ''}`}
      ariaLabel="Bubble chart of each day's price against its success rate"
      table={{
        head: ['Day', 'Price', 'Success rate', 'Visitors', 'Weather', '°C', 'Recipe'],
        rows: days.map((d) => [d.day, money(d.price), pct(d.conversion), d.visitors, d.weather, d.temperature, recipeText(d)]),
      }}
    >
      <Bubble
        data={{
          datasets: [
            {
              label: 'Days',
              data: bubblePoints(days),
              backgroundColor: temperatureColors(days),
              borderColor: SURFACE,
              borderWidth: 2,
              hoverBorderWidth: 3,
            },
          ],
        }}
        options={options}
      />
    </ChartBox>
  )
}
