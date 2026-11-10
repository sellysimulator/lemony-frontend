import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: null }))
const { errorMessage } = await import('../api/http')

const reply = (status: number, headers: Record<string, string> = {}, detail: unknown = 'Server wording') => ({ response: { status, headers, data: { detail } } })

describe('errorMessage and the backend abuse limits', () => {
  it('429 names the wait from Retry-After', () => {
    expect(errorMessage(reply(429, { 'retry-after': '60' }), 'fallback')).toBe(
      'Too many requests from your network. Please wait about 60 seconds and try again.',
    )
  })

  it('429 without a readable Retry-After omits the number', () => {
    const expected = 'Too many requests from your network. Please wait a moment and try again.'
    expect(errorMessage(reply(429), 'fallback')).toBe(expected)
    expect(errorMessage(reply(429, { 'retry-after': 'soon' }), 'fallback')).toBe(expected)
  })

  it('413 and 503 get their own words, whatever the body says', () => {
    expect(errorMessage(reply(413), 'fallback')).toBe('That request was too large.')
    expect(errorMessage(reply(503), 'fallback')).toBe('The server is busy right now — please try again in a minute.')
  })

  it('other statuses still show the server detail, or the fallback', () => {
    expect(errorMessage(reply(400), 'fallback')).toBe('Server wording')
    expect(errorMessage(reply(422, {}, [{ msg: 'a' }, { msg: 'b' }]), 'fallback')).toBe('a; b')
    expect(errorMessage(new Error('Network Error'), 'fallback')).toBe('fallback')
  })
})
