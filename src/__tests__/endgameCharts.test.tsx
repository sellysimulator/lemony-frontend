import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GameCharts from '../components/charts/GameCharts'
import GameOver from '../components/report/GameOver'
import { useGameStore } from '../store/gameStore'
import { INGREDIENTS, type DayRecord, type GameState, type GameSummary } from '../types/game'

interface Drawn {
  kind: string
  data: { labels?: unknown[]; datasets: { label?: string; data: unknown[] }[] }
  options: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  plugins: { id: string }[]
}

const drawn = vi.hoisted(() => [] as unknown[])

vi.mock('react-chartjs-2', () => {
  const make = (kind: string) =>
    function Mock(props: { data: unknown; options?: unknown; plugins?: unknown[] }): ReactElement {
      drawn.push({ kind, data: props.data, options: props.options ?? {}, plugins: props.plugins ?? [] })
      return <canvas data-testid={`${kind}-canvas`} />
    }
  return { Line: make('line'), Bar: make('bar'), Bubble: make('bubble'), Scatter: make('scatter') }
})

const charts = (): Drawn[] => drawn as Drawn[]
const last = (pred: (c: Drawn) => boolean): Drawn => {
  const hit = charts().filter(pred).at(-1)
  if (!hit) throw new Error('chart not drawn')
  return hit
}

const zero = { ice: 0, sugar: 0, lemons: 0, cups: 0 }
const hr = (hour: number, visitors: number, buyers: number) => ({ hour, visitors, buyers, sold_out: 0 })
const types = (v: number, b: number) => ({
  Child: { visitors: v, buyers: b, sold_out: 0 },
  Teenager: { visitors: v, buyers: b, sold_out: 0 },
  Adult: { visitors: v, buyers: b, sold_out: 0 },
  Senior: { visitors: v, buyers: b, sold_out: 0 },
})

// cash_end values are deliberately NOT start + running sum of profit.
const day = (over: Partial<DayRecord>): DayRecord =>
  ({
    day: 1,
    weather: 'sunny',
    temperature: 30,
    price: 0.5,
    recipe: { ice: 1, sugar: 2, lemons: 3 },
    cost_per_cup: 0.2,
    purchased: zero,
    spend: 10,
    revenue: 15,
    profit: 5,
    visitors: 8,
    buyers: 5,
    sold_out: 0,
    refused: 3,
    conversion: 0.625,
    popularity: 0.5,
    perished: zero,
    perished_value: 0,
    cash_end: 105,
    by_type: types(2, 1),
    by_hour: [hr(9, 4, 2), hr(10, 4, 3)],
    refusal_reasons: {},
    ...over,
  }) as DayRecord

const DAYS: DayRecord[] = [
  day({ day: 1, popularity: 0.5, perished: { ice: 1, sugar: 0, lemons: 4, cups: 0 }, perished_value: 1.25 }),
  day({
    day: 2,
    popularity: 0.6,
    weather: 'rainy',
    temperature: 11,
    price: 0.75,
    recipe: { ice: 2, sugar: 1, lemons: 5 },
    profit: -7,
    visitors: 7,
    buyers: 1,
    conversion: 0.14,
    cash_end: 98,
    perished: { ice: 2, sugar: 3, lemons: 0, cups: 6 },
    perished_value: 2.5,
    by_hour: [hr(9, 5, 1), hr(10, 2, 0)],
  }),
  day({
    day: 3,
    popularity: 0.4,
    weather: 'cloudy',
    temperature: 20,
    price: 0.6,
    recipe: { ice: 3, sugar: 3, lemons: 3 },
    profit: 99,
    visitors: 15,
    buyers: 5,
    conversion: 0.33,
    cash_end: 120.5,
    perished: { ice: 0, sugar: 5, lemons: 7, cups: 0 },
    perished_value: 0.75,
    by_hour: [hr(9, 5, 4), hr(10, 10, 1)],
  }),
]

