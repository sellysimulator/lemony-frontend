import type { ReactElement } from 'react'
import { usePlayback } from '../../store/playback'
import { cupsLeft, openingStock, revealedCount, stockAfter, tally } from '../../game/timeline'
import { INGREDIENTS, type CustomerEvent, type DayRecord } from '../../types/game'
import { IngredientIcon } from '../shared/icons'

/** Stock on hand as the day plays: opening stock less what each cup sold used. */
export default function InventoryPanel(props: { events: CustomerEvent[]; record: DayRecord }): ReactElement | null {
  const clock = usePlayback((s) => s.clock)
  const opening = openingStock(props.record)
  if (!opening) return null
  const sold = tally(props.events, revealedCount(props.events, clock)).buyers
  const stock = stockAfter(opening, props.record.recipe, sold)
  const left = cupsLeft(stock, props.record.recipe)

  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-3 shadow-sm">
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-sm font-bold">Inventory</h3>
        <span className={`ml-auto text-xs font-semibold tabular-nums ${left === 0 ? 'text-warn' : 'text-ink-muted'}`}>
          {left === 0 ? 'Sold out' : `Enough for ${left} more cup${left === 1 ? '' : 's'}`}
        </span>
      </div>
      <ul className="space-y-2">
        {INGREDIENTS.map((n) => {
          const share = opening[n] > 0 ? stock[n] / opening[n] : 0
          return (
            <li key={n} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="capitalize">
                  <IngredientIcon name={n} /> {n}
                </span>
                <span className="ml-auto font-bold tabular-nums">{stock[n]}</span>
                <span className="text-xs text-ink-subtle tabular-nums">/ {opening[n]}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <div className={`h-full transition-[width] ${share < 0.15 ? 'bg-warn' : 'bg-brand-strong'}`} style={{ width: `${share * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
