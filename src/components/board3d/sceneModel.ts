/**
 * Pure 3D layout: turns the playback state into world positions, sky colours
 * and light. The scene component renders what this returns and computes
 * nothing itself, so all of it is testable without WebGL.
 *
 * World: the stand sits at the origin facing +z; customers queue at
 * STAND_FRONT_Z; the street runs along x at STREET_Z.
 */
import type { ActorState } from '../../game/timeline'
import type { Weather } from '../../types/game'

export const STREET_HALF = 16
export const STREET_Z = 6
export const STAND_FRONT_Z = 2.4
const LANE_SPACING = 0.9

export interface Placement {
  x: number
  z: number
  rotY: number
  bob: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

export function actorPlacement(a: ActorState): Placement {
  const laneX = (a.lane - 1) * LANE_SPACING
  const streetZ = STREET_Z + a.lane * 0.7
  if (a.phase === 'stand') return { x: laneX, z: STAND_FRONT_Z, rotY: Math.PI, bob: 0 }
  let fromX: number, fromZ: number, toX: number, toZ: number
  if (a.phase === 'in') {
    fromX = a.side * STREET_HALF
    fromZ = streetZ
    toX = laneX
    toZ = STAND_FRONT_Z
  } else {
    fromX = laneX
    fromZ = STAND_FRONT_Z
    toX = -a.side * STREET_HALF
    toZ = streetZ
  }
  // Walk along the street first, then cut across to (or from) the stand.
  const t = a.progress
  const turn = a.phase === 'in' ? 0.7 : 0.3
  let x: number, z: number, dx: number, dz: number
  if (a.phase === 'in') {
    const cornerX = lerp(fromX, toX, 0.85)
    if (t < turn) {
      x = lerp(fromX, cornerX, t / turn)
      z = fromZ
      dx = cornerX - fromX
      dz = 0
    } else {
      x = lerp(cornerX, toX, (t - turn) / (1 - turn))
      z = lerp(fromZ, toZ, (t - turn) / (1 - turn))
      dx = toX - cornerX
      dz = toZ - fromZ
    }
  } else {
    const cornerX = lerp(fromX, toX, 0.15)
    if (t < turn) {
      x = lerp(fromX, cornerX, t / turn)
      z = lerp(fromZ, toZ, t / turn)
      dx = cornerX - fromX
      dz = toZ - fromZ
    } else {
      x = lerp(cornerX, toX, (t - turn) / (1 - turn))
      z = toZ
      dx = toX - cornerX
      dz = 0
    }
  }
  return { x, z, rotY: Math.atan2(dx, dz), bob: Math.abs(Math.sin(t * Math.PI * 10)) * 0.06 }
}

const SKY: Record<Weather, string> = {
  sunny: '#87ceeb',
  cloudy: '#a3b1c2',
  rainy: '#7b8794',
  snowy: '#d7dee8',
}

export interface Atmosphere {
  sky: string
  sunPosition: [number, number, number]
  sunIntensity: number
  ambient: number
  dusk: number
}

function mix(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16)
  const b = parseInt(hexB.slice(1), 16)
  const ch = (shift: number) => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t))
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

/** `fraction` = time of day in [0,1) (0.5 = noon). */
export function atmosphere(weather: Weather, fraction: number): Atmosphere {
  const angle = (fraction - 0.25) * 2 * Math.PI // 6am = 0 (horizon), noon = π/2
  const height = Math.sin(angle)
  const dusk = Math.min(1, Math.max(0, (0.2 - height) / 0.35))
  const overcast = weather === 'sunny' ? 1 : weather === 'cloudy' ? 0.6 : 0.45
  return {
    sky: mix(SKY[weather], '#f59e6b', dusk * 0.7),
    sunPosition: [Math.cos(angle) * 20, Math.max(1, height * 20), 8],
    sunIntensity: Math.max(0.15, height) * 2.2 * overcast,
    ambient: 0.55 + 0.25 * overcast - dusk * 0.2,
    dusk,
  }
}