const SUMMARY = {
  num_days: 3,
  days_played: 3,
  starting_cash: 100,
  final_cash: 120.5,
  total_profit: 20.5,
  total_revenue: 0,
  total_spend: 0,
  total_visitors: 30,
  total_buyers: 11,
  total_sold_out: 0,
  final_popularity: 0.5,
  perished_totals: zero,
  days: DAYS,
} as unknown as GameSummary

beforeEach(() => {
  drawn.length = 0
})

const waterfall = (): Drawn => last((c) => c.kind === 'bar' && c.data.datasets.some((d) => d.data.some((v) => Array.isArray(v))))

/** The [start, end] bar for each day, whichever dataset (up or down) holds it. */
function bars(c: Drawn): [number, number][] {
  return DAYS.map((_, i) => {
    const hits = c.data.datasets.map((d) => d.data[i]).filter((v): v is [number, number] => Array.isArray(v))
    expect(hits).toHaveLength(1)
    return hits[0]
  })
}

describe('L1 price vs success rate bubble chart', () => {
  it('plots one point per day: x price, y conversion, size by visitors', () => {
    render(<GameCharts summary={SUMMARY} />)
    const c = last((x) => x.kind === 'bubble')
    const pts = c.data.datasets.flatMap((d) => d.data as { x: number; y: number; r: number }[])
    expect(pts.map((p) => [p.x, p.y])).toEqual([
      [0.5, 0.625],
      [0.75, 0.14],
      [0.6, 0.33],
    ])
    expect(pts[2].r).toBeGreaterThan(pts[0].r)
    expect(pts[0].r).toBeGreaterThan(pts[1].r)
    expect(c.options.scales.x.title.text).toBeTruthy()
  })

  it('carries recipe and weather in the table view', () => {
    render(<GameCharts summary={SUMMARY} />)
    const box = screen.getByText(/price vs success rate/i).closest('figure') as HTMLElement
    fireEvent.click(within(box).getByRole('button', { name: 'Show table' }))
    const table = within(box).getByRole('table')
    for (const d of DAYS) {
      expect(table).toHaveTextContent(d.weather)
      expect(table).toHaveTextContent(String(d.temperature))
    }
    // the rainy day's recipe is unique to it
    const cells = within(table).getAllByRole('cell').map((c) => c.textContent ?? '')
    expect(cells.some((c) => /\b5\b/.test(c) && /\b2\b/.test(c) && /\b1\b/.test(c))).toBe(true)
  })

  it('calls onSelectDay with the day of the clicked point', () => {
    const onSelectDay = vi.fn()
    render(<GameCharts summary={SUMMARY} onSelectDay={onSelectDay} />)
    const c = last((x) => x.kind === 'bubble')
    c.options.onClick({}, [{ datasetIndex: 0, index: 1 }], {})
    expect(onSelectDay).toHaveBeenCalledTimes(1)
    expect(onSelectDay).toHaveBeenCalledWith(2)
    c.options.onClick({}, [], {})
    expect(onSelectDay).toHaveBeenCalledTimes(1)
  })

  it('has no clickable points without a handler (profile game page)', () => {
    render(<GameCharts summary={SUMMARY} />)
    const c = last((x) => x.kind === 'bubble')
    expect(() => c.options.onClick?.({}, [{ datasetIndex: 0, index: 1 }], {})).not.toThrow()
    expect(c.options.onClick).toBeUndefined()
  })

  it('on the end screen, clicking a point opens that day\'s report', () => {
    useGameStore.getState().reset()
    const s = useGameStore.getState()
    s.handleGameCreated(1, 'g1')
    s.handleGameState(2, { game_id: 'g1', day: 4, phase: 'finished', days: DAYS, last_day_events: [], summary: SUMMARY, public_id: null } as unknown as GameState)
    render(
      <MemoryRouter>
        <GameOver summary={SUMMARY} publicId={null} signedIn={false} />
      </MemoryRouter>,
    )
    const c = last((x) => x.kind === 'bubble')
    c.options.onClick({}, [{ datasetIndex: 0, index: 2 }], {})
    const after = useGameStore.getState()
    expect(after.view).toBe('report')
    expect(after.watch?.day).toBe(3)
    expect(after.watch?.events).toEqual([])
  })
})

