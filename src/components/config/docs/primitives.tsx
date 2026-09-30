import type { ReactElement, ReactNode } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import type { ChartOptions, TooltipItem } from 'chart.js'
import { Lightbulb, TriangleAlert } from 'lucide-react'
import ChartBox from '../../charts/ChartBox'
import { barStyle, baseOptions, lineStyle, WEATHER_SERIES } from '../../charts/chartSetup'
import { WEATHER_TYPES, type GameConfig } from '../../../types/game'

export function P(props: { children: ReactNode }): ReactElement {
  return <p className="mt-3 leading-relaxed first:mt-0">{props.children}</p>
}

export function H(props: { children: ReactNode }): ReactElement {
  return <h3 className="mt-6 mb-1 text-base font-extrabold">{props.children}</h3>
}

export function List(props: { items: ReactNode[] }): ReactElement {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed marker:text-brand-strong">
      {props.items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

export function Formula(props: { children: ReactNode }): ReactElement {
  return <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-sunken px-3 py-2 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap text-ink">{props.children}</pre>
}

export function Example(props: { title?: string; children: ReactNode }): ReactElement {
  return (
    <div className="mt-4 rounded-xl border border-brand bg-brand-soft p-3">
      <div className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-ink uppercase">
        <Lightbulb aria-hidden className="size-4 text-brand-strong" />
        {props.title ?? 'Example'}
      </div>
      <div className="mt-1 leading-relaxed">{props.children}</div>
    </div>
  )
}

export function Note(props: { children: ReactNode }): ReactElement {
  return (
    <div className="mt-4 flex gap-2 rounded-xl border border-warn/40 bg-orange-50 p-3 leading-relaxed">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
      <div>{props.children}</div>
    </div>
  )
}

export function Table(props: { head: string[]; rows: ReactNode[][] }): ReactElement {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr>
            {props.head.map((h) => (
              <th key={h} className="border-b-2 border-border px-2 py-1.5 text-left font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1.5">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface Series {
  label: string
  data: number[]
  color: string
  /** Draw thicker than the rest, e.g. the customer type the help was opened for. */
  emphasis?: boolean
  /** Draw lighter than the rest. */
  muted?: boolean
}

type Fmt = 'percent' | 'money' | 'number'

function format(v: number, fmt: Fmt): string {
  if (fmt === 'percent') return `${Math.round(v * 100)}%`
  if (fmt === 'money') return `$${v.toFixed(2)}`
  return String(Math.round(v * 100) / 100)
}

function options<T extends 'bar' | 'line'>(xLabel: string, yLabel: string, fmt: Fmt, legend: boolean): ChartOptions<T> {
  const base = baseOptions<T>({ percent: fmt === 'percent', money: fmt === 'money', yLabel }) as ChartOptions<'line'>
  return {
    ...base,
    plugins: {
      ...base.plugins,
      legend: { ...base.plugins?.legend, display: legend },
      tooltip: { callbacks: { label: (ctx: TooltipItem<'line'>) => `${ctx.dataset.label}: ${format(ctx.parsed.y ?? 0, fmt)}` } },
    },
    scales: {
      ...base.scales,
      x: { ...base.scales?.x, title: { display: true, text: xLabel } },
      y: { ...base.scales?.y, max: fmt === 'percent' ? 1 : undefined },
    },
  } as unknown as ChartOptions<T>
}

function table(labels: (string | number)[], series: Series[], xLabel: string, fmt: Fmt) {
  return { head: [xLabel, ...series.map((s) => s.label)], rows: labels.map((l, i) => [l, ...series.map((s) => format(s.data[i], fmt))]) }
}

export function LineChart(props: { title: string; labels: (string | number)[]; series: Series[]; xLabel: string; yLabel: string; fmt?: Fmt; height?: number }): ReactElement {
  const fmt = props.fmt ?? 'number'
  return (
    <div className="mt-4">
      <ChartBox title={props.title} height={props.height ?? 240} table={table(props.labels, props.series, props.xLabel, fmt)}>
        <Line
          data={{
            labels: props.labels,
            datasets: props.series.map((s) => ({
              label: s.label,
              data: s.data,
              ...lineStyle(s.color),
              borderWidth: s.emphasis ? 3.5 : 2,
              borderDash: s.muted ? [5, 4] : undefined,
              pointRadius: props.labels.length > 16 ? 0 : 3,
              tension: 0,
            })),
          }}
          options={options<'line'>(props.xLabel, props.yLabel, fmt, props.series.length > 1)}
        />
      </ChartBox>
    </div>
  )
}

export function BarChart(props: { title: string; labels: (string | number)[]; series: Series[]; xLabel: string; yLabel: string; fmt?: Fmt; height?: number }): ReactElement {
  const fmt = props.fmt ?? 'number'
  return (
    <div className="mt-4">
      <ChartBox title={props.title} height={props.height ?? 220} table={table(props.labels, props.series, props.xLabel, fmt)}>
        <Bar
          data={{ labels: props.labels, datasets: props.series.map((s) => ({ label: s.label, data: s.data, ...barStyle(s.color) })) }}
          options={options<'bar'>(props.xLabel, props.yLabel, fmt, props.series.length > 1)}
        />
      </ChartBox>
    </div>
  )
}

export function WeatherBands(props: { config: GameConfig }): ReactElement {
  const t = props.config.min_max_values.temperature
  const span = Math.max(1e-9, t.max - t.min)
  const at = (v: number) => `${((Math.min(t.max, Math.max(t.min, v)) - t.min) / span) * 100}%`
  return (
    <figure className="mt-4 rounded-2xl border border-border p-4" aria-label="Temperature ranges for each weather">
      <figcaption className="mb-3 font-bold">Which temperatures give which weather</figcaption>
      <div className="space-y-2">
        {WEATHER_TYPES.map((w) => {
          const r = props.config.weather_temperature_ranges[w]
          return (
            <div key={w} className="flex items-center gap-3 text-sm">
              <span className="w-16 font-semibold capitalize">{w}</span>
              <div className="relative h-5 flex-1 rounded bg-surface-sunken">
                <div
                  className="absolute inset-y-0 rounded"
                  style={{ left: at(r.min), width: `calc(${at(r.max)} - ${at(r.min)})`, minWidth: 2, background: WEATHER_SERIES[w] }}
                />
              </div>
              <span className="w-24 text-right tabular-nums">
                {r.min}° to {r.max}°
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex gap-3 text-xs tabular-nums">
        <span className="w-16" />
        <div className="flex flex-1 justify-between">
          <span>{t.min}°C</span>
          <span>{t.max}°C</span>
        </div>
        <span className="w-24" />
      </div>
    </figure>
  )
}
