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
