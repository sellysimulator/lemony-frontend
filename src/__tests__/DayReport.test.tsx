import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PERSON_SERIES } from '../components/charts/chartSetup'
import DayReport from '../components/report/DayReport'
import type { WatchedDay } from '../store/gameStore'
import type { CustomerEvent, DayRecord, GameState, PersonType } from '../types/game'

vi.mock('react-chartjs-2', () => ({
  Line: () => <canvas />,
  Bar: () => <canvas />,
}))
vi.mock('../api/socketHandlers', () => ({ acknowledgeDay: vi.fn() }))

const TYPES: PersonType[] = ['Child', 'Teenager', 'Adult', 'Senior']

function record(over: Partial<DayRecord> = {}): DayRecord {
  const by_type = {
    Child: { visitors: 10, buyers: 5, sold_out: 0 },
    Teenager: { visitors: 40, buyers: 10, sold_out: 0 },
    Adult: { visitors: 20, buyers: 15, sold_out: 0 },
    Senior: { visitors: 4, buyers: 1, sold_out: 0 },
  }
  return {
    day: 2,
    weather: 'sunny',
    temperature: 25,
    price: 0.5,
    recipe: { ice: 1, sugar: 1, lemons: 2 },
    cost_per_cup: 0.2,
    purchased: { ice: 0, sugar: 0, lemons: 0, cups: 0 },
    spend: 0,
    revenue: 10,
    profit: 5,
    visitors: 74,
    buyers: 31,
    sold_out: 0,
    refused: 43,
    conversion: 31 / 74,
    popularity: 0.5,
    perished: { ice: 0, sugar: 0, lemons: 0, cups: 0 },
    perished_value: 0,
    cash_end: 100,
    by_type,
    by_hour: [{ hour: 9, visitors: 74, buyers: 31, sold_out: 0 }],
    refusal_reasons: { too_sweet: 3, too_pricey: 12, too_much_ice: 7 },
    ...over,
  } as DayRecord
}

const EVENT = { type: 'Child', arrive_min: 5, outcome: 'bought', reason: null, probability: 0.5 } as CustomerEvent

function renderReport(rec: DayRecord, events: CustomerEvent[] = [EVENT]) {
  const watch: WatchedDay = { day: rec.day, record: rec, events }
  const state = { phase: 'planning', popularity: 0.5, days: [rec] } as unknown as GameState
  return render(<DayReport watch={watch} state={state} />)
}

function bars(name: string): HTMLElement[] {
  return within(screen.getByRole('list', { name })).getAllByRole('listitem')
}

describe('DayReport: why people said no', () => {
  it('ranks the reasons by count, biggest first', () => {
    renderReport(record())
    const rows = bars('Why people said no').map((li) => li.textContent ?? '')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('Too pricey')
    expect(rows[1]).toContain('Too much ice')
    expect(rows[2]).toContain('Too sweet')
  })

  it('prints each bar\'s count as text', () => {
    renderReport(record())
    const rows = bars('Why people said no')
    expect(within(rows[0]).getByText('12')).toBeInTheDocument()
    expect(within(rows[1]).getByText('7')).toBeInTheDocument()
    expect(within(rows[2]).getByText('3')).toBeInTheDocument()
  })

  it('keeps the footnote with the price and recipe', () => {
    renderReport(record())
    expect(screen.getByText(/Each refusal names the price/)).toBeInTheDocument()
  })

  it('keeps "Nobody turned you down!" on a day with no refusals', () => {
    renderReport(record({ refusal_reasons: {}, refused: 0 }))
    expect(screen.getByText('Nobody turned you down!')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Why people said no' })).toBeNull()
  })
})

describe('DayReport: by customer type', () => {
  it('draws a bar of visitors per type with the visitor count and success rate as text', () => {
    renderReport(record())
    const rows = bars('Visitors by customer type')
    expect(rows).toHaveLength(4)
    const text = (t: PersonType) => rows.find((r) => r.textContent?.includes(t))?.textContent ?? ''
    expect(text('Child')).toContain('10')
    expect(text('Child')).toContain('50%')
    expect(text('Teenager')).toContain('40')
    expect(text('Teenager')).toContain('25%')
    expect(text('Adult')).toContain('75%')
    expect(text('Senior')).toContain('25%')
  })

  it('colours each type\'s bar with its fixed colour and sizes it by visitors', () => {
    renderReport(record())
    const rows = bars('Visitors by customer type')
    for (const t of TYPES) {
      const row = rows.find((r) => r.textContent?.includes(t))!
      const probe = document.createElement('i')
      probe.style.backgroundColor = PERSON_SERIES[t]
      const rgb = probe.style.backgroundColor
      const bar = [...row.querySelectorAll<HTMLElement>('*')].find((e) => e.style.backgroundColor === rgb)
      expect(bar, `${t} bar colour`).toBeDefined()
    }
    const widthOf = (t: PersonType) => {
      const row = rows.find((r) => r.textContent?.includes(t))!
      return parseFloat([...row.querySelectorAll<HTMLElement>('*')].find((e) => e.style.width.endsWith('%'))!.style.width)
    }
    expect(widthOf('Teenager')).toBeCloseTo(100)
    expect(widthOf('Child')).toBeCloseTo(25)
  })

  it('shows a dash for the success rate of a type with no visitors', () => {
    const r = record()
    r.by_type.Senior = { visitors: 0, buyers: 0, sold_out: 0 }
    renderReport(r)
    const senior = bars('Visitors by customer type').find((x) => x.textContent?.includes('Senior'))!
    expect(senior.textContent).toContain('—')
  })
})

describe('DayReport: replay button', () => {
  it('is hidden when the day has no events', () => {
    renderReport(record(), [])
    expect(screen.queryByRole('button', { name: 'Replay day' })).toBeNull()
  })

  it('is shown when the day has events', () => {
    renderReport(record(), [EVENT])
    expect(screen.getByRole('button', { name: 'Replay day' })).toBeInTheDocument()
  })
})
