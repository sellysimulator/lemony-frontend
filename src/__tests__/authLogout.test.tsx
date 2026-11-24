/**
 * `logout()` signs out a signed-in user only. Without a Firebase user it does nothing, so a
 * guest's id (their finished games) survives (game_stack.md "Only signed-in users sign out").
 */
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  authObject: { currentUser: null as unknown },
  authCb: null as ((user: unknown) => void) | null,
  signOutCalls: 0,
  reconnects: 0,
}))

vi.mock('../../firebase', () => ({ auth: h.authObject, firebaseConfigured: true, googleProvider: {} }))
vi.mock('firebase/auth', () => ({
  browserPopupRedirectResolver: {},
  signInWithPopup: vi.fn(),
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    h.authCb = cb
    return () => undefined
  },
  signOut: async () => {
    h.signOutCalls += 1
  },
}))
vi.mock('../api/socket', () => ({
  reconnectSocket: () => {
    h.reconnects += 1
  },
}))
vi.mock('../api/http', () => ({ default: { post: async () => ({ data: null }) } }))

import { AuthProvider, useAuth } from '../auth/AuthContext'
import { GUEST_ID_KEY } from '../utils/storage'

const GUEST = 'guest_00000000-0000-0000-0000-000000000000'
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

/** A fresh in-memory localStorage: on newer Node the global one is undefined in jsdom without `--localstorage-file`. */
function memoryStorage(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key)
    },
    setItem: (key: string, value: string) => {
      entries.set(key, String(value))
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  h.authObject.currentUser = null
  h.authCb = null
  h.signOutCalls = 0
  h.reconnects = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('logout', () => {
  it('a guest (no Firebase user) is not signed out: the guest id, mode and socket stay', async () => {
    localStorage.setItem(GUEST_ID_KEY, GUEST)
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => h.authCb?.(null))
    expect(result.current.mode).toBe('guest')
    const reconnects = h.reconnects
    await act(async () => {
      await result.current.logout()
    })
    expect(h.signOutCalls).toBe(0)
    expect(result.current.mode).toBe('guest')
    expect(localStorage.getItem(GUEST_ID_KEY)).toBe(GUEST)
    expect(h.reconnects).toBe(reconnects)
  })

  it('a signed-in user is signed out of Firebase and the stored guest id is cleared', async () => {
    localStorage.setItem(GUEST_ID_KEY, GUEST)
    const user = { displayName: 'Ana', email: null, photoURL: null }
    h.authObject.currentUser = user
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => h.authCb?.(user))
    expect(result.current.mode).toBe('authenticated')
    await act(async () => {
      await result.current.logout()
    })
    expect(h.signOutCalls).toBe(1)
    expect(result.current.mode).toBeNull()
    expect(localStorage.getItem(GUEST_ID_KEY)).toBeNull()
  })
})

// Each path below reconnects only through `reconnectSocket`, which connects nothing without an
// identity (`socketAuth.test.ts`): the server refuses a handshake that has none.
describe('connecting with no identity', () => {
  it('first load, the auth watchdog and logout go through reconnectSocket, with no identity left', async () => {
    const first = renderHook(() => useAuth(), { wrapper })
    act(() => h.authCb?.(null)) // first load: nobody signed in, no guest id
    expect(first.result.current.mode).toBeNull()
    expect(h.reconnects).toBe(1)
    first.unmount()

    vi.useFakeTimers()
    try {
      const late = renderHook(() => useAuth(), { wrapper })
      act(() => vi.advanceTimersByTime(8_000)) // Firebase never answered: the watchdog
      expect(late.result.current.mode).toBeNull()
      expect(h.reconnects).toBe(2)
      late.unmount()
    } finally {
      vi.useRealTimers()
    }

    const user = { displayName: 'Ana', email: null, photoURL: null }
    h.authObject.currentUser = user
    const signedIn = renderHook(() => useAuth(), { wrapper })
    act(() => h.authCb?.(user))
    const before = h.reconnects
    await act(async () => {
      await signedIn.result.current.logout()
    })
    expect(localStorage.getItem(GUEST_ID_KEY)).toBeNull()
    expect(h.reconnects).toBe(before + 1)
  })
})
