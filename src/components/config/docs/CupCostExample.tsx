import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { errorMessage } from '../../../api/http'
import { getCupCost, type CupCost } from '../../../api/rest'
import type { DayPlanPayload, GameConfig } from '../../../types/game'

type Answer = { status: 'loading' } | { status: 'ok'; cost: CupCost } | { status: 'error'; message: string }

/**
 * The engine's own day-1 figures for a plan (POST /config/cup-cost): what the packs cost,
 * how many cups they make with the recipe, and the plan screen's cost per cup. The help
 * never prices a cup itself. Mounted only while its help dialog is open.
 */
export default function CupCostExample(props: {
  config: GameConfig
  purchases: DayPlanPayload['purchases']
  recipe: DayPlanPayload['recipe']
  children(cost: CupCost): ReactNode
}): ReactElement {
  const { config, purchases, recipe } = props
  const [answer, setAnswer] = useState<Answer>({ status: 'loading' })
  // The request is keyed by its content: a new object with the same values asks nothing new.
  const key = JSON.stringify([config, purchases, recipe])

  useEffect(() => {
    let live = true
    const [c, p, r] = JSON.parse(key) as [GameConfig, DayPlanPayload['purchases'], DayPlanPayload['recipe']]
    getCupCost(c, p, r)
      .then((cost) => live && setAnswer({ status: 'ok', cost }))
      .catch((err) => live && setAnswer({ status: 'error', message: errorMessage(err, 'The server could not price this example.') }))
    return () => {
      live = false
    }
  }, [key])

  if (answer.status === 'loading') return <span className="text-ink-muted">Asking the server for the cost per cup…</span>
  if (answer.status === 'error') return <span className="text-ink-muted">{answer.message}</span>
  return <>{props.children(answer.cost)}</>
}
