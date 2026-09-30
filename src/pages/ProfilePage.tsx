import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import Card, { Stat } from '../components/shared/Card'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/http'
import { claimGuestGames, getMyGames, getMyStats, type GameListItem, type UserStats } from '../api/rest'
import { useAlerts } from '../store/alerts'
import { clearGuestId, getGuestId } from '../utils/storage'
import { money, pct } from '../utils/format'
import type { RouteDescriptor } from '../routes/registry'

const PAGE_SIZE = 20

function GuestProfile(): ReactElement {
  const { googleAvailable, signInWithGoogle } = useAuth()
  return (
    <Card title="You're playing as a guest">
      <p className="text-ink-muted">
        Your finished games are saved under this browser's guest id. Sign in with Google to see your history and stats here — your
        guest games can be moved onto your account after signing in.
      </p>
      {googleAvailable ? (
        <button type="button" onClick={() => void signInWithGoogle().catch(() => undefined)} className="mt-4 rounded-xl border border-border bg-white px-4 py-2 font-semibold">
          Sign in with Google
        </button>
      ) : null}
    </Card>
  )
}

function ProfilePage(): ReactElement {
  const { mode, firebaseUser } = useAuth()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [games, setGames] = useState<GameListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [guestId, setGuestIdState] = useState(getGuestId)
  const push = useAlerts((s) => s.push)

  const load = useCallback(() => {
    if (mode !== 'authenticated') return
    Promise.all([getMyStats(), getMyGames(page, PAGE_SIZE)])
      .then(([s, g]) => {
        setError(null)
        setStats(s)
        setGames(g.items)
        setTotal(g.total)
      })
      .catch((err) => setError(errorMessage(err, 'Could not load your profile.')))
  }, [mode, page])

  useEffect(load, [load])

  if (mode !== 'authenticated') {
    return (
      <Layout>
        <GuestProfile />
      </Layout>
    )
  }

  const claim = async () => {
    if (!guestId) return
    try {
      const n = await claimGuestGames(guestId)
      clearGuestId()
      setGuestIdState(null)
      push('success', n ? `Moved ${n} guest game${n === 1 ? '' : 's'} to your account.` : 'No finished guest games to move.')
      load()
    } catch (err) {
      push('error', errorMessage(err, 'Could not move your guest games.'))
    }
  }

  return (
    <Layout>
      <h1 className="mb-4 text-3xl font-extrabold">{firebaseUser?.displayName ?? 'Your'} profile</h1>
      {guestId ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-brand-soft p-4 text-sm">
          <span>You also played as a guest on this browser.</span>
          <button type="button" onClick={() => void claim()} className="ml-auto rounded-lg bg-brand px-3 py-1.5 font-bold">
            Move guest games to my account
          </button>
        </div>
      ) : null}
      {error ? <p className="text-bad">{error}</p> : null}
      {!stats && !error ? <LoadingSpinner label="Loading your stats…" /> : null}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Games" value={stats.games_played} />
          <Stat label="Days played" value={stats.days_played} />
          <Stat label="Cups sold" value={stats.total_cups_sold} />
          <Stat label="Success rate" value={stats.total_visitors ? pct(stats.total_cups_sold / stats.total_visitors) : '—'} />
          <Stat label="Total profit" value={money(stats.total_profit)} tone={stats.total_profit >= 0 ? 'good' : 'bad'} />
          <Stat label="Best game" value={stats.best_profit !== null ? money(stats.best_profit) : '—'} />
          <Stat label="Average profit" value={stats.avg_profit !== null ? money(stats.avg_profit) : '—'} />
        </div>
      ) : null}

      <Card title="Game history" className="mt-6">
        {games.length === 0 ? (
          <p className="text-sm text-ink-muted">No finished games yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th className="py-1">Finished</th>
                  <th>Days</th>
                  <th>Profit</th>
                  <th>Cups</th>
                  <th>Success</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.public_id} className="border-t border-border">
                    <td className="py-1.5">{new Date(`${g.finished_at}Z`).toLocaleString()}</td>
                    <td>{g.days_played}</td>
                    <td className={g.total_profit >= 0 ? 'text-good' : 'text-bad'}>{money(g.total_profit)}</td>
                    <td>{g.total_buyers}</td>
                    <td>{g.total_visitors ? pct(g.total_buyers / g.total_visitors) : '—'}</td>
                    <td className="text-right">
                      <Link to={`/profile/games/${g.public_id}`} className="underline">
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE_SIZE ? (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-30">
              ←
            </button>
            <span>
              Page {page} of {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button type="button" disabled={page * PAGE_SIZE >= total} onClick={() => setPage(page + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-30">
              →
            </button>
          </div>
        ) : null}
      </Card>
    </Layout>
  )
}

export const route: RouteDescriptor = { path: '/profile', guard: 'auth+backend', element: <ProfilePage /> }
