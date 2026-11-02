import type { Chart, ChartType, Plugin } from 'chart.js'

export interface ReferenceRule {
  /** Value on the y axis. */
  value: number
  label: string
  color?: string
  dash?: number[]
}

export interface ReferenceRuleOptions {
  rules?: ReferenceRule[]
}

declare module 'chart.js' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- type parameter must match chart.js's declaration
  interface PluginOptionsByType<TType extends ChartType> {
    referenceRule?: ReferenceRuleOptions
  }
}

/**
 * Draws labelled horizontal rules on the canvas from `options.plugins.referenceRule`.
 * A rule is never a dataset, so it stays out of tooltips, legends and tables.
 */
export const referenceRule: Plugin<'bar' | 'line', ReferenceRuleOptions> = {
  id: 'referenceRule',
  afterDatasetsDraw(chart: Chart, _args, opts) {
    const rules = opts?.rules
    const y = chart.scales.y
    if (!rules || rules.length === 0 || !y) return
    const { ctx, chartArea } = chart
    for (const rule of rules) {
      const py = y.getPixelForValue(rule.value)
      if (!Number.isFinite(py) || py < chartArea.top || py > chartArea.bottom) continue
      const color = rule.color ?? '#6b6a65'
      ctx.save()
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = 1.5
      ctx.setLineDash(rule.dash ?? [6, 4])
      ctx.beginPath()
      ctx.moveTo(chartArea.left, py)
      ctx.lineTo(chartArea.right, py)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = '600 11px Nunito, ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(rule.label, chartArea.right - 4, py - 3)
      ctx.restore()
    }
  },
}
