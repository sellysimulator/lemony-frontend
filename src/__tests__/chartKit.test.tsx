import { fireEvent, render, screen, within } from '@testing-library/react'
import { Chart as ChartJS } from 'chart.js'
import { useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChartBox, { tableFromRows } from '../components/charts/ChartBox'
import { baseOptions, registerCharts } from '../components/charts/chartSetup'
import Legend from '../components/charts/Legend'
import { createCrosshairGroup, crosshairSync } from '../components/charts/plugins/crosshairSync'
import { referenceRule } from '../components/charts/plugins/referenceRule'
import { BarChart, LineChart } from '../components/config/docs/primitives'

vi.mock('react-chartjs-2', () => ({
  Line: () => <canvas data-testid="line-canvas" />,
  Bar: () => <canvas data-testid="bar-canvas" />,
}))

const TABLE = { head: ['Day', 'Cash'], rows: [[1, '$10'], [2, '$12']] }

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
  registerCharts()
})

function stubReducedMotion(reduce: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  })
}

describe('ChartBox', () => {
  it('keeps today\'s props working: title, {head, rows} table and a table toggle', () => {
    render(
      <ChartBox title="Cash" table={TABLE}>
        <canvas />
      </ChartBox>,
    )
    expect(screen.getByText('Cash')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show table' }))
    const table = screen.getByRole('table')
    expect(within(table).getByText('Day')).toBeInTheDocument()
    expect(within(table).getByText('$12')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show chart' }))
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('labels the plot with ariaLabel, defaulting to the title', () => {
    const { rerender } = render(
      <ChartBox title="Cash" table={TABLE}>
        <canvas />
      </ChartBox>,
    )
    expect(screen.getByRole('img', { name: 'Cash' })).toBeInTheDocument()
    rerender(
      <ChartBox title="Cash" ariaLabel="Cash rises from 10 to 12" table={TABLE}>
        <canvas />
      </ChartBox>,
    )
    expect(screen.getByRole('img', { name: 'Cash rises from 10 to 12' })).toBeInTheDocument()
  })

  it('defaults the plot height to 240 and honours height', () => {
    const { rerender } = render(
      <ChartBox title="A" table={TABLE}>
        <canvas />
      </ChartBox>,
    )
    expect(screen.getByRole('img')).toHaveStyle({ height: '240px' })
    rerender(
      <ChartBox title="A" height={300} table={TABLE}>
        <canvas />
      </ChartBox>,
    )
    expect(screen.getByRole('img')).toHaveStyle({ height: '300px' })
  })

  it('renders caption, controls and legend slots', () => {
    render(
      <ChartBox title="A" caption="Per day" controls={<button>View</button>} legend={<span>LEGEND</span>} table={TABLE}>
        <canvas />
      </ChartBox>,
    )
    expect(screen.getByText('Per day')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByText('LEGEND')).toBeInTheDocument()
  })

  it('accepts a node as the table, and tableFromRows turns {head, rows} into one', () => {
    const { rerender } = render(
      <ChartBox title="A" table={<table><tbody><tr><td>NODE-TABLE</td></tr></tbody></table>}>
        <canvas />
      </ChartBox>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show table' }))
    expect(screen.getByText('NODE-TABLE')).toBeInTheDocument()
    rerender(
      <ChartBox title="A" table={tableFromRows(TABLE)}>
        <canvas />
      </ChartBox>,
    )
    expect(screen.getByText('$10')).toBeInTheDocument()
  })

  it('falls back to a sentence pointing at the table when the chart throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Boom(): ReactElement {
      throw new Error('no canvas')
    }
    render(
      <ChartBox title="A" table={TABLE}>
        <Boom />
      </ChartBox>,
    )
    expect(screen.getByText(/could not be drawn/i)).toHaveTextContent(/table/i)
    // the toggle still works and the figures are reachable
    fireEvent.click(screen.getByRole('button', { name: 'Show table' }))
    expect(screen.getByText('$12')).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('still renders the config-docs chart primitives (existing callers)', () => {
    render(
      <>
        <LineChart title="Line doc" labels={[1, 2]} series={[{ label: 'S', data: [1, 2], color: '#2a78d6' }]} xLabel="Day" yLabel="Cash" />
        <BarChart title="Bar doc" labels={[1, 2]} series={[{ label: 'S', data: [1, 2], color: '#2a78d6' }]} xLabel="Day" yLabel="Cash" />
      </>,
    )
    expect(screen.getByText('Line doc')).toBeInTheDocument()
    expect(screen.getByText('Bar doc')).toBeInTheDocument()
    expect(screen.getByTestId('line-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('bar-canvas')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Show table' })[0])
    expect(screen.getByRole('columnheader', { name: 'Day' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'S' })).toBeInTheDocument()
  })
})

const ITEMS = [
  { key: 'a', label: 'Alpha', swatch: { kind: 'line' as const, color: '#2a78d6', dash: [4, 3] } },
  { key: 'b', label: 'Beta', swatch: { kind: 'fill' as const, color: '#eb6834' } },
  { key: 'c', label: 'Gamma', swatch: { kind: 'fill' as const, color: '#1baf7a', hatched: true } },
]

describe('Legend', () => {
  it('is a plain list of labels when not toggleable', () => {
    render(<Legend items={ITEMS} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('draws the dash on line swatches and a hatch pattern on hatched fills', () => {
    const { container } = render(<Legend items={ITEMS} />)
    expect(container.querySelector('line[stroke-dasharray]')).not.toBeNull()
    expect(container.querySelector('pattern')).not.toBeNull()
  })

  it('makes each item a switch that calls back with its own key and reflects state', () => {
    const onToggle = vi.fn()
    render(<Legend items={ITEMS} hidden={new Set(['b'])} onToggle={onToggle} />)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(3)
    expect(screen.getByRole('switch', { name: /Alpha/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: /Beta/ })).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('switch', { name: /Gamma/ }))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith('c')
  })

  it('hides the series that was clicked, not another one (keys, not positions)', () => {
    function Harness(): ReactElement {
      const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
      const toggle = (key: string): void => {
        const next = new Set(hidden)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        setHidden(next)
      }
      // Series are listed in a different order than the legend items.
      const series = ['c', 'a', 'b'].filter((k) => !hidden.has(k))
      return (
        <>
          <Legend items={ITEMS} hidden={hidden} onToggle={toggle} />
          <output data-testid="visible">{series.join(',')}</output>
        </>
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('switch', { name: /Beta/ }))
    expect(screen.getByTestId('visible')).toHaveTextContent('c,a')
    expect(screen.getByRole('switch', { name: /Beta/ })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: /Alpha/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('switch', { name: /Beta/ }))
    expect(screen.getByTestId('visible')).toHaveTextContent('c,a,b')
  })

  it('toggles from the keyboard (switch buttons)', () => {
    render(<Legend items={ITEMS} hidden={new Set()} onToggle={() => {}} />)
    expect(screen.getByRole('switch', { name: /Alpha/ }).tagName).toBe('BUTTON')
  })

  it('reports hover and focus on an item through onFocusItem', () => {
    const onFocusItem = vi.fn()
    render(<Legend items={ITEMS} hidden={new Set()} onToggle={() => {}} onFocusItem={onFocusItem} />)
    const beta = screen.getByRole('switch', { name: /Beta/ })
    fireEvent.focus(beta)
    expect(onFocusItem).toHaveBeenLastCalledWith('b')
    fireEvent.blur(beta)
    expect(onFocusItem).toHaveBeenLastCalledWith(null)
    fireEvent.mouseEnter(beta)
    expect(onFocusItem).toHaveBeenLastCalledWith('b')
    fireEvent.mouseLeave(beta)
    expect(onFocusItem).toHaveBeenLastCalledWith(null)
  })
})

describe('baseOptions', () => {
  it('sets the x axis title from xLabel, and none without it', () => {
    const withLabel = baseOptions<'line'>({ xLabel: 'Day', yLabel: 'Cash' })
    expect(withLabel.scales?.x?.title).toMatchObject({ display: true, text: 'Day' })
    const without = baseOptions<'line'>({})
    expect(without.scales?.x?.title?.display ?? false).toBe(false)
  })

  it('turns the canvas legend off by default', () => {
    expect(baseOptions<'line'>({}).plugins?.legend?.display).toBe(false)
  })

  it('drops animation under prefers-reduced-motion', () => {
    stubReducedMotion(true)
    expect(baseOptions<'bar'>({}).animation).toBe(false)
    stubReducedMotion(false)
    expect(baseOptions<'bar'>({}).animation).not.toBe(false)
  })
})

describe('registerCharts', () => {
  it('is callable more than once and switches animation off for reduced motion', () => {
    stubReducedMotion(true)
    registerCharts()
    expect(ChartJS.defaults.animation).toBe(false)
    stubReducedMotion(false)
    registerCharts()
    expect(ChartJS.defaults.animation).not.toBe(false)
  })

  it('keeps the canvas legend off by default', () => {
    registerCharts()
    expect(ChartJS.defaults.plugins.legend.display).toBe(false)
  })
})

interface FakeCtx {
  [k: string]: unknown
  save: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
  beginPath: ReturnType<typeof vi.fn>
  moveTo: ReturnType<typeof vi.fn>
  lineTo: ReturnType<typeof vi.fn>
  stroke: ReturnType<typeof vi.fn>
  setLineDash: ReturnType<typeof vi.fn>
  fillText: ReturnType<typeof vi.fn>
  measureText: ReturnType<typeof vi.fn>
}

function fakeCtx(): FakeCtx {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
  }
}

function fakeLineChart(datasets: { label: string; data: number[] }[]) {
  const ctx = fakeCtx()
  return {
    ctx,
    canvas: document.createElement('canvas'),
    chartArea: { left: 10, right: 210, top: 5, bottom: 105, width: 200, height: 100 },
    scales: { y: { min: 0, max: 100, getPixelForValue: (v: number) => 105 - v } },
    data: { labels: ['d1', 'd2', 'd3'], datasets },
    options: {},
    tooltip: { setActiveElements: vi.fn() },
    setActiveElements: vi.fn(),
    getActiveElements: vi.fn(() => [] as { datasetIndex: number; index: number }[]),
    update: vi.fn(),
  }
}

type AnyHook = (...args: unknown[]) => void
function call(plugin: unknown, hook: string, ...args: unknown[]): void {
  const fn = (plugin as Record<string, AnyHook | undefined>)[hook]
  if (fn) fn.apply(plugin, args)
}

describe('referenceRule', () => {
  const datasets = [{ label: 'Success rate', data: [0.4, 0.5, 0.7] }]

  it('draws a labelled horizontal rule at the value, from options', () => {
    const chart = fakeLineChart(datasets)
    const opts = { rules: [{ value: 50, label: 'Break-even' }] }
    for (const hook of ['beforeDatasetsDraw', 'afterDatasetsDraw', 'afterDraw']) call(referenceRule, hook, chart, { cancelable: true }, opts)
    expect(chart.ctx.stroke).toHaveBeenCalled()
    const y = 105 - 50
    const moves = chart.ctx.moveTo.mock.calls as number[][]
    const lines = chart.ctx.lineTo.mock.calls as number[][]
    expect(moves.some(([, my]) => my === y)).toBe(true)
    expect(lines.some(([, ly]) => ly === y)).toBe(true)
    expect(chart.ctx.fillText.mock.calls.some(([text]) => text === 'Break-even')).toBe(true)
  })

  it('never adds the rule to data.datasets (legend and tooltips stay clean)', () => {
    const chart = fakeLineChart([...datasets])
    const before = JSON.stringify(chart.data.datasets)
    const opts = { rules: [{ value: 50, label: 'Break-even' }] }
    for (const hook of ['beforeInit', 'afterInit', 'beforeUpdate', 'afterUpdate', 'beforeDatasetsDraw', 'afterDatasetsDraw', 'afterDraw']) {
      call(referenceRule, hook, chart, { cancelable: true }, opts)
    }
    expect(chart.data.datasets).toHaveLength(1)
    expect(JSON.stringify(chart.data.datasets)).toBe(before)
    expect(chart.data.datasets.some((d) => d.label === 'Break-even')).toBe(false)
  })

  it('draws nothing without rules, and skips a value outside the plot', () => {
    const chart = fakeLineChart(datasets)
    for (const hook of ['beforeDatasetsDraw', 'afterDatasetsDraw', 'afterDraw']) call(referenceRule, hook, chart, { cancelable: true }, {})
    expect(chart.ctx.stroke).not.toHaveBeenCalled()
    for (const hook of ['beforeDatasetsDraw', 'afterDatasetsDraw', 'afterDraw']) {
      call(referenceRule, hook, chart, { cancelable: true }, { rules: [{ value: 500, label: 'Far away' }] })
    }
    expect(chart.ctx.stroke).not.toHaveBeenCalled()
  })

  it('has a stable plugin id for options.plugins', () => {
    expect(referenceRule.id).toBe('referenceRule')
  })
})

describe('crosshairSync', () => {
  const ds = [
    { label: 'A', data: [1, 2, 3] },
    { label: 'B', data: [3, 2, 1] },
  ]

  it('syncs the hovered index from one chart to the other chart in the group', () => {
    const group = createCrosshairGroup()
    const plugin = crosshairSync(group)
    const one = fakeLineChart(ds)
    const two = fakeLineChart(ds)
    call(plugin, 'afterInit', one)
    call(plugin, 'afterInit', two)

    one.getActiveElements.mockReturnValue([{ datasetIndex: 0, index: 2 }])
    call(plugin, 'afterEvent', one, { event: { type: 'mousemove' }, replay: false, changed: true, inChartArea: true })

    expect(two.setActiveElements).toHaveBeenCalled()
    const active = two.setActiveElements.mock.calls.at(-1)?.[0] as { datasetIndex: number; index: number }[]
    expect(active.length).toBeGreaterThan(0)
    expect(active.every((e) => e.index === 2)).toBe(true)
    expect(two.update).toHaveBeenCalled()
    // the source chart is not told to move itself
    expect(one.setActiveElements).not.toHaveBeenCalled()
  })

  it('clears the other chart when the pointer leaves', () => {
    const group = createCrosshairGroup()
    const plugin = crosshairSync(group)
    const one = fakeLineChart(ds)
    const two = fakeLineChart(ds)
    call(plugin, 'afterInit', one)
    call(plugin, 'afterInit', two)
    one.getActiveElements.mockReturnValue([{ datasetIndex: 0, index: 1 }])
    call(plugin, 'afterEvent', one, { event: { type: 'mousemove' }, replay: false, changed: true, inChartArea: true })
    one.getActiveElements.mockReturnValue([])
    call(plugin, 'afterEvent', one, { event: { type: 'mouseout' }, replay: false, changed: true, inChartArea: false })
    expect(two.setActiveElements.mock.calls.at(-1)?.[0]).toEqual([])
  })

  it('reaches the same index by keyboard on a focused chart', () => {
    const group = createCrosshairGroup()
    const plugin = crosshairSync(group)
    const one = fakeLineChart(ds)
    const two = fakeLineChart(ds)
    call(plugin, 'afterInit', one)
    call(plugin, 'afterInit', two)
    fireEvent.keyDown(one.canvas, { key: 'ArrowRight' })
    const active = two.setActiveElements.mock.calls.at(-1)?.[0] as { index: number }[]
    expect(active.length).toBeGreaterThan(0)
    expect(active.every((e) => e.index === 0 || e.index === 1)).toBe(true)
    expect(group.get()).not.toBeNull()
  })

  it('stops listening to a destroyed chart and does not echo back to the source', () => {
    const group = createCrosshairGroup()
    const plugin = crosshairSync(group)
    const one = fakeLineChart(ds)
    const two = fakeLineChart(ds)
    call(plugin, 'afterInit', one)
    call(plugin, 'afterInit', two)
    call(plugin, 'afterDestroy', two)
    two.setActiveElements.mockClear()
    one.getActiveElements.mockReturnValue([{ datasetIndex: 0, index: 1 }])
    call(plugin, 'afterEvent', one, { event: { type: 'mousemove' }, replay: false, changed: true, inChartArea: true })
    expect(two.setActiveElements).not.toHaveBeenCalled()
  })

  it('keeps separate groups separate', () => {
    const g1 = createCrosshairGroup()
    const g2 = createCrosshairGroup()
    const p1 = crosshairSync(g1)
    const p2 = crosshairSync(g2)
    const a = fakeLineChart(ds)
    const b = fakeLineChart(ds)
    call(p1, 'afterInit', a)
    call(p2, 'afterInit', b)
    a.getActiveElements.mockReturnValue([{ datasetIndex: 0, index: 2 }])
    call(p1, 'afterEvent', a, { event: { type: 'mousemove' }, replay: false, changed: true, inChartArea: true })
    expect(b.setActiveElements).not.toHaveBeenCalled()
  })
})