describe('L3 cash waterfall', () => {
  it('floats each bar from the previous server cash to this day\'s cash_end', () => {
    render(<GameCharts summary={SUMMARY} />)
    expect(bars(waterfall())).toEqual([
      [100, 105],
      [105, 98],
      [98, 120.5],
    ])
  })

  it('ends on final_cash, not on starting cash plus summed profit', () => {
    render(<GameCharts summary={SUMMARY} />)
    const list = bars(waterfall())
    expect(list.at(-1)![1]).toBe(SUMMARY.final_cash)
    expect(list.at(-1)![1]).not.toBe(100 + 5 - 7 + 99)
  })

  it('puts gains and losses in separate series, blue up and red down, named in the legend', () => {
    const { container } = render(<GameCharts summary={SUMMARY} />)
    const box = screen.getByText(/cash/i, { selector: 'figcaption *' }).closest('figure') as HTMLElement
    expect(box).toBeTruthy()
    const w = waterfall()
    expect(w.data.datasets.length).toBe(2)
    const items = within(box).getAllByRole('listitem')
    expect(items.some((li) => /up/i.test(li.textContent ?? ''))).toBe(true)
    expect(items.some((li) => /down/i.test(li.textContent ?? ''))).toBe(true)
    expect(container.querySelector('rect[fill="#e34948"]')).not.toBeNull()
  })

  it('replaces the separate Cash and Profit charts', () => {
    render(<GameCharts summary={SUMMARY} />)
    expect(screen.queryByText('Cash at the end of each day')).toBeNull()
    expect(screen.queryByText(/^Profit per day/)).toBeNull()
  })
})

describe('L4 spoilage panels', () => {
  const series = (n: string) => DAYS.map((d) => d.perished[n as keyof typeof zero])

  it('draws one panel per ingredient, each with only that ingredient in its own units', () => {
    render(<GameCharts summary={SUMMARY} />)
    for (const n of INGREDIENTS) {
      const panels = charts().filter((c) => c.kind === 'bar' && c.data.datasets.length === 1 && JSON.stringify(c.data.datasets[0].data) === JSON.stringify(series(n)))
      expect(panels.length, n).toBeGreaterThan(0)
    }
  })

  it('never stacks different ingredients together or plots their sum', () => {
    render(<GameCharts summary={SUMMARY} />)
    const sum = JSON.stringify(DAYS.map((d) => INGREDIENTS.reduce((a, n) => a + d.perished[n], 0)))
    for (const c of charts()) {
      const matching = INGREDIENTS.filter((n) => c.data.datasets.some((d) => JSON.stringify(d.data) === JSON.stringify(series(n))))
      expect(matching.length).toBeLessThanOrEqual(1)
      expect(c.data.datasets.some((d) => JSON.stringify(d.data) === sum)).toBe(false)
    }
  })

  it('captions the value lost to spoilage', () => {
    render(<GameCharts summary={SUMMARY} />)
    // 1.25 + 2.5 + 0.75
    expect(screen.getByText(/\$4\.50/)).toBeInTheDocument()
  })
})

