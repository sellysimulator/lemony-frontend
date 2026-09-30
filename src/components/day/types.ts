import type { CustomerEvent, Weather } from '../../types/game'

/** What both boards receive. The clock comes from the playback store. */
export interface BoardProps {
  events: CustomerEvent[]
  weather: Weather
  temperature: number
  hourMin: number
  hourMax: number
  price: number
}
