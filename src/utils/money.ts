/**
 * The one rounding rule for money, shared with the backend (app/core/money.py).
 *
 * Round to whole cents, halves away from zero, after trimming float noise to 12
 * significant digits: 0.125 is stored as 0.12499999999999999..., and without the
 * trim it would round down on one side and up on the other. Both sides compute
 * in the same order on IEEE doubles, so they agree to the cent.
 *
 * The shared cases in src/__tests__/fixtures/rounding_cases.json must pass on both sides.
 */
export function roundCents(value: number): number {
  const cents = Number((value * 100).toPrecision(12))
  return (Math.sign(cents) * Math.floor(Math.abs(cents) + 0.5)) / 100 + 0
}
