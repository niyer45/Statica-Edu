// Feature: heat-sink-1, Property 8: withinLowerLimit is the exact mirror of withinLimit
// **Validates: HSK-07, HSK-10**
//
// For any doubles (finite, infinite or NaN) and any tolerance, withinLowerLimit(v, l, tol) equals
// withinLimit(−v, −l, tol): the lower bound has the same REL_TOL slack and non-finite rule as the
// shared upper bound. The FIN_GAP screen in physics/heatSink/applicability.ts uses the right-hand
// form, so the gap constraint and the gap screen compare identically. It is monotone in `value`
// and always passes at the limit.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { assertProperty } from '../../../test/pbt'
import { withinLimit } from '../tolerance'
import { withinLowerLimit } from './tolerance'

const anyDouble = fc.oneof(fc.double(), fc.double({ min: -1, max: 1 }), fc.double({ min: 1e-4, max: 1e-2, noNaN: true }))
const tol = fc.oneof(fc.constant(1e-9), fc.double({ min: 0, max: 0.1, noNaN: true }))

describe('Property 8: lower-bound tolerance mirror', () => {
  it('equals withinLimit on negated arguments', () => {
    assertProperty(
      fc.property(anyDouble, anyDouble, tol, (v, l, t) => {
        expect(withinLowerLimit(v, l, t)).toBe(withinLimit(-v, -l, t))
      }),
    )
  })

  it('values near a positive limit agree at the default tolerance', () => {
    assertProperty(
      fc.property(fc.double({ min: 1e-4, max: 1e-2, noNaN: true }), fc.double({ min: -1e-8, max: 1e-8, noNaN: true }), (l, rel) => {
        const v = l * (1 + rel)
        expect(withinLowerLimit(v, l)).toBe(withinLimit(-v, -l))
      }),
    )
  })

  it('is monotone in value and passes at the limit', () => {
    assertProperty(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), fc.double({ noNaN: true, noDefaultInfinity: true }), fc.double({ noNaN: true, noDefaultInfinity: true }), (a, b, l) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        if (withinLowerLimit(lo, l)) expect(withinLowerLimit(hi, l)).toBe(true)
        expect(withinLowerLimit(l, l)).toBe(true)
      }),
    )
  })
})
