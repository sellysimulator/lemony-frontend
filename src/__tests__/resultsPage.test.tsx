/**
 * The results page, `/results/:publicId`: the one results URL of a finished game. It is public
 * (no sign-in, live game or browser storage), and the end screen links to it once the game is saved.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameSummary } from '../types/game'

const h = vi.hoisted(() => ({
  getGameResults: vi.fn(),
  getMyGame: vi.fn(),
}))

vi.mock('../../firebase', () => ({ auth: null, firebaseConfigured: true, googleProvider: {} }))
vi.mock('../components/charts/GameCharts', () => ({ default: () => <p>charts</p> }))
// Signed out: no identity chosen, no Firebase user.
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: null, mode: null, loading: false, googleAvailable: false, logout: vi.fn() }),
}))
vi.mock('../api/socketHandlers', () => ({ retryPersist: vi.fn(), createGame: vi.fn(), abandonGame: vi.fn() }))
vi.mock('../api/rest', () => ({ getGameResults: h.getGameResults, getMyGame: h.getMyGame }))

import App from '../App'
import GameOver from '../components/report/GameOver'
import { route } from '../pages/ResultsPage'
import { resultsPath } from '../routes/resultsPath'

const PUBLIC_ID = '0123456789abcdef0123456789abcdef'

const stored = {
  public_id: PUBLIC_ID,
  num_days: 3,
  days_played: 3,
  starting_cash: 20,
  final_cash: 31.5,
  total_profit: 11.5,
  total_revenue: 40,
  total_spend: 28.5,
  total_visitors: 120,
  total_buyers: 60,
  total_sold_out: 0,
  conversion: 0.5,
  final_popularity: 0.55,
  neutral_popularity: 0.5,
  perished_totals: { ice: 1, sugar: 0, lemons: 2, cups: 0 },
  total_perished_value: 0.4,
  hour_totals: [],
  days: [],
  finished_at: '2026-11-18T14:00:00Z',
} as unknown as GameSummary

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** Browser storage that records every touch: the results page must need none. */
const touched: string[] = []
function watchedStorage(name: string): Storage {
  const touch = (what: string) => () => {
    touched.push(`${name}.${what}`)
    return null
  }
  return { length: 0, clear: touch('clear'), getItem: touch('getItem'), key: touch('key'), removeItem: touch('removeItem'), setItem: touch('setItem') } as Storage
}

beforeEach(() => {
  touched.length = 0
  vi.stubGlobal('localStorage', watchedStorage('localStorage'))
  vi.stubGlobal('sessionStorage', watchedStorage('sessionStorage'))
  h.getGameResults.mockReset()
  h.getMyGame.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('results page', () => {
  it('is the public route /results/:publicId', () => {
    expect(route.path).toBe('/results/:publicId')
    expect(route.guard).toBe('public')
    expect(resultsPath(PUBLIC_ID)).toBe(`/results/${PUBLIC_ID}`)
  })

  it('shows a stored game signed out, from the server alone', async () => {
    h.getGameResults.mockResolvedValue(stored)
    at(`/results/${PUBLIC_ID}`)
    expect(await screen.findByRole('heading', { name: /3-day game/ })).toBeInTheDocument()
    expect(screen.getByText('Final cash')).toBeInTheDocument()
    expect(screen.getByText('31.50', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('charts')).toBeInTheDocument()
    expect(h.getGameResults).toHaveBeenCalledWith(PUBLIC_ID)
    expect(h.getMyGame).not.toHaveBeenCalled()
    // Not redirected to the welcome screen, and no browser storage read or written.
    expect(screen.queryByText(/Continue as guest/i)).toBeNull()
    expect(touched).toEqual([])
  })

  it('says so when no finished game has that id', async () => {
    h.getGameResults.mockRejectedValue({ response: { status: 404, data: { detail: 'Game not found.' } } })
    at(`/results/${PUBLIC_ID}`)
    expect(await screen.findByText('No finished game at this link.')).toBeInTheDocument()
  })

  it('shows any other failure in words', async () => {
    h.getGameResults.mockRejectedValue({ response: { status: 503, headers: {}, data: {} } })
    at(`/results/${PUBLIC_ID}`)
    expect(await screen.findByText(/server is busy/)).toBeInTheDocument()
  })
})

describe('end screen', () => {
  function over(publicId: string | null, signedIn: boolean) {
    return render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<GameOver summary={stored} publicId={publicId} saveFailed={false} signedIn={signedIn} />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it.each([false, true])('links to the results page once the game is saved (signed in: %s)', (signedIn) => {
    over(PUBLIC_ID, signedIn)
    expect(screen.getByRole('link', { name: 'Results page' })).toHaveAttribute('href', `/results/${PUBLIC_ID}`)
    // The end screen links no other results URL.
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/\/profile\/games\//)
    }
  })

  it('has no results link while the game is unsaved', () => {
    over(null, true)
    expect(screen.queryByRole('link', { name: 'Results page' })).toBeNull()
  })
})
