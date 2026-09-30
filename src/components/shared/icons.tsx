import type { ReactElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { IngredientName, PersonType, Weather } from '../../types/game'
import { INGREDIENT_ICON, PERSON_COLOR, PERSON_ICON, WEATHER_ICON } from '../../utils/format'

/** Sized to the surrounding text so an icon can sit inline in a sentence. */
const INLINE = 'inline-block size-[1.1em] shrink-0 align-[-0.2em]'

function Glyph(props: { icon: LucideIcon; className?: string; color?: string }): ReactElement {
  const Icon = props.icon
  return <Icon aria-hidden focusable={false} strokeWidth={2.25} color={props.color} className={`${INLINE} ${props.className ?? ''}`} />
}

export function WeatherIcon(props: { weather: Weather; className?: string }): ReactElement {
  return <Glyph icon={WEATHER_ICON[props.weather]} className={props.className} />
}

export function IngredientIcon(props: { name: IngredientName; className?: string }): ReactElement {
  return <Glyph icon={INGREDIENT_ICON[props.name]} className={props.className} />
}

/** Customer types share one silhouette and are told apart by their colour. */
export function PersonIcon(props: { type: PersonType; className?: string }): ReactElement {
  return <Glyph icon={PERSON_ICON[props.type]} color={PERSON_COLOR[props.type]} className={props.className} />
}
