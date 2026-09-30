import type { ReactElement, ReactNode } from 'react'
import { Plus, Trash2, TriangleAlert } from 'lucide-react'
import type { IngredientConfig, PackOption } from '../../types/game'
import { packPrice } from '../../game/configMath'
import { money, pct } from '../../utils/format'
import { NumberField } from './fields'

const MAX_PACKS = 8
const MAX_SIZE = 10_000
const MAX_DISCOUNT_PCT = 90

/** A new row: double the biggest pack, keeping its discount, so it is a sensible next tier. */
function nextPack(packs: PackOption[]): PackOption {
  if (!packs.length) return { size: 50, discount: 0 }
  const biggest = packs.reduce((a, b) => (b.size > a.size ? b : a))
  let size = Math.min(biggest.size * 2, MAX_SIZE)
  while (packs.some((p) => p.size === size) && size > 1) size -= 1
  return { size, discount: biggest.discount }
}

/** Hints that do not block the game but usually mean a typo. The server reports the hard errors. */
function warnings(cfg: IngredientConfig): Map<number, string> {
  const out = new Map<number, string>()
  cfg.packs.forEach((p, i) => {
    if (cfg.packs.some((q, j) => j !== i && q.size === p.size)) {
      out.set(i, `There is already a pack of ${p.size}.`)
      return
    }
    const perUnit = packPrice(cfg, p) / p.size
    const smaller = cfg.packs.filter((q) => q.size < p.size && packPrice(cfg, q) / q.size < perUnit - 1e-9)
    if (smaller.length) {
      const best = smaller.reduce((a, b) => (b.discount > a.discount ? b : a))
      out.set(i, `Costs more per unit than the pack of ${best.size}, so players will rarely buy it.`)
    }
  })
  return out
}

export default function PacksEditor(props: { cfg: IngredientConfig; info?: ReactNode; onChange(packs: PackOption[]): void }): ReactElement {
  const { cfg } = props
  const hints = warnings(cfg)
  const set = (i: number, patch: Partial<PackOption>) => props.onChange(cfg.packs.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  return (
    <div role="group" aria-label="Packs on sale">
      <div className="flex min-h-7 items-center gap-1">
        <span className="text-sm font-semibold">Packs on sale</span>
        {props.info}
      </div>
      <ul className="mt-2 space-y-2">
        {cfg.packs.map((pack, i) => {
          const price = packPrice(cfg, pack)
          const hint = hints.get(i)
          return (
            <li key={i} className="rounded-lg border border-border bg-surface-sunken/40 p-3">
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <NumberField
                  compact
                  label="Pack size"
                  min={1}
                  max={MAX_SIZE}
                  value={pack.size}
                  suffix="units"
                  onChange={(v) => set(i, { size: Math.round(v) })}
                />
                <NumberField
                  compact
                  label="Discount"
                  min={0}
                  max={MAX_DISCOUNT_PCT}
                  step={1}
                  suffix="%"
                  value={Math.round(pack.discount * 1000) / 10}
                  onChange={(v) => set(i, { discount: Math.round(v * 10) / 1000 })}
                />
                <button
                  type="button"
                  aria-label={`Remove the pack of ${pack.size}`}
                  disabled={cfg.packs.length <= 1}
                  onClick={() => props.onChange(cfg.packs.filter((_, j) => j !== i))}
                  className="flex size-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-ink-muted hover:border-bad hover:text-bad disabled:opacity-40 disabled:hover:border-stone-300 disabled:hover:text-ink-muted"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-sm tabular-nums">
                <strong>{money(price)}</strong> per pack · {money(pack.size ? price / pack.size : 0)} per unit
                {pack.discount > 0 ? <span className="font-semibold text-good"> (saves {money(pack.size * cfg.unit_cost - price)}, {pct(pack.discount)} off)</span> : null}
              </p>
              {hint ? (
                <p className="mt-1 flex items-start gap-1.5 text-sm text-warn">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {hint}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        disabled={cfg.packs.length >= MAX_PACKS}
        onClick={() => props.onChange([...cfg.packs, nextPack(cfg.packs)])}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 text-sm font-semibold text-ink-muted hover:border-brand-strong hover:text-ink disabled:opacity-40"
      >
        <Plus aria-hidden className="size-4" />
        {cfg.packs.length >= MAX_PACKS ? `Up to ${MAX_PACKS} pack sizes` : 'Add pack size'}
      </button>
    </div>
  )
}