/** Deterministic PRNG (mulberry32) so render stays pure. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Asphalt width and the sidewalk strip on each side of it (metres). */
export const ROAD_WIDTH = 3.2
export const SIDEWALK_WIDTH = 0.8
export const ROAD_CENTER_Z = STREET_Z + 0.7
/** z range covered by road + sidewalks; scenery must stay out of it. */
export const ROAD_BAND: [number, number] = [
  ROAD_CENTER_Z - ROAD_WIDTH / 2 - SIDEWALK_WIDTH,
  ROAD_CENTER_Z + ROAD_WIDTH / 2 + SIDEWALK_WIDTH,
]
/** Stand, its queue and the paved pad in front: kept clear of scenery. */
export const STAND_ZONE = { x: 4, zMin: -2 }

/**
 * Footprint radius at scale 1, measured from the GLBs at their TARGET_HEIGHT.
 * A grass patch is a square of blades, so this is its half-diagonal.
 */
export const GRASS_RADIUS = 3.4
export const TREE_RADIUS = 2

export interface Prop {
  x: number
  z: number
  rotY: number
  scale: number
}

const prop = (x: number, z: number, rotY: number, scale: number): Prop => ({ x, z, rotY, scale })

/** Behind the stand, around the sides, and a few across the road. */
export const TREES: Prop[] = [
  prop(-7, -5, 0.4, 1),
  prop(6.5, -6, 2.1, 1.15),
  prop(-12, -9, 1.3, 1.25),
  prop(12, -4, 4.0, 0.9),
  prop(-3, -11, 5.2, 1.1),
  prop(3.5, -14, 0.9, 1.3),
  prop(17, -10, 3.3, 1.2),
  prop(-18, -4, 2.6, 1),
  prop(-10, 13, 1.7, 1.1),
  prop(11, 14, 4.6, 1),
  prop(-20, 12.5, 0.2, 1.2),
  prop(20, 13, 3.8, 1.15),
]

export const GRASS: Prop[] = [
  prop(-8, -1.5, 0, 1),
  prop(8.5, -1.5, 1.1, 0.9),
  prop(0, -6, 2.3, 1.1),
  prop(-13, -2, 3.4, 1),
  prop(13, 0.5, 4.2, 1),
  prop(-9, -11, 5.1, 1.2),
  prop(9, -10, 0.7, 1.1),
  prop(-18, 0.8, 1.9, 0.9),
  prop(-6, 13, 2.8, 1),
  prop(6, 13.5, 3.9, 1.1),
  prop(16, 12.5, 5.6, 0.9),
]

export interface CloudSpec {
  x: number
  y: number
  z: number
  scale: number
  speed: number
}

export interface CloudCover {
  tint: string
  clouds: CloudSpec[]
}

/**
 * Clouds drift along x and wrap within ±CLOUD_SPAN. The default camera looks
 * ~21° down with only ~1° of sky above the horizon, so they sit far back and
 * low: they rise over the horizon at rest and fill the sky as you orbit down.
 */
export const CLOUD_SPAN = 60

const COVER: Record<Weather, { count: number; tint: string }> = {
  sunny: { count: 5, tint: '#ffffff' },
  cloudy: { count: 11, tint: '#e2e6ec' },
  rainy: { count: 13, tint: '#8f98a3' },
  snowy: { count: 10, tint: '#eef2f7' },
}

export function cloudCover(weather: Weather): CloudCover {
  const { count, tint } = COVER[weather]
  const rand = seeded(count * 31)
  const clouds = Array.from({ length: count }, () => ({
    x: (rand() * 2 - 1) * CLOUD_SPAN,
    y: 5 + rand() * 7,
    z: -50 - rand() * 35,
    scale: 1.5 + rand() * 1.5,
    speed: 0.25 + rand() * 0.4,
  }))
  return { tint, clouds }
}
