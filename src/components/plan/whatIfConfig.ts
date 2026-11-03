import type { ChartData, ChartOptions } from 'chart.js'
import type { LegendItem } from '../charts/Legend'
import { baseOptions, lineStyle, PERSON_SERIES, SINGLE } from '../charts/chartSetup'
import type { PlanPreviewOk } from '../../types/game'
import { money, pct } from '../../utils/format'

export const YOUR_PRICE = PERSON_SERIES.Teenager

/** Index of the server's grid price closest to `price` (the lower one on a tie). Picks a point; computes no demand. */
export function nearestIndex(prices: number[], price: number): number {
  let best = 0
  for (let i = 1; i < prices.length; i++) if (Math.abs(prices[i] - price) < Math.abs(prices[best] - price) - 1e-9) best = i
  return best
}

/** A series with one point (at `index`) and gaps elsewhere. */
function single(length: number, index: number, value: number): (number | null)[] {
  return Array.from({ length }, (_, i) => (i === index ? value : null))
}

export function whatIfData(preview: PlanPreviewOk, price: number): ChartData<'line', (number | null)[], string> {
  const n = preview.prices.length
  const mine = nearestIndex(preview.prices, price)
  return {
    labels: preview.prices.map((p) => money(p)),
    datasets: [
      { label: 'Expected margin', data: preview.expected_margin, ...lineStyle(SINGLE), pointRadius: 0, pointHoverRadius: 4 },
      {
        label: 'Your price',
        data: single(n, mine, preview.expected_margin[mine]),
        showLine: false,
        borderColor: YOUR_PRICE,
        backgroundColor: YOUR_PRICE,
        pointStyle: 'rectRot',
        pointRadius: 8,
        pointHoverRadius: 9,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
    ],
  }
}

export function whatIfOptions(): ChartOptions<'line'> {
  const base = baseOptions<'line'>({ xLabel: 'Price per cup', yLabel: 'Expected margin', money: true })
  return {
    ...base,
    plugins: {
      ...base.plugins,
      // The marker is an annotation of the curve, not a series of its own.
      tooltip: { ...base.plugins?.tooltip, filter: (item) => item.datasetIndex === 0 },
    },
  }
}

export const whatIfLegend: LegendItem[] = [
  { key: 'curve', label: 'Expected margin', swatch: { kind: 'line', color: SINGLE } },
  { key: 'mine', label: 'Your price', swatch: { kind: 'line', color: YOUR_PRICE, pointStyle: 'rectRot' } },
]

export function whatIfTable(preview: PlanPreviewOk): { head: string[]; rows: (string | number)[][] } {
  return {
    head: ['Price', 'Chance', 'Expected cups', 'Expected margin'],
    rows: preview.prices.map((p, i) => [money(p), pct(preview.chance[i]), preview.expected_cups[i], money(preview.expected_margin[i])]),
  }
}
