import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCS, type DocKey } from '../components/config/docs/entries'
import { route as configRoute } from '../pages/ConfigPage'
import type { Limits } from '../types/game'
import { defaultConfig, defaultLimits } from './fixtures/gameState'

vi.mock('react-chartjs-2', () => ({ Line: () => <canvas />, Bar: () => <canvas /> }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: null, mode: 'guest', logout: vi.fn() }) }))
vi.mock('../api/socketHandlers', () => ({ createGame: vi.fn() }))
const rest = vi.hoisted(() => ({
  getConfigDefaults: vi.fn(),
  validateConfig: vi.fn(async () => ({ valid: true, message: null })),
  getCupCost: vi.fn(),
}))
vi.mock('../api/rest', () => rest)

/** Limits no client would guess, so a hand-copied bound shows up as a mismatch. */
function oddLimits(): Limits {
  const l = defaultLimits()
  l.num_days = { min: 2, max: 45 }
  l.weather_multiplier = { min: 0, max: 4 }
  l.packs_per_size = { min: 0, max: 7 }
  l.packs = { min: 1, max: 6 }
  l.pack_size = { min: 1, max: 9000 }
  l.pack_discount = { min: 0, max: 0.75 }
  l.temperature = { min: -25, max: 55 }
  l.starting_popularity = { min: 0, max: 1 }
  l.price_tolerance_above = { min: 0, max: 4 }
  l.tolerance = { min: 0, max: 15 }
  return l
}

function doc(key: DocKey, limits: Limits = oddLimits()): string {
  const body = DOCS[key].body({ config: defaultConfig(), limits, ingredient: 'lemons', weather: 'sunny', person: 'Adult' })
  const { container } = render(<>{body as ReactElement}</>)
  return container.textContent ?? ''
}

beforeEach(() => {
  rest.getCupCost.mockReset()
  rest.getConfigDefaults.mockReset()
})

describe('the help quotes the server limits', () => {
  it('number of days', () => {
    expect(doc('num_days')).toContain('from 2 to 45')
  })

  it('traffic multiplier', () => {
    expect(doc('traffic_multiplier')).toContain('up to 4')
  })

  it('weather temperature ranges', () => {
    expect(doc('weather_range')).toContain('−25°C to 55°C')
  })

  it('price tolerance', () => {
    expect(doc('tolerance_price')).toContain('at most 400%')
  })

  it('packs: the daily cap per size, the number of sizes, sizes and discounts', () => {
    rest.getCupCost.mockResolvedValue({ spend: 0, cups_possible: 0, cost_per_cup: null })
    const text = doc('packs')
    expect(text).toContain('up to 7 of each size a day')
    expect(text).not.toContain('any number')
    expect(text).toContain('From 1 to 6 pack sizes')
    expect(text).toContain('from 1 to 9,000')
    expect(text).toContain('from 0% to 75%')
  })
})

describe('the help explains popularity exactly', () => {
  it('as an average of daily rates that rises only above its current value', () => {
    const text = doc('starting_popularity')
    expect(text).toContain('plain average of the success rates')
    expect(text).toContain('used only until a day has had visitors. From then on it is dropped')
    expect(text).toContain('at most 100%')
    expect(text).toContain('above the popularity it was played with')
    expect(text).toContain('50% is not the line')
    expect(text).not.toContain('sell to more than half your visitors and popularity rises')
    expect(text).toContain('The weather changes who comes out')
    expect(text).toContain('Not popular enough')
    // The end screen's two figures.
    expect(text).toContain('83% success rate but a 50% final popularity')
  })

  it('names the popularity reason among the refusal reasons', () => {
    expect(doc('customers_section')).toContain('a customer who would have bought at a neutral 50% says “Not popular enough”')
  })
})

describe('the help prices a cup only through the server', () => {
  it('cost per unit: the smallest and biggest packs, as the engine prices them', async () => {
    rest.getCupCost.mockImplementation(async (_c, purchases: Record<string, Record<string, number>>) =>
      purchases.lemons['100'] ? { spend: 12, cups_possible: 33, cost_per_cup: 0.29 } : { spend: 84, cups_possible: 233, cost_per_cup: 0.23 },
    )
    const { container } = render(<>{DOCS.unit_cost.body({ config: defaultConfig(), limits: defaultLimits(), ingredient: 'lemons' }) as ReactElement}</>)
    await waitFor(() => expect(container.textContent).toContain('makes 33 cups at $0.29 a cup'))
    expect(container.textContent).toContain('makes 233 cups at $0.23 a cup')
    const [, smallPurchases, recipe] = rest.getCupCost.mock.calls[0]
    expect(smallPurchases).toEqual({ ice: { '100': 1 }, sugar: { '100': 1 }, lemons: { '100': 1 }, cups: { '100': 1 } })
    expect(recipe).toEqual({ ice: 3, sugar: 3, lemons: 3 })
  })

  it('starting cash: the basket and its cups come from the server', async () => {
    rest.getCupCost.mockResolvedValue({ spend: 12.5, cups_possible: 33, cost_per_cup: 0.31 })
    const { container } = render(<>{DOCS.starting_cash.body({ config: defaultConfig(), limits: defaultLimits() }) as ReactElement}</>)
    await waitFor(() => expect(container.textContent).toContain('$12.50'))
    expect(container.textContent).toContain('make 33 cups, at $0.31 a cup')
    expect(container.textContent).toContain('8.0×')
  })
})

describe('the config screen reads its bounds from the server', () => {
  it('sets each field limit from the served limits, not a copy', async () => {
    rest.getConfigDefaults.mockResolvedValue({ config: defaultConfig(), limits: oddLimits() })
    render(
      <MemoryRouter initialEntries={['/new']}>
        <Routes>
          <Route path="/new" element={configRoute.element} />
        </Routes>
      </MemoryRouter>,
    )
    // The input a label points at (a label query over the whole config screen is slow).
    const input = (label: HTMLElement) => document.getElementById((label as HTMLLabelElement).htmlFor) as HTMLInputElement
    const days = input(await screen.findByText('Number of days', { selector: 'label' }))
    expect(days).toHaveAttribute('min', '2')
    expect(days).toHaveAttribute('max', '45')
    expect(input(screen.getAllByText('Traffic multiplier', { selector: 'label' })[0])).toHaveAttribute('max', '4')
    const iceBelow = [...document.querySelectorAll('label')].find((l) => /Ice below/.test(l.textContent ?? ''))!
    expect(input(iceBelow)).toHaveAttribute('max', '15')
    expect(input(screen.getAllByText('Discount', { selector: 'label' })[0])).toHaveAttribute('max', '75')
  })
})
