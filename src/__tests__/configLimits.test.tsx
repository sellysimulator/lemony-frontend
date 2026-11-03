import { act, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCS, type DocCtx, type DocKey } from '../components/config/docs/entries'
import { route as configRoute } from '../pages/ConfigPage'
import type { ConfigPreview, Limits } from '../types/game'
import { defaultConfig, defaultLimits, recordedConfig, recordedPreview } from './fixtures/gameState'

vi.mock('react-chartjs-2', () => ({ Line: () => <canvas />, Bar: () => <canvas /> }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: null, mode: 'guest', logout: vi.fn() }) }))
vi.mock('../api/socketHandlers', () => ({ createGame: vi.fn() }))
const rest = vi.hoisted(() => ({
  getConfigDefaults: vi.fn(),
  getConfigPreview: vi.fn(),
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

/** A help context on the recorded server reply for the default config. */
function ctx(over: Partial<DocCtx> = {}): DocCtx {
  const preview = recordedPreview()
  return {
    config: recordedConfig(),
    limits: oddLimits(),
    help: preview.help,
    ingredients: preview.ingredients,
    invalid: null,
    stale: false,
    ingredient: 'lemons',
    weather: 'sunny',
    person: 'Adult',
    ...over,
  }
}

function doc(key: DocKey, over: Partial<DocCtx> = {}): string {
  const { container } = render(<>{DOCS[key].body(ctx(over)) as ReactElement}</>)
  return container.textContent ?? ''
}

beforeEach(() => {
  rest.getConfigDefaults.mockReset()
  rest.getConfigPreview.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
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

describe('the help shows only the server figures', () => {
  it('cost per unit: the smallest and biggest packs, as the engine prices them', () => {
    const text = doc('unit_cost')
    expect(text).toContain('makes 33 cups at $0.28 a cup')
    expect(text).toContain('Selling at $0.60 leaves $0.32 per cup sold')
    expect(text).toContain('makes 233 cups at $0.22 a cup')
  })

  it('starting cash: the basket, how many times the cash covers it, and its cups', () => {
    const text = doc('starting_cash')
    expect(text).toContain('$12.00')
    expect(text).toContain('8.3×')
    expect(text).toContain('make 33 cups, at $0.28 a cup')
  })

  it('a figure the server changes is the figure the help prints', () => {
    const preview = recordedPreview()
    preview.help!.weather.sunny.odds = 0.123
    preview.help!.weather.sunny.expected_days = 4.56
    preview.help!.people.Adult.wtp_best = 9.87
    preview.help!.quality_swing.best = 2.5
    preview.help!.popularity.start_factor = 1.75
    preview.help!.people.Adult.worked.reason = 'too_sweet'
    const over = { help: preview.help }
    expect(doc('weather_range', over)).toContain('a chance of 12%, which is about 4.6 of your 7 days')
    expect(doc('quality_swing', over)).toContain('they would pay $9.87 for their favourite cup')
    expect(doc('quality_swing', over)).toContain('pay up to 250% of their budget')
    expect(doc('starting_popularity', over)).toContain('multiplied by ×1.75')
    expect(doc('customers_section', over)).toContain('Too sweet')
  })

  it('packs: the server prices, break-even and spoilage catch', () => {
    const text = doc('packs')
    expect(text).toContain('The pack of 700 costs $28.00')
    expect(text).toContain('would cost $0.05 each')
    expect(text).toContain('at least 560 of its 700 units')
  })

  it('spoilage: what is left of a batch, from the server', () => {
    expect(doc('fresh_days')).toContain('after night 4 you would have about 75 left, and after night 5 about 38')
  })

  it('waits for the server before showing a figure', () => {
    const text = doc('num_days', { help: null, ingredients: null })
    expect(text).toContain('Asking the server for the examples…')
    expect(text).toContain('from 2 to 45') // the prose and the limits still show
    expect(doc('packs', { help: null, ingredients: null })).toContain('Asking the server for the examples…')
  })

  it("says why there are no examples for an invalid config, in the server's words", () => {
    const text = doc('price', { help: null, invalid: 'Weather temperature ranges leave a gap starting at 5 °C' })
    expect(text).toContain('The examples appear once the configuration is valid: Weather temperature ranges leave a gap starting at 5 °C')
  })

  it('keeps an ingredient’s own figures while another part of the config is invalid', () => {
    const text = doc('packs', { help: null, invalid: 'a gap' })
    expect(text).toContain('The pack of 700 costs $28.00')
    expect(text).toContain('…') // the share of starting cash needs the whole config
  })
})

describe('the config screen reads its bounds and figures from the server', () => {
  const renderScreen = () =>
    render(
      <MemoryRouter initialEntries={['/new']}>
        <Routes>
          <Route path="/new" element={configRoute.element} />
        </Routes>
      </MemoryRouter>,
    )

  it('sets each field limit from the served limits, not a copy', async () => {
    rest.getConfigDefaults.mockResolvedValue({ config: defaultConfig(), limits: oddLimits() })
    rest.getConfigPreview.mockResolvedValue(recordedPreview())
    renderScreen()
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

  it('asks the server once the typing settles, and shows its pack prices, warnings and verdict', async () => {
    vi.useFakeTimers()
    const reply: ConfigPreview = recordedPreview()
    reply.ingredients.ice!.packs[1] = { ...reply.ingredients.ice!.packs[1], price: 7.77, saving: 1.23, dearer_than: 100 }
    rest.getConfigDefaults.mockResolvedValue({ config: recordedConfig(), limits: defaultLimits() })
    rest.getConfigPreview.mockResolvedValue(reply)
    renderScreen()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getAllByText('… per pack').length).toBeGreaterThan(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399)
    })
    expect(rest.getConfigPreview).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(rest.getConfigPreview).toHaveBeenCalledTimes(1)
    const packs = within(screen.getAllByRole('group', { name: 'Packs on sale' })[0])
    expect(packs.getByText('$7.77')).toBeInTheDocument()
    expect(packs.getByText(/saves \$1\.23/)).toBeInTheDocument()
    expect(packs.getByText(/Costs more per unit than the pack of 100/)).toBeInTheDocument()
    expect(screen.getByText('Configuration is valid')).toBeInTheDocument()
  })

  it("shows the server's reason a config is invalid and keeps the start button off", async () => {
    vi.useFakeTimers()
    rest.getConfigDefaults.mockResolvedValue({ config: recordedConfig(), limits: defaultLimits() })
    rest.getConfigPreview.mockResolvedValue({ ...recordedPreview(), valid: false, message: 'Weather temperature ranges leave a gap', help: null })
    renderScreen()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(screen.getByText('Weather temperature ranges leave a gap')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start 7-day game/ })).toBeDisabled()
  })
})
