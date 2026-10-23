/**
 * `firebase.ts` is committed (CI builds from it) and exports `app`, an `auth`
 * built with `initializeAuth` (never `getAuth`, which loads the cross-origin
 * redirect iframe at start-up) and `googleProvider`, with no leftover TODOs.
 * Read as text so the test never initialises Firebase.
 */
import { describe, expect, it } from 'vitest'

const text = Object.values(import.meta.glob<string>('../../firebase.ts', { query: '?raw', import: 'default', eager: true }))[0]

describe('firebase.ts', () => {
  it('exports app, auth and googleProvider', () => {
    for (const name of ['app', 'auth', 'googleProvider']) expect(text).toMatch(new RegExp(`^export const ${name}\\b`, 'm'))
  })

  it('builds auth with initializeAuth, never getAuth', () => {
    expect(text).toContain('initializeAuth(')
    expect(text).not.toMatch(/\bgetAuth\s*\(/)
  })

  it('has no leftover TODOs', () => {
    expect(text).not.toMatch(/TODO|FIXME/)
  })
})
