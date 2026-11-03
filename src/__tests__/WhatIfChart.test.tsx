import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PlanDay from '../components/plan/PlanDay'
import WhatIfChart from '../components/plan/WhatIfChart'
import { useGameStore } from '../store/gameStore'
import type { PlanPreviewOk } from '../types/game'
import { planningState } from './fixtures/gameState'

interface Drawn {
  data: { labels?: unknown[]; datasets: { label?: string; data: (number | null)[] }[] }
  options: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
const drawn = vi.hoisted(() => [] as unknown[])
const charts = (): Drawn[] => drawn as Drawn[]

vi.mock('react-chartjs-2', () => ({
  Line: function Mock(props: { data: unknown; options?: unknown }): ReactElement {
    drawn.push({ data: props.data, options: props.options ?? {} })
    return <canvas data-testid="line-canvas" />
  },
}))

const previewPlan = vi.hoisted(() => vi.fn())
vi.mock('../api/socketHandlers', () => ({ submitDay: vi.fn(), previewPlan }))

// The demand maths must never run for the what-if curve.
const demandSpy = vi.hoisted(() => vi.fn())
vi.mock('../game/configMath', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  const wrapped: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(real)) {
    wrapped[k] =
      typeof v === 'function' && /spawn|buyProbability|buyDecision|willingness|quality|popularity|ingredientScore|kernel|score/i.test(k)
        ? (...a: unknown[]) => (demandSpy(k), (v as (...x: unknown[]) => unknown)(...a))
        : v
  }
  return wrapped
})

// Margins are deliberately not anything a client could derive from the prices.
const PREVIEW: PlanPreviewOk = {
  request_id: 'r1',
  day: 1,
  prices: [0.25, 0.3, 0.35, 0.4, 0.45],
  chance: [0.9, 0.7, 0.5, 0.3, 0.1],
  expected_visitors: 31.37,
  expected_cups: [28.21, 21.5, 15.9, 9.04, 3.33],
  expected_margin: [1.11, 3.33, 4.44, 2.22, 0.55],
  cups_possible: 40,
  cost_per_cup: 0.17,
}

const last = (): Drawn => {
  const c = charts().at(-1)
  if (!c) throw new Error('chart not drawn')
  return c
}
const marked = (d: { data: (number | null)[] }): number[] => d.data.flatMap((v, i) => (v === null || v === undefined ? [] : [i]))
const byLabel = (c: Drawn, re: RegExp) => {
  const hit = c.data.datasets.find((d) => re.test(d.label ?? ''))
  if (!hit) throw new Error(`no dataset ${re}`)
  return hit
}

