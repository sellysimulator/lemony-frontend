import { describe, expect, it } from 'vitest'
import { actorAt } from '../game/timeline'
import { actorPlacement, atmosphere, STAND_FRONT_Z, STREET_HALF, STREET_Z } from '../components/board3d/sceneModel'
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
