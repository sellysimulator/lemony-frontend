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
  /** The price field's current value; the marker sits on the nearest price of the server's grid. */
  price: number
  /** A newer request is awaited: this (previous) curve is shown dimmed. */
  waiting: boolean
}

/** The server's what-if curve: expected margin across prices, with your price and the best one marked. */
export default function WhatIfChart({ preview, price, waiting }: Props): ReactElement {
  const i = nearestIndex(preview.prices, price)
  return (
    <div data-testid="what-if" style={{ opacity: waiting ? 0.5 : 1 }} aria-busy={waiting}>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat label="Chance" value={pct(preview.chance[i])} hint="Share of expected visitors who buy at this price" />
        <Stat label="Expected cups" value={String(preview.expected_cups[i])} sub={`of ${preview.expected_visitors.toFixed(1)} visitors`} />
        <Stat label="Expected margin" value={money(preview.expected_margin[i])} />
      </div>
      <ChartBox
        title="What if I charge…"
        caption="Expected values for today's weather. Real customers vary."
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
