/**
 * The app header: only a signed-in user can sign out; a guest gets a way to sign in instead
 * (game_stack.md "Only signed-in users sign out").
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAlerts } from '../store/alerts'
import { useGameStore } from '../store/gameStore'
import type { GameState } from '../types/game'

const h = vi.hoisted(() => ({
  auth: {
    firebaseUser: null as { displayName: string | null; photoURL: string | null } | null,
    mode: 'guest' as 'authenticated' | 'guest' | null,
    googleAvailable: true,
    signInWithGoogle: vi.fn(async (): Promise<void> => undefined),
    logout: vi.fn(async (): Promise<void> => undefined),
  },
}))

vi.mock('../auth/AuthContext', () => ({ useAuth: () => h.auth }))

import Layout from '../components/shared/Layout'

function renderLayout() {
  return render(
    <MemoryRouter>
      <Layout>
        <p>page</p>
      </Layout>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  h.auth.firebaseUser = null
  h.auth.mode = 'guest'
  h.auth.googleAvailable = true
  h.auth.signInWithGoogle = vi.fn(async (): Promise<void> => undefined)
  h.auth.logout = vi.fn(async (): Promise<void> => undefined)
  useAlerts.setState({ alerts: [] })
  useGameStore.getState().reset()
  vi.restoreAllMocks()
})

describe('Layout header', () => {
  it('a signed-in user sees Profile and Sign out, and no Sign in', async () => {
    h.auth.mode = 'authenticated'
    h.auth.firebaseUser = { displayName: 'Ana', photoURL: null }
    renderLayout()
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(h.auth.logout).toHaveBeenCalledTimes(1)
  })

  it('a guest sees Guest, Profile and Sign in, and no Sign out', async () => {
    renderLayout()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(h.auth.signInWithGoogle).toHaveBeenCalledTimes(1)
    expect(h.auth.logout).not.toHaveBeenCalled()
  })

  it('a failed sign-in from the header raises an error alert', async () => {
    h.auth.signInWithGoogle = vi.fn(async (): Promise<void> => {
      throw new Error('popup blocked')
    })
    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    const alerts = useAlerts.getState().alerts
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe('error')
  })

  it('without Google sign-in on this build a guest sees neither Sign in nor Sign out', () => {
    h.auth.googleAvailable = false
    renderLayout()
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  })

  it('a guest with a game in progress is asked first, since that game will not carry over', async () => {
    useGameStore.setState({ state: { game_id: 'g1', phase: 'planning' } as GameState })
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(ask).toHaveBeenCalledWith(expect.stringMatching(/will not carry over/))
    expect(h.auth.signInWithGoogle).not.toHaveBeenCalled()

    ask.mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(h.auth.signInWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('a guest whose game is finished signs in without being asked', async () => {
    useGameStore.setState({ state: { game_id: 'g1', phase: 'finished' } as GameState })
    const ask = vi.spyOn(window, 'confirm')
    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(ask).not.toHaveBeenCalled()
    expect(h.auth.signInWithGoogle).toHaveBeenCalledTimes(1)
  })
})
