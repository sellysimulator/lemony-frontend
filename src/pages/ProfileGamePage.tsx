import { useEffect, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import GameCharts from '../components/charts/GameCharts'
import { SummaryTiles } from '../components/report/GameOver'
import { errorMessage } from '../api/http'
import { getMyGame } from '../api/rest'
import { useAuth } from '../auth/AuthContext'
import type { GameSummary } from '../types/game'
import type { RouteDescriptor } from '../routes/registry'

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
      <Link to="/profile" className="text-sm text-ink-muted underline">
        ← Back to profile
      </Link>
      {mode !== 'authenticated' ? <p className="mt-4">Sign in to see saved games.</p> : null}
      {error ? <p className="mt-4 text-bad">{error}</p> : null}
      {!game && !error && mode === 'authenticated' ? <LoadingSpinner size="lg" /> : null}
      {game ? (
        <div className="mt-3 space-y-5">
          <h1 className="text-3xl font-extrabold">
            {game.days_played}-day game · {game.finished_at ? new Date(`${game.finished_at}Z`).toLocaleDateString() : ''}
          </h1>
          <SummaryTiles summary={game} />
          <GameCharts summary={game} />
        </div>
      ) : null}
    </Layout>
  )
}

export const route: RouteDescriptor = { path: '/profile/games/:gameId', guard: 'auth+backend', element: <ProfileGamePage /> }
