// Feature: torsion-shaft-1, Property 5: Zero-bore equivalence
// **Validates: TSH-13 (zero bore)**
//
// A tube with d = 0 equals the solid shaft of the same D for every output: all numeric fields are
// bitwise identical, and applicability (warnings, not-applicable reasons, applicable) is equal.
// The evaluation-level equivalence is asserted in evaluation/torsion (physics must not import evaluation).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { shaft, solid, torsionChallenge, tube } from '../../../test/fixtures/torsion'
import { assertProperty } from '../../../test/pbt'
import { analyzeShaft } from './analyze'

const ch = torsionChallenge()
const L = ch.sectionLimits
// Diameters valid for both kinds: the intersection of the circle and tube ranges.
const lo = Math.max(L.circle.diameterM.minM, L.tube.outerDiameterM.minM)
const hi = Math.min(L.circle.diameterM.maxM, L.tube.outerDiameterM.maxM)

describe('Property 5: zero-bore equivalence', () => {
  it('a d = 0 tube matches the solid of the same D', () => {
    assertProperty(
      fc.property(fc.double({ min: lo, max: hi, noNaN: true }), (D) => {
        const s = analyzeShaft(shaft('s', solid(D)), ch)
        const t = analyzeShaft(shaft('t', tube(D, 0)), ch)
        expect(t).toEqual(s)
        for (const k of ['areaM2', 'polarMomentM4', 'outerDiameterM', 'massKg', 'twistRad', 'maxShearStressPa', 'torsionalStiffnessNmPerRad'] as const) {
          expect(Object.is(t[k], s[k]), k).toBe(true)
        }
      }),
    )
  })
})
