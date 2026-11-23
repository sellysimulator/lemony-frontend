import { io, type Socket } from 'socket.io-client'
import { auth } from '../../firebase'
import { getGuestId } from '../utils/storage'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''

interface HandshakeAuth {
  idToken: string | null
  guestId: string | null
}

/**
 * The server derives identity from this: a verified Firebase ID token, else a
 * guest id. A CALLBACK, so every reconnect sends a freshly refreshed token.
 *
 * Signed in but the token could not be fetched: send NO identity, never the guest
 * id. The server refuses that handshake (it never mints a guest for it), and
 * `socketHandlers` retries while the user is still signed in. Falling back to the
 * guest id would silently play as someone else.
 */
export function socketAuth(cb: (data: HandshakeAuth) => void): void {
  const user = auth?.currentUser
  if (user) {
    user
      .getIdToken()
      .then((idToken) => cb({ idToken, guestId: null }))
      .catch(() => cb({ idToken: null, guestId: null }))
  } else {
    cb({ idToken: null, guestId: getGuestId() })
  }
}

/** Whether a Firebase user is signed in (whatever the state of their token). */
export function isSignedIn(): boolean {
  return Boolean(auth?.currentUser)
}

/**
 * Deliberately NOT auto-connected: this module loads before Firebase restores
 * a session, so an auto-connect would always handshake anonymously.
 * `AuthContext` connects once the identity is known. [HARD-WON]
 *
 * The reconnect loop never gives up (no `reconnectionAttempts`: Infinity), waiting
 * at most 10 s between tries, so a backend cold start or a long outage needs no
 * restart. A handshake the server REFUSES is not retried by socket.io-client;
 * `socketHandlers` retries that itself.
 */
export const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10_000,
  path: '/socket.io',
  auth: socketAuth,
})

/**
 * (Re)connect with the current identity. A visitor who is neither signed in nor a
 * guest yet has no identity, and the server refuses a handshake without one, so
 * their socket stays closed until they pick one.
 */
export function reconnectSocket(): void {
  if (socket.connected || socket.active) socket.disconnect()
  if (isSignedIn() || getGuestId()) socket.connect()
}
