// Feature: column-buckling-1, Property 1: The column validator is total and range-exact
// **Validates: task 68, CBK-05, MM-09**
//
// For any section values (including non-finite and out-of-range numbers) the validator never
// throws, reports at most one error per parameter, and returns no errors exactly when every
// dimension lies inside its configured range (within GEOM_TOL).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { columnChallenge } from '../../../test/fixtures/column'
import { assertProperty } from '../../../test/pbt'
import { GEOM_TOL } from '../sections'
import type { ColumnSection } from './design'
import { validateColumnSection } from './validate'

const ch = columnChallenge()
const L = ch.sectionLimits
const value = fc.oneof(fc.double({ min: -0.05, max: 0.15 }), fc.constantFrom(Number.NaN, Infinity, 0))
const inRange = (v: number, r: { minM: number; maxM: number }) => Number.isFinite(v) && v > 0 && v >= r.minM - GEOM_TOL && v <= r.maxM + GEOM_TOL

describe('Property 1: column validator', () => {
  it('is total, one error per parameter, and empty iff in range', () => {
    assertProperty(
      fc.property(fc.boolean(), value, value, (isSolid, a, b) => {
        const s: ColumnSection = isSolid ? { kind: 'solid', diameterM: a } : { kind: 'tube', outerDiameterM: a, wallThicknessM: b }
        const errors = validateColumnSection(s, L)
        expect(new Set(errors.map((e) => e.param)).size).toBe(errors.length)
        const ok = isSolid ? inRange(a, L.solid.diameterM) : inRange(a, L.tube.outerDiameterM) && inRange(b, L.tube.wallThicknessM)
        expect(errors.length === 0).toBe(ok)
      }),
    )
  })
})
