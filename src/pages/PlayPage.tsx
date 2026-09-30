import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import PlanDay from '../components/plan/PlanDay'
import DayView from '../components/day/DayView'
import DayReport from '../components/report/DayReport'
import GameOver from '../components/report/GameOver'
import { useAuth } from '../auth/AuthContext'
import { useGameStore } from '../store/gameStore'
import type { RouteDescriptor } from '../routes/registry'

/** The whole game loop on one route; the store's `view` picks the screen. */
function PlayPage(): ReactElement {
  const { resume, state, view, watch, summary, publicId } = useGameStore()
  const { mode } = useAuth()

  let body: ReactElement
  if (resume === 'unknown' || (resume === 'active' && !state)) {
    body = <LoadingSpinner size="lg" label="Finding your stand…" />
  } else if (resume === 'none' || !state) {
    body = (
      <div className="py-16 text-center">
        <p className="text-lg">No game in progress.</p>
        <Link to="/new" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2 font-bold">
          Start one
        </Link>
      </div>
    )
  } else if (view === 'day' && watch) {
    body = <DayView key={watch.day} watch={watch} config={state.config} />
  } else if (view === 'report' && watch) {
    body = <DayReport watch={watch} state={state} />
  } else if (state.phase === 'finished') {
    body = <GameOver summary={summary ?? state.summary} publicId={publicId} signedIn={mode === 'authenticated'} />
  } else if (state.phase === 'played') {
    body = <LoadingSpinner size="lg" />
  } else {
    body = <PlanDay key={state.day} state={state} />
  }

  return <Layout wide>{body}</Layout>
}

export const route: RouteDescriptor = { path: '/play', guard: 'auth+backend', element: <PlayPage /> }
