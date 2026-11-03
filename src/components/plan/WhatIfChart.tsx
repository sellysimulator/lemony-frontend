import type { ReactElement } from 'react'
import { Line } from 'react-chartjs-2'
import ChartBox from '../charts/ChartBox'
import Legend from '../charts/Legend'
import { Stat } from '../shared/Card'
import type { PlanPreviewOk } from '../../types/game'
import { money, pct } from '../../utils/format'
import { nearestIndex, whatIfData, whatIfLegend, whatIfOptions, whatIfTable } from './whatIfConfig'

interface Props {
  preview: PlanPreviewOk
  /** The price charged; the marker sits on the nearest price of the server's grid. */
  price: number
  /** A newer request is awaited: this (previous) curve is shown dimmed. */
  waiting: boolean
}

/**
 * The server's what-if curve: expected margin across prices (at the plan's cost per cup), with
 * your price marked. The tiles show the server's figures at exactly your price (`at_price`);
 * a reply asked without a price shows the grid point under the marker instead.
 */
export default function WhatIfChart({ preview, price, waiting }: Props): ReactElement {
  const i = nearestIndex(preview.prices, price)
  const point =
    preview.at_price === undefined
      ? { chance: preview.chance[i], expected_cups: preview.expected_cups[i], expected_margin: preview.expected_margin[i] }
      : preview.at_price
  return (
    <div data-testid="what-if" style={{ opacity: waiting ? 0.5 : 1 }} aria-busy={waiting}>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat label="Chance" value={point ? pct(point.chance) : '–'} hint="Share of expected visitors who buy at this price" />
        <Stat label="Expected cups" value={point ? String(point.expected_cups) : '–'} sub={`of ${preview.expected_visitors.toFixed(1)} visitors`} />
        <Stat label="Expected margin" value={point ? money(point.expected_margin) : '–'} />
      </div>
      <ChartBox
        title="What if I charge…"
        caption="Expected values for today's weather, at today's cost per cup. Real customers vary."
        ariaLabel="Expected margin for each price you could charge today"
        height={220}
        legend={<Legend items={whatIfLegend} />}
        table={whatIfTable(preview)}
      >
        <Line data={whatIfData(preview, price)} options={whatIfOptions()} />
      </ChartBox>
    </div>
  )
}
