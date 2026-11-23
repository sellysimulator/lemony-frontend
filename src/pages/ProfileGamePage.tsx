import { useEffect, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import StoredGameResults from '../components/report/StoredGameResults'
import { errorMessage } from '../api/http'
import { getMyGame } from '../api/rest'
import { useAuth } from '../auth/AuthContext'
import type { GameSummary } from '../types/game'
import type { RouteDescriptor } from '../routes/registry'
import { resultsPath } from '../routes/resultsPath'

/** The owner's view of one saved game, by its public id; `/results/:publicId` is the open one. */
function ProfileGamePage(): ReactElement {
  const { gameId = '' } = useParams()
  const { mode } = useAuth()
  const [game, setGame] = useState<GameSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'authenticated') return
    getMyGame(gameId)
      .then(setGame)
      .catch((err) => setError(errorMessage(err, 'Could not load this game.')))
  }, [gameId, mode])

  return (
    <Layout wide>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link to="/profile" className="text-ink-muted underline">
          ← Back to profile
        </Link>
        {game ? (
          <Link to={resultsPath(gameId)} className="ml-auto rounded-xl border border-border px-4 py-2">
            Results page (anyone with the link)
          </Link>
        ) : null}
      </div>
      {mode !== 'authenticated' ? <p className="mt-4">Sign in to see saved games.</p> : null}
      {error ? <p className="mt-4 text-bad">{error}</p> : null}
      {!game && !error && mode === 'authenticated' ? <LoadingSpinner size="lg" /> : null}
      {game ? <StoredGameResults game={game} /> : null}
    </Layout>
  )
}

export const route: RouteDescriptor = { path: '/profile/games/:gameId', guard: 'auth+backend', element: <ProfileGamePage /> }
