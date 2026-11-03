import type { Plugin } from 'chart.js'

/** Plugins valid on both the bar and the line charts of the day axis. */
export type ChartPlugins = Plugin<'bar' | 'line'>[]
import type { DayRecord } from '../../../types/game'
import { createCrosshairGroup } from '../plugins/crosshairSync'

/** What every end-screen chart is given: the days and the plugins of the shared crosshair group. */
export interface DayChartProps {
  days: DayRecord[]
  plugins: ChartPlugins
}

export const newCrosshairGroup = createCrosshairGroup

/** react-chartjs-2 types `plugins` per chart type; the kit's plugins work on both, so narrow them here. */
export function forChart<T extends 'bar' | 'line'>(plugins: ChartPlugins): Plugin<T>[] {
  return plugins as unknown as Plugin<T>[]
}
