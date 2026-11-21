import type { ReactElement } from 'react'
import GameCharts from '../charts/GameCharts'
import { SummaryTiles } from './GameOver'
import type { GameSummary } from '../../types/game'

/**
 * A stored game's results: the end screen's tiles and charts, from the server's copy. Shown on
 * the open results page (`/results/:publicId`) and on the owner's profile game page. No chart
 * opens a day report here: the day reports belong to the live game.
 */
export default function StoredGameResults(props: { game: GameSummary }): ReactElement {
  const game = props.game
  return (
    <div className="mt-3 space-y-5">
      <h1 className="text-3xl font-extrabold">
        {game.days_played}-day game · {game.finished_at ? new Date(game.finished_at).toLocaleDateString() : ''}
      </h1>
      <SummaryTiles summary={game} />
      <GameCharts summary={game} />
    </div>
  )
}
