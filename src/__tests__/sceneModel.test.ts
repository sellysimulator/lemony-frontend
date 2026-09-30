import { describe, expect, it } from 'vitest'
import { actorAt } from '../game/timeline'
import {
  actorPlacement,
  atmosphere,
  CLOUD_SPAN,
  cloudCover,
  GRASS,
  GRASS_RADIUS,
  ROAD_BAND,
  STAND_FRONT_Z,
  STAND_ZONE,
  STREET_HALF,
  STREET_Z,
  TREE_RADIUS,
  TREES,
  type Prop,
} from '../components/board3d/sceneModel'
import type { CustomerEvent } from '../types/game'

const e: CustomerEvent = { id: 2, type: 'Child', arrive_min: 700, outcome: 'bought', reason: null, probability: 1 }

describe('sceneModel', () => {
  it('starts on the street edge, queues at the stand, leaves the other way', () => {
    const start = actorPlacement(actorAt(e, 700 - 6)!)
    expect(start.x).toBeCloseTo(-STREET_HALF)
    expect(start.z).toBeCloseTo(STREET_Z + (2 % 3) * 0.7)
    const stand = actorPlacement(actorAt(e, 701)!)
    expect(stand.z).toBe(STAND_FRONT_Z)
    expect(stand.rotY).toBeCloseTo(Math.PI)
    const end = actorPlacement(actorAt(e, 700 + 2.5 + 6)!)
    expect(end.x).toBeCloseTo(STREET_HALF)
  })

  it('noon is brighter than dusk, and sunny brighter than rainy', () => {
    expect(atmosphere('sunny', 0.5).sunIntensity).toBeGreaterThan(atmosphere('sunny', 0.74).sunIntensity)
    expect(atmosphere('sunny', 0.5).sunIntensity).toBeGreaterThan(atmosphere('rainy', 0.5).sunIntensity)
    expect(atmosphere('sunny', 0.74).dusk).toBeGreaterThan(0)
  })
})

describe('scenery layout', () => {
  const keepsClear = (p: Prop, radius: number) => {
    const r = radius * p.scale
    const offRoad = p.z + r <= ROAD_BAND[0] || p.z - r >= ROAD_BAND[1]
    const offStand = Math.abs(p.x) - r >= STAND_ZONE.x || p.z + r <= STAND_ZONE.zMin || p.z - r >= ROAD_BAND[1]
    return offRoad && offStand
  }

  it('keeps trees and grass off the road and away from the stand', () => {
    for (const t of TREES) expect(keepsClear(t, TREE_RADIUS), `tree at ${t.x},${t.z}`).toBe(true)
    for (const g of GRASS) expect(keepsClear(g, GRASS_RADIUS), `grass at ${g.x},${g.z}`).toBe(true)
  })

  it('brings more, greyer clouds as the weather turns', () => {
    expect(cloudCover('rainy').clouds.length).toBeGreaterThan(cloudCover('sunny').clouds.length)
    expect(cloudCover('sunny')).toEqual(cloudCover('sunny'))
    for (const c of cloudCover('cloudy').clouds) expect(Math.abs(c.x)).toBeLessThanOrEqual(CLOUD_SPAN)
  })
})
