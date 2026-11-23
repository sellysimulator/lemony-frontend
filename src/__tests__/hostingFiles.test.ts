/**
 * What Firebase Hosting serves around the app: the page title and description, and the
 * headers (hashed assets cached for good, the page and SPA routes always revalidated, and
 * the two safe-everywhere security headers; no frame or CSP header, which could break the
 * Firebase Auth handler on the same site).
 */
import { describe, expect, it } from 'vitest'
import firebaseJson from '../../firebase.json?raw'
import indexHtml from '../../index.html?raw'

interface HeaderRule {
  source?: string
  regex?: string
  headers: { key: string; value: string }[]
}

const rules: HeaderRule[] = JSON.parse(firebaseJson).hosting.headers
const headersOf = (match: (r: HeaderRule) => boolean) => Object.fromEntries(rules.filter(match).flatMap((r) => r.headers.map((h) => [h.key, h.value])))

describe('hosting', () => {
  it('caches hashed assets and models for good, and revalidates the page and every route', () => {
    expect(headersOf((r) => r.source === '/assets/**')['Cache-Control']).toBe('public, max-age=31536000, immutable')
    expect(headersOf((r) => r.source === '/3dmodels/**')['Cache-Control']).toBe('public, max-age=31536000, immutable')
    expect(headersOf((r) => r.source === '/index.html')['Cache-Control']).toBe('no-cache')
    expect(headersOf((r) => r.regex === '^/[^.]*$')['Cache-Control']).toBe('no-cache')
  })

  it('sends the safe security headers everywhere, and no frame or CSP header', () => {
    const all = headersOf((r) => r.source === '**')
    expect(all).toEqual({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' })
    const keys = rules.flatMap((r) => r.headers.map((h) => h.key))
    expect(keys).not.toContain('X-Frame-Options')
    expect(keys).not.toContain('Content-Security-Policy')
  })

  it('names the game in the title and describes it', () => {
    expect(indexHtml).toContain('<title>Lemonade Game</title>')
    expect(indexHtml).toMatch(/<meta name="description" content="[^"]+" \/>/)
  })
})