describe('L5 traffic by hour', () => {
  it('stacks Bought and Did not buy (visitors minus buyers) per hour', () => {
    render(<GameCharts summary={SUMMARY} />)
    const c = last((x) => x.kind === 'bar' && x.data.datasets.some((d) => d.label === 'Did not buy'))
    expect(c.options.scales.x.stacked).toBe(true)
    expect(c.data.datasets.find((d) => d.label === 'Bought')?.data).toEqual([7, 4])
    expect(c.data.datasets.find((d) => d.label === 'Did not buy')?.data).toEqual([7, 12])
    expect(c.data.datasets.some((d) => d.label === 'Visitors')).toBe(false)
  })

  it('shows a day by hour grid of success rate, the value in each cell text', () => {
    render(<GameCharts summary={SUMMARY} />)
    const grid = screen.getAllByRole('table').find((t) => t.textContent?.includes('75%'))
    expect(grid).toBeTruthy()
    const cells = within(grid as HTMLElement)
      .getAllByRole('cell')
      .map((c) => c.textContent)
    for (const v of ['50%', '75%', '20%', '0%', '80%', '10%']) expect(cells).toContain(v)
  })
})

describe('L6 weather strip and crosshair', () => {
  it('shows a temperature and a weather label for each day, and no temperature chart', () => {
    render(<GameCharts summary={SUMMARY} />)
    for (const d of DAYS) {
      expect(screen.getAllByText(new RegExp(`${d.temperature}\\s*°`)).length).toBeGreaterThan(0)
      expect(screen.getAllByLabelText(new RegExp(d.weather, 'i')).length).toBeGreaterThan(0)
    }
    expect(screen.queryByText('Temperature and weather')).toBeNull()
    expect(charts().some((c) => c.data.datasets.some((d) => /temperature/i.test(d.label ?? '')))).toBe(false)
  })

  it('puts the day-axis charts in one crosshair group', () => {
    render(<GameCharts summary={SUMMARY} />)
    const withSync = charts().filter((c) => c.plugins.some((p) => p.id === 'crosshairSync'))
    expect(withSync.length).toBeGreaterThanOrEqual(3)
    const pluginOf = (c: Drawn) => c.plugins.find((p) => p.id === 'crosshairSync') as unknown as Record<string, (...a: unknown[]) => void>
    const mkChart = () => ({
      canvas: document.createElement('canvas'),
      data: { labels: ['1', '2', '3'], datasets: [{ data: [1, 2, 3] }] },
      tooltip: { setActiveElements: vi.fn() },
      setActiveElements: vi.fn(),
      getActiveElements: vi.fn(() => [{ datasetIndex: 0, index: 2 }]),
      update: vi.fn(),
    })
    const a = mkChart()
    const b = mkChart()
    pluginOf(withSync[0]).afterInit(a)
    pluginOf(withSync[1]).afterInit(b)
    pluginOf(withSync[0]).afterEvent(a, { event: { type: 'mousemove' } })
    expect(b.setActiveElements).toHaveBeenCalled()
  })
})

describe('L7 chart details', () => {
  it('draws the 50% line as a reference rule, not a dataset', () => {
    render(<GameCharts summary={SUMMARY} />)
    const c = last((x) => x.data.datasets.some((d) => d.label === 'Popularity'))
    expect(c.options.plugins.referenceRule.rules.some((r: { value: number }) => r.value === 0.5)).toBe(true)
    expect(c.data.datasets.some((d) => /neutral|50/i.test(d.label ?? ''))).toBe(false)
    expect(c.data.datasets.every((d) => d.data.some((v) => v !== 0.5))).toBe(true)
  })

  it('gives every x axis a title', () => {
    render(<GameCharts summary={SUMMARY} />)
    expect(charts().length).toBeGreaterThan(5)
    for (const c of charts()) {
      const t = c.options.scales?.x?.title
      expect(t?.display, c.data.datasets.map((d) => d.label).join()).toBe(true)
      expect(String(t?.text ?? '').length).toBeGreaterThan(0)
    }
  })
})

describe('profile game page', () => {
  it('renders the same charts with no handler', () => {
    const { rerender } = render(<GameCharts summary={SUMMARY} />)
    const withoutHandler = charts().length
    drawn.length = 0
    rerender(<GameCharts summary={SUMMARY} onSelectDay={() => {}} />)
    expect(charts().length).toBe(withoutHandler)
    expect(withoutHandler).toBeGreaterThan(5)
  })
})
