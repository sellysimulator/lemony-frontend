import type { ReactElement } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { abandonGame } from '../api/socketHandlers'
import { useGameStore } from '../store/gameStore'
import type { RouteDescriptor } from '../routes/registry'
import { money } from '../utils/format'
import { WeatherIcon } from '../components/shared/icons'

function HomePage(): ReactElement {
  const { resume, state } = useGameStore()
  const navigate = useNavigate()

  return (
    <Layout>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-3xl border border-border bg-gradient-to-br from-brand-soft to-white p-8 shadow-sm">
          <h1 className="text-3xl font-extrabold">Open a new stand</h1>
          <p className="mt-2 text-ink-muted">
            Tune the world — customers, weather, ingredient costs and shelf life — then play 1 to 30 days.
          </p>
          <Link
            to="/new"
            className="mt-6 inline-block rounded-xl bg-brand px-5 py-3 font-bold text-ink shadow-sm hover:brightness-95"
          >
            Configure a new game
          </Link>
        </section>

        <section className="rounded-3xl border border-border bg-surface-raised p-8 shadow-sm">
          <h2 className="text-2xl font-bold">Game in progress</h2>
          {resume === 'unknown' ? (
            <div className="mt-6">
              <LoadingSpinner label="Looking for your game…" />
            </div>
          ) : resume === 'active' && state && state.phase !== 'finished' ? (
            <div className="mt-4 space-y-3">
              <p className="text-ink-muted">
                Day <strong className="text-ink">{state.day}</strong> of {state.num_days} ·{' '}
                <WeatherIcon weather={state.today.weather} /> {state.today.temperature}°C · Cash{' '}
                <strong className="text-ink">{money(state.cash)}</strong>
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/play')}
                  className="rounded-xl bg-leaf px-5 py-3 font-bold text-white shadow-sm hover:brightness-95"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Abandon this game? It will not be saved.')) abandonGame()
                  }}
                  className="rounded-xl border border-border px-4 py-3 text-ink-muted hover:text-bad"
                >
                  Abandon
                </button>
              </div>
            </div>
          ) : resume === 'active' && state?.phase === 'finished' ? (
            <div className="mt-4 space-y-3">
              <p className="text-ink-muted">Your last game is finished.</p>
              <button type="button" onClick={() => navigate('/play')} className="rounded-xl border border-border px-4 py-2 font-semibold">
                See final results
              </button>
            </div>
          ) : (
            <p className="mt-4 text-ink-muted">No game in progress. Start one on the left.</p>
          )}
        </section>
      </div>
    </Layout>
  )
}

export const route: RouteDescriptor = { path: '/home', guard: 'auth+backend', element: <HomePage /> }
