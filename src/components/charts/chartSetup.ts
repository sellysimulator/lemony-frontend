/**
 * Chart.js registration and shared styling, done once.
 *
 * Colours are the validated dataviz reference palette (light mode); every
 * categorical set below passed the palette validator (CVD ΔE ≥ 9, normal ≥ 19).
 * Some slots sit under 3:1 contrast on the surface, so every chart ships with a
 * legend and a table view of the same numbers. Entities keep their colour on
 * every chart (a Child is always blue).
 */
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js'
import type { IngredientName, PersonType, Weather } from '../../types/game'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler)
ChartJS.defaults.font.family = 'Nunito, ui-sans-serif, system-ui, sans-serif'
ChartJS.defaults.color = '#44403c'

export const SURFACE = '#ffffff'
export const GRID = 'rgba(0,0,0,0.06)'

export const PERSON_SERIES: Record<PersonType, string> = {
  Child: '#2a78d6',
  Teenager: '#eb6834',
  Adult: '#1baf7a',
  Senior: '#eda100',
}

export const INGREDIENT_SERIES: Record<IngredientName, string> = {
  ice: '#2a78d6',
  sugar: '#e87ba4',
  lemons: '#eda100',
  cups: '#4a3aa7',
}

export const WEATHER_SERIES: Record<Weather, string> = {
  sunny: '#eda100',
  cloudy: '#6b6a65',
  rainy: '#2a78d6',
  snowy: '#4a3aa7',
}

export const OUTCOME_SERIES = {
  bought: '#2a78d6',
  sold_out: '#eb6834',
  refused: '#1baf7a',
} as const

export const SINGLE = '#2a78d6'
/** Totals shown beside a categorical series (e.g. all visitors vs buyers). */
export const NEUTRAL = '#b8b6ae'

/** Thin bars, 4px rounded data end, 2px surface gap between stacked fills. */
export function barStyle(color: string) {
  return {
    backgroundColor: color,
    borderColor: SURFACE,
    borderWidth: 2,
    borderRadius: 4,
    borderSkipped: 'start' as const,
    maxBarThickness: 36,
  }
}

/** 2px lines, ≥8px hover markers with a surface ring. */
export function lineStyle(color: string) {
  return {
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    pointRadius: 3,
    pointHoverRadius: 6,
    pointBorderColor: SURFACE,
    pointBorderWidth: 2,
    tension: 0.25,
  }
}

export function baseOptions<T extends 'bar' | 'line'>(opts: { stacked?: boolean; yLabel?: string; money?: boolean; percent?: boolean }): ChartOptions<T> {
  const fmt = (v: number | string) => {
    const n = Number(v)
    if (opts.money) return `$${n.toFixed(n % 1 ? 2 : 0)}`
    if (opts.percent) return `${Math.round(n * 100)}%`
    return String(v)
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'start', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar' | 'line'>) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: { stacked: opts.stacked, grid: { display: false } },
      y: {
        stacked: opts.stacked,
        beginAtZero: true,
        grid: { color: GRID },
        border: { display: false },
        title: opts.yLabel ? { display: true, text: opts.yLabel } : undefined,
        ticks: { callback: (v: number | string) => fmt(v) },
      },
    },
  } as unknown as ChartOptions<T>
}
