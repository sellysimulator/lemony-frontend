import type { ReactElement } from 'react'
import type { DayRecord } from '../../../types/game'
import { WeatherIcon } from '../../shared/icons'

/** L6: weather and temperature for each day, above the day-axis charts. */
export default function WeatherStrip({ days }: { days: DayRecord[] }): ReactElement {
  return (
    <section aria-label="Weather by day" className="lg:col-span-2">
      <ul className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-surface-raised p-3 shadow-sm">
        {days.map((d) => (
          <li key={d.day} className="flex min-w-14 flex-1 flex-col items-center text-xs tabular-nums">
            <span className="text-ink-muted">Day {d.day}</span>
            <span role="img" aria-label={d.weather} title={d.weather} className="text-base">
              <WeatherIcon weather={d.weather} />
            </span>
            <span className="font-semibold">{d.temperature}°C</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
