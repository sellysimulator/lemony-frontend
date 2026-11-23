import { useEffect, useState, type ReactElement } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import StoredGameResults from '../components/report/StoredGameResults'
import { errorMessage } from '../api/http'
import { getGameResults } from '../api/rest'
import type { GameSummary } from '../types/game'
import type { RouteDescriptor } from '../routes/registry'

type Outcome = { id: string; game: GameSummary } | { id: string; error: string }

function isNotFound(err: unknown): boolean {
  return (err as { response?: { status?: number } } | null)?.response?.status === 404
}

/**
 * A finished game's results from the server's stored copy (`GET /games/id/{publicId}/results`).
 * Public: it needs no sign-in, live game or browser storage, so the link works anywhere. Links to
 * it are built with `routes/resultsPath.ts`.
 */
function ResultsPage(): ReactElement {
  const { publicId = '' } = useParams()
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    let cancelled = false
    getGameResults(publicId)
      .then((game) => {
        if (!cancelled) setOutcome({ id: publicId, game })
      })
      .catch((err) => {
        if (cancelled) return
        const error = isNotFound(err) ? 'No finished game at this link.' : errorMessage(err, 'Could not load the results.')
        setOutcome({ id: publicId, error })
      })
    return () => {
      cancelled = true
    }
  }, [publicId])

  // A result for another id (the link just changed) is not shown.
  const current = outcome?.id === publicId ? outcome : null
  return (
    <Layout wide>
      {current === null ? <LoadingSpinner size="lg" label="Loading the results…" /> : null}
      {current && 'error' in current ? <p className="mt-4 text-bad">{current.error}</p> : null}
      {current && 'game' in current ? <StoredGameResults game={current.game} /> : null}
    </Layout>
  )
}

export const route: RouteDescriptor = { path: '/results/:publicId', guard: 'public', element: <ResultsPage /> }
