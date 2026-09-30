import type { CSSProperties, ReactElement } from 'react'
import { usePlayback } from '../../store/playback'
import { actorsAt, dayFraction, type ActorState } from '../../game/timeline'
import type { BoardProps } from '../day/types'
import { CircleCheck, CircleX, Citrus, CupSoda, Sun, TriangleAlert, User } from 'lucide-react'
import { PERSON_COLOR, REASON_TEXT } from '../../utils/format'
import { WeatherIcon } from '../shared/icons'
import type { Weather } from '../../types/game'

const SKY: Record<Weather, [string, string]> = {
  sunny: ['#7dd3fc', '#e0f2fe'],
  cloudy: ['#94a3b8', '#e2e8f0'],
  rainy: ['#64748b', '#cbd5e1'],
  snowy: ['#cbd5e1', '#f8fafc'],
}

const SIZE = { Child: 30, Teenager: 36, Adult: 40, Senior: 38 } as const

function Bubble(props: { actor: ActorState }): ReactElement | null {
  const { actor } = props
  if (actor.phase !== 'stand') return null
  const text = actor.outcome === 'bought' ? 'Yum!' : actor.outcome === 'sold_out' ? 'Sold out!' : (REASON_TEXT[actor.reason ?? ''] ?? 'No thanks')
  const Icon = actor.outcome === 'bought' ? CircleCheck : actor.outcome === 'sold_out' ? TriangleAlert : CircleX
  const tone = actor.outcome === 'bought' ? 'border-good text-good' : actor.outcome === 'sold_out' ? 'border-warn text-warn' : 'border-bad text-bad'
  return (
    <div className={`absolute bottom-full left-1/2 mb-1 -translate-x-1/2 flex items-center gap-1 rounded-full border-2 bg-white px-2 py-0.5 text-xs font-bold whitespace-nowrap shadow ${tone}`}>
      <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />
      {text}
    </div>
  )
}

function Actor(props: { actor: ActorState }): ReactElement {
  const { actor } = props
  const left = 50 + actor.x * 47 + (actor.phase === 'stand' ? (actor.lane - 1) * 4 : 0)
  const walking = actor.phase !== 'stand'
  const bob = walking ? Math.abs(Math.sin(actor.progress * Math.PI * 8)) * 4 : 0
  const facing = actor.phase === 'in' ? -actor.side : actor.phase === 'out' ? -actor.side : 1
  const style: CSSProperties = {
    left: `${left}%`,
    bottom: `${5 + actor.lane * 3.5 + bob}%`,
    zIndex: 10 + (2 - actor.lane),
  }
  return (
    <div className="absolute -translate-x-1/2" style={style} title={actor.type}>
      <Bubble actor={actor} />
      <div className="relative leading-none" style={{ transform: `scaleX(${facing})` }}>
        <User aria-hidden size={SIZE[actor.type]} color={PERSON_COLOR[actor.type]} strokeWidth={2.5} className="drop-shadow-[0_1px_0_#fff]" />
      </div>
      {actor.carrying ? <CupSoda aria-hidden className="absolute -right-3 bottom-1 size-4 text-yellow-800" strokeWidth={2.5} /> : null}
      <div className="mx-auto mt-0.5 h-1 w-6 rounded-full" style={{ background: PERSON_COLOR[actor.type] }} />
    </div>
  )
}

function Precipitation(props: { weather: Weather }): ReactElement | null {
  if (props.weather !== 'rainy' && props.weather !== 'snowy') return null
  const drops = Array.from({ length: 40 }, (_, i) => i)
  const snow = props.weather === 'snowy'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <style>{`@keyframes lemony-fall{from{transform:translateY(-10%)}to{transform:translateY(110%)}}`}</style>
      {drops.map((i) => (
        <span
          key={i}
          className={snow ? 'absolute h-1.5 w-1.5 rounded-full bg-white' : 'absolute h-3 w-px bg-sky-100/80'}
          style={{
            left: `${(i * 37) % 100}%`,
            top: '-10%',
            animation: `lemony-fall ${snow ? 6 + (i % 5) : 0.8 + (i % 4) * 0.2}s linear ${-(i % 7)}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

export default function Board2D(props: BoardProps): ReactElement {
  const clock = usePlayback((s) => s.clock)
  const actors = actorsAt(props.events, clock)
  const [top, bottom] = SKY[props.weather]
  const f = dayFraction(clock) // 0.375 = 9am, 0.75 = 6pm
  const sunX = Math.min(95, Math.max(5, ((f - 0.25) / 0.5) * 100))
  const sunY = 8 + Math.abs(f - 0.5) * 120
  const dusk = Math.max(0, (f - 0.7) * 3)

  return (
    <div className="relative aspect-[16/8] w-full overflow-hidden rounded-2xl border border-border shadow-inner" style={{ background: `linear-gradient(${top}, ${bottom})` }}>
      <div className="absolute transition-all" style={{ left: `${sunX}%`, top: `${sunY}%` }} aria-hidden>
        {props.weather === 'sunny' ? (
          <Sun className="size-12 fill-yellow-300 text-yellow-500" />
        ) : (
          <WeatherIcon weather={props.weather} className="size-12 text-slate-600" />
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-b from-lime-300 to-lime-500" />
      <div className="absolute inset-x-0 bottom-[4%] h-[16%] bg-stone-300" />
      <div className="absolute inset-x-0 bottom-[12%] h-0.5 border-t-2 border-dashed border-white/80" />
      <Precipitation weather={props.weather} />

      <div className="absolute bottom-[24%] left-1/2 z-[5] -translate-x-1/2 text-center" aria-label="Your lemonade stand">
        <div className="mx-auto w-40 rounded-t-lg border-4 border-yellow-600 bg-[repeating-linear-gradient(90deg,#fde047_0_16px,#fff_16px_32px)] py-1 text-sm font-extrabold text-yellow-900 shadow">
          LEMONADE {props.price.toFixed(2)}
        </div>
        <div className="mx-auto h-14 w-36 rounded-b-md border-4 border-t-0 border-yellow-700 bg-amber-200 flex items-center justify-center gap-2 text-yellow-800" aria-hidden>
          <Citrus className="size-8" strokeWidth={2.25} />
          <CupSoda className="size-8" strokeWidth={2.25} />
        </div>
      </div>

      {actors.map((a) => (
        <Actor key={a.id} actor={a} />
      ))}

      <div className="pointer-events-none absolute inset-0 bg-indigo-950 transition-opacity" style={{ opacity: Math.min(0.45, dusk) }} />
      <div className="absolute top-2 left-3 rounded-full bg-white/80 px-3 py-1 text-sm font-semibold capitalize">
        <WeatherIcon weather={props.weather} /> {props.weather} · {props.temperature}°C
      </div>
    </div>
  )
}