beforeEach(() => {
  drawn.length = 0
  demandSpy.mockClear()
  previewPlan.mockClear()
  useGameStore.getState().reset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('WhatIfChart', () => {
  it('draws the server margins across the server prices, untouched', () => {
    render(<WhatIfChart preview={PREVIEW} price={0.35} waiting={false} />)
    const curve = byLabel(last(), /margin/i)
    expect(curve.data).toEqual(PREVIEW.expected_margin)
    expect(last().data.labels).toHaveLength(PREVIEW.prices.length)
  })

  it('puts the marker on the grid price nearest the price field, with the server value', () => {
    render(<WhatIfChart preview={PREVIEW} price={0.41} waiting={false} />)
    const marker = byLabel(last(), /your price/i)
    expect(marked(marker)).toEqual([3])
    expect(marker.data[3]).toBe(2.22)
  })

  it('follows the price field as it changes', () => {
    const { rerender } = render(<WhatIfChart preview={PREVIEW} price={0.25} waiting={false} />)
    expect(marked(byLabel(last(), /your price/i))).toEqual([0])
    rerender(<WhatIfChart preview={PREVIEW} price={0.46} waiting={false} />)
    expect(marked(byLabel(last(), /your price/i))).toEqual([4])
  })

  it('draws the curve and your price only: there is no best-price marker', () => {
    render(<WhatIfChart preview={PREVIEW} price={0.25} waiting={false} />)
    expect(last().data.datasets.map((d) => d.label)).toEqual(['Expected margin', 'Your price'])
    expect(screen.queryByText(/best price/i)).toBeNull()
  })

  it('shows chance, expected cups of visitors and margin at the marked price, from the reply', () => {
    render(<WhatIfChart preview={PREVIEW} price={0.3} waiting={false} />)
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('21.5')).toBeInTheDocument()
    expect(screen.getByText(/of 31\.4 visitors/)).toBeInTheDocument()
    expect(screen.getByText('$3.33')).toBeInTheDocument()
  })

  it('says the figures are expected values', () => {
    render(<WhatIfChart preview={PREVIEW} price={0.3} waiting={false} />)
    expect(screen.getByText("Expected values for today's weather, at today's cost per cup. Real customers vary.")).toBeInTheDocument()
  })

  it('has a table view with every price and its server figures', () => {
    render(<WhatIfChart preview={PREVIEW} price={0.3} waiting={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show table' }))
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(PREVIEW.prices.length + 1)
    expect(within(rows[3]).getByText('$0.35')).toBeInTheDocument()
    expect(within(rows[3]).getByText('$4.44')).toBeInTheDocument()
  })

  it('dims while a newer reply is awaited, and not otherwise', () => {
    const { rerender } = render(<WhatIfChart preview={PREVIEW} price={0.3} waiting={false} />)
    expect(screen.getByTestId('what-if').style.opacity).toBe('1')
    rerender(<WhatIfChart preview={PREVIEW} price={0.3} waiting />)
    expect(Number(screen.getByTestId('what-if').style.opacity)).toBeLessThan(1)
  })

  it('computes nothing: no demand function runs', () => {
    render(<WhatIfChart preview={PREVIEW} price={0.3} waiting={false} />)
    expect(demandSpy).not.toHaveBeenCalled()
  })

  it('draws a different curve when the server sends different margins (nothing is derived from price)', () => {
    const other = { ...PREVIEW, expected_margin: [9, 8, 7, 6, 5] }
    render(<WhatIfChart preview={other} price={0.3} waiting={false} />)
    expect(byLabel(last(), /margin/i).data).toEqual([9, 8, 7, 6, 5])
  })
})

/** A plan-screen tile's whole text: its label, value and note. */
const tile = (label: string): string => screen.getByText(label, { selector: 'div' }).parentElement?.textContent ?? ''
const reply = (over: Partial<PlanPreviewOk> = {}) =>
  act(() => {
    useGameStore.setState({ planPreview: { requestId: 'r1', reply: { ...PREVIEW, ...over }, refused: false, waiting: false } })
  })

describe('PlanDay cost and margin per cup', () => {
  it('shows the cost per cup the server sent, and the margin as a share of the price', () => {
    render(<PlanDay state={planningState()} />)
    fireEvent.change(screen.getByLabelText('Price per cup ($)'), { target: { value: '0.6' } })
    reply({ cost_per_cup: 0.17 })
    expect(tile('Cost per cup')).toContain('$0.17')
    // $0.43 of a $0.60 price is 72% (as a markup over cost it would read 253%).
    expect(tile('Margin per cup')).toContain('$0.43 (72%)')
  })

  it('computes nothing itself: before a reply the tiles wait, and the count of cups comes from the reply', () => {
    render(<PlanDay state={planningState()} />)
    expect(tile('Cost per cup')).toContain('…')
    expect(tile('Margin per cup')).toContain('…')
    expect(screen.getByText(/you can make/).textContent).toContain('…')
    reply({ cups_possible: 37 })
    expect(screen.getByText(/you can make/).textContent).toContain('37')
  })

  it('shows a dash with no stock for a single cup', () => {
    render(<PlanDay state={planningState()} />)
    reply({ cups_possible: 0, cost_per_cup: null })
    expect(tile('Cost per cup')).toContain('–')
    expect(tile('Cost per cup')).toContain('No stock for a cup')
    expect(tile('Margin per cup')).toContain('–')
  })

  it("explains that the day's cash result subtracts every pack bought today", () => {
    render(<PlanDay state={planningState()} />)
    fireEvent.click(screen.getByLabelText('Add a pack of 100 lemons'))
    const note = screen.getByText(/everything you buy today/)
    expect(note.textContent).toContain('$5.00 so far')
    expect(note.textContent).toContain('even stock you will use on later days')
  })
})

describe('PlanDay pack buttons', () => {
  it('stop at the server limit of packs of one size a day', () => {
    const state = planningState({ cash: 1000 })
    state.limits.packs_per_size = { min: 0, max: 2 }
    render(<PlanDay state={state} />)
    const add = screen.getByLabelText('Add a pack of 100 ice')
    fireEvent.click(add)
    fireEvent.click(add)
    expect(add).toBeDisabled()
    expect(add).toHaveAttribute('title', 'Up to 2 packs of one size a day')
    fireEvent.click(add)
    expect(add.previousElementSibling?.textContent).toBe('2')
  })

  it('never order a negative count: minus is off at zero', () => {
    render(<PlanDay state={planningState()} />)
    const remove = screen.getByLabelText('Remove a pack of 100 ice')
    expect(remove).toBeDisabled()
    fireEvent.click(remove)
    expect(remove.nextElementSibling?.textContent).toBe('0')
  })

  it('step the price by the server price step', () => {
    const state = planningState()
    state.limits.price_step = 0.1
    render(<PlanDay state={state} />)
    expect(screen.getByLabelText('Price per cup ($)')).toHaveAttribute('step', '0.1')
  })
})

describe('PlanDay with the what-if chart', () => {
  const holder = () => {
    const state = planningState()
    return state
  }

  it('debounces the preview request by 250 ms and sends one request for a burst of changes', () => {
    vi.useFakeTimers()
    render(<PlanDay state={holder()} />)
    act(() => void vi.advanceTimersByTime(249))
    expect(previewPlan).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(previewPlan).toHaveBeenCalledTimes(1)
    expect(previewPlan.mock.calls[0][0]).toMatchObject({ recipe: expect.any(Object), purchases: expect.any(Object) })

    const add = screen.getByLabelText('Add a pack of 100 ice')
    fireEvent.click(add)
    act(() => void vi.advanceTimersByTime(200))
    fireEvent.click(add)
    act(() => void vi.advanceTimersByTime(200))
    expect(previewPlan).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(50))
    expect(previewPlan).toHaveBeenCalledTimes(2)
    expect(previewPlan.mock.calls[1][0].purchases).toEqual({ ice: { '100': 2 } })
  })

  it('requests again when the recipe changes', () => {
    vi.useFakeTimers()
    render(<PlanDay state={holder()} />)
    act(() => void vi.advanceTimersByTime(250))
    const slider = screen.getByLabelText(/\bice per cup:/i)
    fireEvent.change(slider, { target: { value: '4' } })
    act(() => void vi.advanceTimersByTime(250))
    expect(previewPlan).toHaveBeenCalledTimes(2)
    expect(previewPlan.mock.calls[1][0].recipe.ice).toBe(4)
  })

  it('does not request again for a price change alone', () => {
    vi.useFakeTimers()
    render(<PlanDay state={holder()} />)
    act(() => void vi.advanceTimersByTime(250))
    fireEvent.change(screen.getByLabelText('Price per cup ($)'), { target: { value: '0.6' } })
    act(() => void vi.advanceTimersByTime(1000))
    expect(previewPlan).toHaveBeenCalledTimes(1)
  })

  it('shows the chart once a reply for today arrives', () => {
    render(<PlanDay state={holder()} />)
    expect(screen.queryByTestId('what-if')).toBeNull()
    act(() => {
      useGameStore.setState({ planPreview: { requestId: 'r1', reply: PREVIEW, refused: false, waiting: false } })
    })
    expect(screen.getByTestId('what-if')).toBeInTheDocument()
  })

  it('hides the chart for a reply that belongs to another day', () => {
    useGameStore.setState({ planPreview: { requestId: 'r1', reply: { ...PREVIEW, day: 2 }, refused: false, waiting: false } })
    render(<PlanDay state={holder()} />)
    expect(screen.queryByTestId('what-if')).toBeNull()
  })

  it('hides the chart when the server refused the plan', () => {
    useGameStore.setState({ planPreview: { requestId: 'r1', reply: null, refused: true, waiting: false } })
    render(<PlanDay state={holder()} />)
    expect(screen.queryByTestId('what-if')).toBeNull()
  })

  it('keeps the plan screen working when no backend ever answers', () => {
    vi.useFakeTimers()
    render(<PlanDay state={holder()} />)
    act(() => void vi.advanceTimersByTime(5000))
    expect(screen.queryByTestId('what-if')).toBeNull()
    expect(screen.getByRole('button', { name: /open the stand/i })).toBeEnabled()
    expect(screen.getByLabelText('Price per cup ($)')).toBeInTheDocument()
  })
})
