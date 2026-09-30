import { Citrus } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import type { RouteDescriptor } from '../routes/registry'

function WelcomeScreen(): ReactElement {
  const { mode, loading, googleAvailable, signInWithGoogle, continueAsGuest } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/home'
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  // Identity already chosen (restored session or guest): skip the front door. [HARD-WON]
  if (mode !== null) return <Navigate to={destination} replace />

  const google = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
      navigate(destination, { replace: true })
    } catch {
      setError('Google sign-in did not complete. You can try again or play as a guest.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-200 via-amber-50 to-surface px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface-raised p-8 text-center shadow-xl">
        <Citrus aria-hidden className="mx-auto size-20 text-brand-strong" strokeWidth={2} />
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Lemony</h1>
        <p className="mt-2 text-ink-muted">
          Run your own lemonade stand. Buy ingredients, set a price and recipe, then watch every customer walk up
          — and decide.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {googleAvailable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void google()}
              className="rounded-xl border border-border bg-white px-4 py-3 font-semibold shadow-sm hover:border-brand-strong disabled:opacity-50"
            >
              Sign in with Google
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              continueAsGuest()
              navigate(destination, { replace: true })
            }}
            className="rounded-xl bg-brand px-4 py-3 font-bold text-ink shadow-sm hover:brightness-95"
          >
            Play as guest
          </button>
          <p className="text-xs text-ink-subtle">
            {googleAvailable
              ? 'Signed-in players keep their game history and stats on their profile.'
              : 'Google sign-in is not configured on this build; guest games are still saved.'}
          </p>
          {error ? <p className="text-sm text-bad">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}

export const route: RouteDescriptor = { path: '/', guard: 'public', element: <WelcomeScreen /> }
