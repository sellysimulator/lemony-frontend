import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { browserPopupRedirectResolver, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, firebaseConfigured, googleProvider } from '../../firebase'
import http from '../api/http'
import { reconnectSocket } from '../api/socket'
import { useGameStore } from '../store/gameStore'
import { clearGuestId, clearStoredGame, getGuestId, getOrCreateGuestId } from '../utils/storage'

export type AuthMode = 'authenticated' | 'guest' | null

export interface AuthContextValue {
  firebaseUser: User | null
  mode: AuthMode
  loading: boolean
  googleAvailable: boolean
  signInWithGoogle(): Promise<void>
  continueAsGuest(): void
  logout(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Firebase can stall (not fail) restoring a session; after this the app stops
 * waiting and treats the visitor as guest-or-nobody. A late answer still lands.
 */
const AUTH_INIT_TIMEOUT_MS = 8000

function syncUserWithBackend(user: User): void {
  void http
    .post('/users/upsert', {
      display_name: user.displayName ?? null,
      email: user.email ?? null,
      photo_url: user.photoURL ?? null,
    })
    .catch(() => undefined)
}

export function AuthProvider(props: { children: ReactNode }): ReactElement {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  // Without Firebase there is nothing to wait for: the identity is known now.
  const [mode, setMode] = useState<AuthMode>(() => (auth ? null : getGuestId() ? 'guest' : null))
  const [loading, setLoading] = useState(Boolean(auth))

  useEffect(() => {
    if (!auth) {
      reconnectSocket()
      return
    }
    let resolved = false
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      resolved = true
      if (user) {
        setFirebaseUser(user)
        setMode('authenticated')
        syncUserWithBackend(user)
      } else {
        setFirebaseUser(null)
        setMode(getGuestId() ? 'guest' : null)
      }
      setLoading(false)
      reconnectSocket()
    })
    const watchdog = setTimeout(() => {
      if (resolved) return
      setMode(getGuestId() ? 'guest' : null)
      setLoading(false)
      reconnectSocket()
    }, AUTH_INIT_TIMEOUT_MS)
    return () => {
      clearTimeout(watchdog)
      unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!auth) return
    const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver)
    setFirebaseUser(result.user)
    setMode('authenticated')
    syncUserWithBackend(result.user)
    // onAuthStateChanged reconnects the socket with the new identity.
  }, [])

  const continueAsGuest = useCallback(() => {
    getOrCreateGuestId()
    setMode('guest')
    reconnectSocket()
  }, [])

  const logout = useCallback(async () => {
    if (auth?.currentUser) await signOut(auth)
    clearGuestId()
    clearStoredGame()
    useGameStore.getState().reset()
    setFirebaseUser(null)
    setMode(null)
    reconnectSocket()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      mode,
      loading,
      googleAvailable: firebaseConfigured,
      signInWithGoogle,
      continueAsGuest,
      logout,
    }),
    [firebaseUser, mode, loading, signInWithGoogle, continueAsGuest, logout],
  )

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
