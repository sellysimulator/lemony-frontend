import type { ReactElement } from 'react'
import { usePlayback } from '../../store/playback'
import { SPEEDS, revealedCount, tally } from '../../game/timeline'
import type { CustomerEvent } from '../../types/game'
import { Pause, Play, SkipForward } from 'lucide-react'
import { clockLabel, money } from '../../utils/format'

export default function Hud(props: { events: CustomerEvent[]; price: number; openMin: number; closeMin: number }): ReactElement {
  const { clock, speed, paused, end, setSpeed, togglePause, skipToEnd } = usePlayback()
  const t = tally(props.events, revealedCount(props.events, clock))
  const status = clock < props.openMin ? 'Opening soon' : clock < props.closeMin ? 'Open' : 'Closed'
  const progress = Math.min(1, Math.max(0, (clock - props.openMin) / (props.closeMin - props.openMin)))

  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-28">
          <div className="text-2xl font-extrabold tabular-nums">{clockLabel(clock)}</div>
          <div className={`text-xs font-semibold ${status === 'Open' ? 'text-good' : 'text-ink-muted'}`}>{status}</div>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
          <button type="button" onClick={togglePause} disabled={clock >= end} className="flex h-9 w-10 items-center justify-center rounded-lg border border-border font-bold disabled:opacity-30" aria-label={paused ? 'Play' : 'Pause'}>
            {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
          </button>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s && !paused}
              className={`h-9 rounded-lg px-2 text-sm font-semibold ${speed === s && !paused ? 'bg-brand text-ink' : 'border border-border text-ink-muted'}`}
            >
              {s}×
            </button>
          ))}
          <button type="button" onClick={skipToEnd} disabled={clock >= end} className="flex h-9 items-center gap-1 rounded-lg border border-border px-2 text-sm disabled:opacity-30">
            Skip <SkipForward aria-hidden className="size-4" />
          </button>
        </div>
        <div className="ml-auto grid grid-cols-4 gap-3 text-center text-sm">
          <div>
            <div className="text-xs text-ink-muted">Visitors</div>
            <div className="font-bold tabular-nums">{t.visitors}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">Bought</div>
            <div className="font-bold text-good tabular-nums">{t.buyers}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">Sold out</div>
            <div className="font-bold text-warn tabular-nums">{t.soldOut}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">Sales</div>
            <div className="font-bold tabular-nums">{money(t.buyers * props.price)}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full bg-brand-strong transition-[width]" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}
