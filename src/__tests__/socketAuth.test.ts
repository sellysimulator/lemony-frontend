/**
 * The handshake identity: never a silent fall back to the guest id while signed in, and no
 * connection at all without an identity (the server refuses one).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  auth: { currentUser: null as null | { getIdToken: () => Promise<string> } },
  guestId: null as string | null,
  socket: { connected: false, active: false, connect: vi.fn(), disconnect: vi.fn() },
  options: null as null | Record<string, unknown>,
}))

vi.mock('../../firebase', () => ({ auth: h.auth }))
vi.mock('../utils/storage', () => ({ getGuestId: () => h.guestId }))
vi.mock('socket.io-client', () => ({
  io: (_url: string, options: Record<string, unknown>) => {
    h.options = options
    return h.socket
  },
}))

const { socketAuth, reconnectSocket } = await import('../api/socket')
const GUEST = 'guest_00000000-0000-0000-0000-000000000000'

function handshake(): Promise<unknown> {
  return new Promise((resolve) => socketAuth(resolve))
}

beforeEach(() => {
  h.auth.currentUser = null
  h.guestId = GUEST
  h.socket.connect.mockClear()
  h.socket.disconnect.mockClear()
})

describe('socket handshake', () => {
  it('reconnects forever, at most 10 s apart', () => {
    expect(h.options).not.toHaveProperty('reconnectionAttempts')
    expect(h.options).toMatchObject({ reconnection: true, reconnectionDelayMax: 10_000 })
  })

  it('a signed-in user sends a fresh token and no guest id', async () => {
    h.auth.currentUser = { getIdToken: async () => 'tok' }
    expect(await handshake()).toEqual({ idToken: 'tok', guestId: null })
  })

  it('a signed-in user whose token fails sends no identity, never the guest id', async () => {
    h.auth.currentUser = { getIdToken: async () => Promise.reject(new Error('offline')) }
    expect(await handshake()).toEqual({ idToken: null, guestId: null })
  })

  it('a guest sends the guest id', async () => {
    expect(await handshake()).toEqual({ idToken: null, guestId: GUEST })
  })

  it('a visitor with no identity yet is not connected', () => {
    h.guestId = null
    reconnectSocket()
    expect(h.socket.connect).not.toHaveBeenCalled()
    h.guestId = GUEST
    reconnectSocket()
    expect(h.socket.connect).toHaveBeenCalledTimes(1)
  })
})
