import { lazy, Suspense, useEffect, useState, type ReactElement } from 'react'
import Hud from './Hud'
import DecisionFeed from './DecisionFeed'
import InventoryPanel from './InventoryPanel'
import Board2D from '../board2d/Board2D'
import LoadingSpinner from '../shared/LoadingSpinner'
import { usePlayback } from '../../store/playback'
import { useGameStore, type WatchedDay } from '../../store/gameStore'
import { dayBounds } from '../../game/timeline'
import { getBoardView, setBoardView, type BoardView } from '../../utils/storage'
import type { GameConfig } from '../../types/game'
import type { BoardProps } from './types'

const Board3D = lazy(() => import('../board3d/Board3D'))

export default function DayView(props: { watch: WatchedDay; config: GameConfig }): ReactElement {
  const { watch, config } = props
  const { min: hourMin, max: hourMax } = config.min_max_values.hour
  const bounds = dayBounds(hourMin, hourMax)
  const [view, setView] = useState<BoardView>(getBoardView)
  const ended = usePlayback((s) => s.clock >= s.end && s.end > 0)
  const setPlayView = useGameStore((s) => s.setView)

  useEffect(() => {
    usePlayback.getState().start(bounds.start, bounds.end)
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      usePlayback.getState().advance((now - last) / 1000)
      last = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // Restart only when a different day is watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch.day])

  const choose = (v: BoardView) => {
    setView(v)
    setBoardView(v)
  }

  const board: BoardProps = {
    events: watch.events,
    weather: watch.record.weather,
    temperature: watch.record.temperature,
    hourMin,
    hourMax,
    price: watch.record.price,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">Day {watch.day}</h1>
        <div className="ml-auto flex rounded-xl border border-border bg-surface-raised p-1" role="group" aria-label="Board view">
          {(['2D', '3D'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => choose(v)} className={`rounded-lg px-3 py-1 text-sm font-bold ${view === v ? 'bg-brand text-ink' : 'text-ink-muted'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <Hud events={watch.events} price={watch.record.price} openMin={bounds.open} closeMin={bounds.close} />

      {/* Width capped by the viewport height (the board is 2:1) so board, clock and controls fit on one screen. */}
      <div className="relative mx-auto max-w-[calc((100svh-15rem)*2)] min-w-[min(100%,36rem)]">
        {view === '3D' ? (
          <Suspense
            fallback={
              <div className="flex aspect-[16/8] items-center justify-center rounded-2xl border border-border bg-surface-raised">
                <LoadingSpinner label="Loading the 3D street…" />
              </div>
            }
          >
            <Board3D {...board} onFail={() => choose('2D')} />
          </Suspense>
        ) : (
          <Board2D {...board} />
        )}
        {ended ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/35 backdrop-blur-[2px]">
            <div className="rounded-2xl bg-surface-raised p-6 text-center shadow-xl">
              <p className="text-lg font-bold">The stand is closed for the day</p>
              <button type="button" onClick={() => setPlayView('report')} className="mt-4 rounded-xl bg-brand px-5 py-2 font-bold">
                See the day report
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DecisionFeed events={watch.events} price={watch.record.price} />
        <InventoryPanel events={watch.events} record={watch.record} />
      </div>
    </div>
  )
}
