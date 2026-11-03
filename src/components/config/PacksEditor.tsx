import type { ReactElement, ReactNode } from 'react'
import { Plus, Trash2, TriangleAlert } from 'lucide-react'
import type { IngredientConfig, Limits, PackOffer, PackOption } from '../../types/game'
import { money, pct } from '../../utils/format'
import { NumberField } from './fields'

/** A 0–1 share as a percentage with at most one decimal (0.9 → 90, never 90.00000000000001). */
const toPct = (share: number) => Math.round(share * 1000) / 10

/** A new row: double the biggest pack, keeping its discount, so it is a sensible next tier. */
function nextPack(packs: PackOption[], maxSize: number): PackOption {
  if (!packs.length) return { size: 50, discount: 0 }
  const biggest = packs.reduce((a, b) => (b.size > a.size ? b : a))
  let size = Math.min(biggest.size * 2, maxSize)
  while (packs.some((p) => p.size === size) && size > 1) size -= 1
  return { size, discount: biggest.discount }
}

/**
 * The packs of one ingredient. The server's limits set how many sizes, how big and how deep a
 * discount (`limits` from GET /config/defaults); the server prices each pack and warns about one
 * dearer per unit than a smaller pack (`offers`, from POST /config/preview). `offers` is null
 * until the server has priced these settings, or while they are invalid (the screen says why).
 */
export default function PacksEditor(props: {
  cfg: IngredientConfig
  limits: Limits
  offers: PackOffer[] | null
  /** The offers are for an earlier edit; newer ones are on their way. */
  stale?: boolean
  info?: ReactNode
  onChange(packs: PackOption[]): void
}): ReactElement {
  const { cfg, limits } = props
  const maxPacks = limits.packs.max
  const offerFor = (size: number) => props.offers?.find((o) => o.size === size) ?? null
  const set = (i: number, patch: Partial<PackOption>) => props.onChange(cfg.packs.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  return (
    <div role="group" aria-label="Packs on sale">
      <div className="flex min-h-7 items-center gap-1">
        <span className="text-sm font-semibold">Packs on sale</span>
        {props.info}
      </div>
      <ul className="mt-2 space-y-2">
        {cfg.packs.map((pack, i) => {
          const offer = offerFor(pack.size)
          return (
            <li key={i} className="rounded-lg border border-border bg-surface-sunken/40 p-3">
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <NumberField
                  compact
                  label="Pack size"
                  min={limits.pack_size.min}
                  max={limits.pack_size.max}
                  value={pack.size}
                  suffix="units"
                  onChange={(v) => set(i, { size: Math.round(v) })}
                />
                <NumberField
                  compact
                  label="Discount"
                  min={toPct(limits.pack_discount.min)}
                  max={toPct(limits.pack_discount.max)}
                  step={1}
                  suffix="%"
                  value={toPct(pack.discount)}
                  onChange={(v) => set(i, { discount: Math.round(v * 10) / 1000 })}
                />
                <button
                  type="button"
                  aria-label={`Remove the pack of ${pack.size}`}
                  disabled={cfg.packs.length <= limits.packs.min}
                  onClick={() => props.onChange(cfg.packs.filter((_, j) => j !== i))}
                  className="flex size-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-ink-muted hover:border-bad hover:text-bad disabled:opacity-40 disabled:hover:border-stone-300 disabled:hover:text-ink-muted"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
              <p className={`mt-2 text-sm tabular-nums ${props.stale ? 'opacity-50' : ''}`} aria-busy={props.stale}>
                {offer ? (
                  <>
                    <strong>{money(offer.price)}</strong> per pack · {money(offer.unit_price)} per unit
                    {offer.discount > 0 ? <span className="font-semibold text-good"> (saves {money(offer.saving)}, {pct(offer.discount)} off)</span> : null}
                  </>
                ) : (
                  <span className="text-ink-muted">… per pack</span>
                )}
              </p>
              {offer?.dearer_than != null ? (
                <p className="mt-1 flex items-start gap-1.5 text-sm text-warn">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> Costs more per unit than the pack of {offer.dearer_than}, so players will rarely buy it.
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        disabled={cfg.packs.length >= maxPacks}
        onClick={() => props.onChange([...cfg.packs, nextPack(cfg.packs, limits.pack_size.max)])}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 text-sm font-semibold text-ink-muted hover:border-brand-strong hover:text-ink disabled:opacity-40"
      >
        <Plus aria-hidden className="size-4" />
        {cfg.packs.length >= maxPacks ? `Up to ${maxPacks} pack sizes` : 'Add pack size'}
      </button>
    </div>
  )
}
