import type { ReactElement } from 'react'
import { usePlayback } from '../../store/playback'
import { revealedCount } from '../../game/timeline'
import type { CustomerEvent } from '../../types/game'
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import { clockLabel, money, REASON_TEXT } from '../../utils/format'
import { PersonIcon } from '../shared/icons'

const FEED_LENGTH = 14

export default function DecisionFeed(props: { events: CustomerEvent[]; price: number }): ReactElement {
  const clock = usePlayback((s) => s.clock)
  const n = revealedCount(props.events, clock)
  const recent = props.events.slice(Math.max(0, n - FEED_LENGTH), n).reverse()
  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-3 shadow-sm">
      <h3 className="mb-2 text-sm font-bold">At the stand</h3>
      {recent.length === 0 ? <p className="text-sm text-ink-muted">Nobody yet…</p> : null}
      <ul className="grid gap-x-6 gap-y-1 xl:grid-cols-2" aria-live="polite">
        {recent.map((e) => (
          <li key={e.id} className="flex min-w-0 items-center gap-2 text-sm">
            <PersonIcon type={e.type} />
            <span className="w-16 text-xs text-ink-subtle tabular-nums">{clockLabel(e.arrive_min)}</span>
            <span className="text-ink-muted">{e.type}</span>
            <span className="ml-auto min-w-0 truncate">
              {e.outcome === 'bought' ? (
                <span className="inline-flex items-center gap-1 font-semibold text-good"><CircleCheck aria-hidden className="size-4" /> bought {money(props.price)}</span>
              ) : e.outcome === 'sold_out' ? (
                <span className="inline-flex items-center gap-1 font-semibold text-warn"><TriangleAlert aria-hidden className="size-4" /> sold out</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-bad"><CircleX aria-hidden className="size-4" /> {REASON_TEXT[e.reason ?? ''] ?? 'No thanks'}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
