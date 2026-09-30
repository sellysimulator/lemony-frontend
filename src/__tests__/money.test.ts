/** Money rounding must match the backend exactly; both read the same cases. */
import { describe, expect, it } from 'vitest'
import { packPrice } from '../game/configMath'
import { roundCents } from '../utils/money'
import { money } from '../utils/format'

interface Cases {
  round_cents: { value: number; expected: number }[]
  pack_price: { size: number; unit_cost: number; discount: number; expected: number }[]
}

const cases = Object.values(import.meta.glob<Cases>('./fixtures/rounding_cases.json', { eager: true, import: 'default' }))[0]
// Empty when the backend repo is not checked out next to this one.
const backendCopy = Object.values(import.meta.glob<Cases>('../../../Lemony_Backend/tests/fixtures/rounding_cases.json', { eager: true, import: 'default' }))[0]

describe('money rounding', () => {
  it.each(cases.round_cents)('roundCents($value) = $expected', ({ value, expected }) => {
    expect(roundCents(value)).toBe(expected)
  })

  it.each(cases.pack_price)('pack of $size at $unit_cost, $discount off = $expected', ({ size, unit_cost, discount, expected }) => {
    const ing = { unit_cost, packs: [], fresh_days: 0, max_days: 1, never_perishes: false }
    expect(packPrice(ing, { size, discount })).toBe(expected)
  })

  it('formats with the same rule', () => {
    expect(money(0.125)).toBe('$0.13')
    expect(money(-2.675)).toBe('−$2.68')
    expect(money(-0.004)).toBe('$0.00')
  })

  it.runIf(backendCopy !== undefined)('fixture matches the backend copy', () => {
    expect(backendCopy).toEqual(cases)
  })
})
