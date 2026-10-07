import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import GameCharts from '../charts/GameCharts'
import { Stat } from '../shared/Card'
import LoadingSpinner from '../shared/LoadingSpinner'
import { INGREDIENTS, type GameSummary } from '../../types/game'
import { Trophy } from 'lucide-react'
import { money, pct } from '../../utils/format'
import { IngredientIcon } from '../shared/icons'

export function SummaryTiles(props: { summary: GameSummary }): ReactElement {
  const s = props.summary
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <Stat label="Final cash" value={money(s.final_cash)} />
      <Stat label="Total profit" value={money(s.total_profit)} tone={s.total_profit >= 0 ? 'good' : 'bad'} />
      <Stat label="Cups sold" value={s.total_buyers} />
      <Stat label="Visitors" value={s.total_visitors} />
      <Stat label="Success rate" value={s.total_visitors ? pct(s.total_buyers / s.total_visitors) : '—'} />
      <Stat label="Final popularity" value={s.final_popularity == null ? '—' : pct(s.final_popularity)} hint="Average of the daily success rates" />
      <Stat label="Sold-out misses" value={s.total_sold_out} tone={s.total_sold_out ? 'bad' : 'neutral'} />
      <div className="col-span-full flex flex-wrap gap-2 text-sm text-ink-muted">
        Spoiled in total:
        {INGREDIENTS.map((n) => (
          <span key={n} className="rounded bg-surface-sunken px-2 py-0.5 text-ink">
            <IngredientIcon name={n} /> {s.perished_totals[n]}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function GameOver(props: { summary: GameSummary | null; publicId: string | null; signedIn: boolean }): ReactElement {
  if (!props.summary) return <LoadingSpinner size="lg" label="Adding up the final numbers…" />
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Trophy aria-hidden className="size-8 text-brand-strong" /> Final results — {props.summary.days_played} days</h1>
        <div className="ml-auto flex gap-2">
          <Link to="/new" className="rounded-xl bg-brand px-5 py-2 font-bold">
            Play again
          </Link>
          {props.signedIn && props.publicId ? (
            <Link to={`/profile/games/${props.publicId}`} className="rounded-xl border border-border px-4 py-2 text-sm">
              Saved to your profile
            </Link>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-ink-muted">
        {props.publicId ? 'This game is saved.' : 'Saving this game…'} {!props.signedIn ? 'Sign in with Google to see saved games on your profile.' : ''}
      </p>
      <SummaryTiles summary={props.summary} />
      <GameCharts summary={props.summary} />
    </div>
  )
}
