import { Box, Candy, Citrus, Cloud, CloudRain, CupSoda, Snowflake, Sun, User, type LucideIcon } from 'lucide-react'
import { roundCents } from './money'
import type { IngredientName, PersonType, Weather } from '../types/game'

/** Rounded with the shared money rule first, so a displayed amount never disagrees with the server's. */
export const money = (n: number): string => {
  const cents = roundCents(n)
  return `${cents < 0 ? '−' : ''}$${Math.abs(cents).toFixed(2)}`
}

export const pct = (n: number): string => `${Math.round(n * 100)}%`

export function clockLabel(minute: number): string {
  const m = Math.max(0, Math.floor(minute))
  const h = Math.floor(m / 60) % 24
  const mm = String(m % 60).padStart(2, '0')
  const suffix = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mm} ${suffix}`
}

export const WEATHER_ICON: Record<Weather, LucideIcon> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: Snowflake,
}

/** Every customer type shares one icon; PERSON_COLOR tells them apart. */
export const PERSON_ICON: Record<PersonType, LucideIcon> = {
  Child: User,
  Teenager: User,
  Adult: User,
  Senior: User,
}

export const PERSON_COLOR = {
  Child: '#ea580c',
  Teenager: '#7c3aed',
  Adult: '#0284c7',
  Senior: '#0d9488',
} as const

export const INGREDIENT_ICON: Record<IngredientName, LucideIcon> = { ice: Box, sugar: Candy, lemons: Citrus, cups: CupSoda }

export const REASON_TEXT: Record<string, string> = {
  too_cheap: 'Too cheap — seems sketchy',
  too_pricey: 'Too pricey',
  too_much_ice: 'Too much ice',
  needs_more_ice: 'Needs more ice',
  too_sweet: 'Too sweet',
  not_sweet_enough: 'Not sweet enough',
  too_sour: 'Too sour',
  needs_more_lemon: 'Needs more lemon',
  sold_out: 'Sold out!',
}
