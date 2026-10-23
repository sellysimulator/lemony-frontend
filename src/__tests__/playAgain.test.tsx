import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import GameOver from '../components/report/GameOver'
import { route as configRoute } from '../pages/ConfigPage'
import type { GameConfig, GameSummary } from '../types/game'
import { defaultConfig } from './fixtures/gameState'

vi.mock('../components/charts/GameCharts', () => ({ default: () => null }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: null, mode: 'guest', logout: vi.fn() }) }))
vi.mock('../api/socketHandlers', () => ({ createGame: vi.fn() }))
vi.mock('../api/rest', () => ({
  getConfigDefaults: vi.fn(async () => ({ config: defaultConfig() })),
  validateConfig: vi.fn(async () => ({ valid: true, message: null })),
}))

const played = (): GameConfig => ({ ...defaultConfig(), num_days: 12, starting_cash: 250 })
const summary = { days_played: 12, perished_totals: { ice: 0, sugar: 0, lemons: 0, cups: 0 }, days: [], config: played() } as unknown as GameSummary

/** The number input a config field label points at (a label query over the whole config screen is slow). */
async function field(label: string): Promise<HTMLInputElement> {
  const el = (await screen.findByText(label, { selector: 'label' })) as HTMLLabelElement
  return document.getElementById(el.htmlFor) as HTMLInputElement
}

function NewGameProbe() {
  const config = (useLocation().state as { config?: GameConfig } | null)?.config
  return <p>new game with {config ? `${config.num_days} days` : 'the defaults'}</p>
}

describe('Play again', () => {
  it('opens a new game with the settings of the game just played', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<GameOver summary={summary} publicId={null} signedIn={false} />} />
          <Route path="/new" element={<NewGameProbe />} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('link', { name: 'Play again' }))
    expect(screen.getByText('new game with 12 days')).toBeInTheDocument()
  })

  it('the config screen starts from the settings it is handed, not the defaults', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/new', state: { config: played() } }]}>
        <Routes>
          <Route path="/new" element={configRoute.element} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await field('Number of days')).toHaveValue(12)
    expect(await field('Starting cash')).toHaveValue(250)
  })

  it('the config screen starts from the defaults otherwise', async () => {
    render(
      <MemoryRouter initialEntries={['/new']}>
        <Routes>
          <Route path="/new" element={configRoute.element} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await field('Number of days')).toHaveValue(7)
  })
})
