import { useState, type ReactElement } from 'react'
import { crosshairSync } from './plugins/crosshairSync'
import CashWaterfall from './endgame/CashWaterfall'
import OutcomesChart from './endgame/OutcomesChart'
import PopularityChart from './endgame/PopularityChart'
import PriceSuccessChart from './endgame/PriceSuccessChart'
import SpoilagePanels from './endgame/SpoilagePanels'
import TrafficByHour from './endgame/TrafficByHour'
import { TypeConversionChart, TypeVisitorsChart } from './endgame/TypeCharts'
import WeatherStrip from './endgame/WeatherStrip'
import { newCrosshairGroup, type ChartPlugins } from './endgame/shared'
import type { GameSummary } from '../../types/game'

/**
 * End-of-game (and profile) charts: layout only. The charts on the day axis share
 * one crosshair group. `onSelectDay` makes the price chart's points clickable.
 */
export default function GameCharts(props: { summary: GameSummary; onSelectDay?: (day: number) => void }): ReactElement {
  const days = props.summary.days
  const [plugins] = useState<ChartPlugins>(() => [crosshairSync(newCrosshairGroup())])
  // Games finished before popularity existed carry none.
  const hasPopularity = days.some((d) => d.popularity != null)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <WeatherStrip days={days} />
      <CashWaterfall days={days} plugins={plugins} summary={props.summary} />
      <PriceSuccessChart days={days} onSelectDay={props.onSelectDay} />
      <OutcomesChart days={days} plugins={plugins} />
      <TypeConversionChart days={days} plugins={plugins} />
      {hasPopularity ? <PopularityChart days={days} plugins={plugins} neutral={props.summary.neutral_popularity} /> : null}
      <SpoilagePanels days={days} plugins={plugins} summary={props.summary} />
      <TrafficByHour days={days} totals={props.summary.hour_totals} />
      <TypeVisitorsChart days={days} plugins={plugins} />
    </div>
  )
}
