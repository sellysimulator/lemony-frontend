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
 */
function socketAuth(cb: (data: HandshakeAuth) => void): void {
  const user = auth?.currentUser
  const guestId = getGuestId()
  if (user) {
    user
      .getIdToken()
      .then((idToken) => cb({ idToken, guestId: null }))
      .catch(() => cb({ idToken: null, guestId }))
  } else {
    cb({ idToken: null, guestId })
  }
}

/**
 * Deliberately NOT auto-connected: this module loads before Firebase restores
 * a session, so an auto-connect would always handshake anonymously.
 * `AuthContext` connects once the identity is known. [HARD-WON]
 */
export const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  path: '/socket.io',
  auth: socketAuth,
})

/** Restart a reconnect loop that gave up during a backend cold start. */
export function reconnectIfGaveUp(): void {
  if (socket.active && !socket.connected) socket.connect()
}

export function reconnectSocket(): void {
  if (socket.connected) socket.disconnect().connect()
  else socket.connect()
}
