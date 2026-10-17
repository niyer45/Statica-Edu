// Feature: torsion-shaft-1, Property 6: Accepted iff applicable and every constraint passes
// **Validates: TSH-07, TSH-10, TSH-13, MM-11**
//
// For any valid design under any (positive) constraint limits and yield stress: the five
// constraints are reported in fixed order; failures are exactly the failed ids in that order;
// status is modelNotApplicable iff the analysis is not applicable (so such a design is never
// Accepted), otherwise accepted iff nothing failed; `accepted ⇔ status === 'accepted'`; each
// numeric constraint passes iff withinLimit(value, limit).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbTorsionDesign, torsionChallenge } from '../../../test/fixtures/torsion'
import { assertProperty } from '../../../test/pbt'
import type { TorsionChallenge } from '../../challenge/torsion/types'
import { analyzeShaft } from '../../physics/torsion/analyze'
import { withinLimit } from '../tolerance'
import { TORSION_CONSTRAINT_ORDER } from './constraints'
import { evaluateShaft } from './evaluate'

const base = torsionChallenge()
const scale = fc.double({ min: 0.05, max: 20, noNaN: true })

const arbChallenge: fc.Arbitrary<TorsionChallenge> = fc
  .tuple(scale, scale, scale, scale, scale)
  .map(([kt, ks, km, kd, ky]) => ({
    ...base,
    material: { ...base.material, yieldShearStressPa: base.material.yieldShearStressPa * ky },
    constraints: {
      maxTwistRad: base.constraints.maxTwistRad * kt,
      maxShearStressPa: base.constraints.maxShearStressPa * ks,
      maxMassKg: base.constraints.maxMassKg * km,
      maxOuterDiameterM: base.constraints.maxOuterDiameterM * kd,
    },
  }))

describe('Property 6: acceptance semantics', () => {
  it('holds for every valid design and limit set', () => {
    assertProperty(
      fc.property(arbTorsionDesign(base), arbChallenge, (d, ch) => {
        const a = analyzeShaft(d, ch)
        const e = evaluateShaft(d, a, ch)
        expect(e.constraints.map((c) => c.id)).toEqual([...TORSION_CONSTRAINT_ORDER])
        expect(e.failures).toEqual(e.constraints.filter((c) => !c.passed).map((c) => c.id))
        for (const c of e.constraints) {
          if (c.unit !== 'bool') expect(c.passed).toBe(withinLimit(c.value, c.limit))
        }
        if (!a.applicable) {
          expect(e.status).toBe('modelNotApplicable')
          expect(e.failures).toContain('applicability')
        } else {
          expect(e.status).toBe(e.failures.length === 0 ? 'accepted' : 'notAccepted')
        }
        expect(e.accepted).toBe(e.status === 'accepted')
        expect(e.accepted).toBe(a.applicable && e.constraints.every((c) => c.passed))
      }),
    )
  })
})
