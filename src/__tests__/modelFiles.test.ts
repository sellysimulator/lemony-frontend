import { describe, expect, it } from 'vitest'
import { MODEL_CREDITS } from '../components/board3d/credits'
import { MODEL_URL } from '../components/board3d/models'

/** The files in public/3dmodels, as the URLs they are served at (the glob only lists them). */
const SHIPPED = Object.keys(import.meta.glob('../../public/3dmodels/*.glb')).map((f) => f.replace('../../public', ''))
const LOADED = Object.values(MODEL_URL).slice().sort()

describe('3D model files', () => {
  it('ships every model the 3D board loads, and no other', () => {
    expect(SHIPPED.slice().sort()).toEqual(LOADED)
  })

  it('credits every one of them (CC-BY)', () => {
    expect(MODEL_CREDITS.map((c) => `/3dmodels/${c.file}`).sort()).toEqual(LOADED)
  })
})
