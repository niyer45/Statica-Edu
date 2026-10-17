// Feature: mounting-bracket-1, Property 6: Accepted iff applicable and every constraint passes
// **Validates: MBR-08, MBR-14, MBR-17, MM-10, MM-11**
//
// For any valid design under any (positive) constraint limits and yield stress: the five
// constraints are reported in fixed order; failures are exactly the failed ids in that order;
// status is modelNotApplicable iff the analysis is not applicable (so such a design is never
// Accepted), otherwise accepted iff nothing failed; `accepted ⇔ status === 'accepted'`; each
// numeric constraint with a value passes iff withinLimit(value, limit); peakStress has no value
// exactly when the peak stress is absent, and then fails with status modelNotApplicable.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracketDesign, bracketChallenge } from '../../../test/fixtures/bracket'
import { assertProperty } from '../../../test/pbt'
import type { BracketChallenge } from '../../challenge/bracket/types'
import { analyzeBracket } from '../../physics/bracket/analyze'
import { withinLimit } from '../tolerance'
import { BRACKET_CONSTRAINT_ORDER } from './constraints'
import { evaluateBracket } from './evaluate'

const base = bracketChallenge()
const scale = fc.double({ min: 0.05, max: 20, noNaN: true })

const arbChallenge: fc.Arbitrary<BracketChallenge> = fc
  .tuple(scale, scale, scale, scale, scale)
  .map(([ks, kd, km, ke, ky]) => ({
    ...base,
    material: { ...base.material, yieldStressPa: base.material.yieldStressPa * ky },
    constraints: {
      maxPeakStressPa: base.constraints.maxPeakStressPa * ks,
      maxTipDeflectionM: base.constraints.maxTipDeflectionM * kd,
      maxMassKg: base.constraints.maxMassKg * km,
      maxEnvelopeDepthM: base.constraints.maxEnvelopeDepthM * ke,
    },
  }))

describe('Property 6: acceptance semantics', () => {
  it('holds for every valid design and limit set', () => {
    assertProperty(
      fc.property(arbBracketDesign(base), arbChallenge, (d, ch) => {
        const a = analyzeBracket(d, ch)
        const e = evaluateBracket(d, a, ch)
        expect(e.constraints.map((c) => c.id)).toEqual([...BRACKET_CONSTRAINT_ORDER])
        expect(e.failures).toEqual(e.constraints.filter((c) => !c.passed).map((c) => c.id))
        for (const c of e.constraints) {
          if (c.unit !== 'bool' && c.value !== undefined) expect(c.passed).toBe(withinLimit(c.value, c.limit))
        }
        const peak = e.constraints[0]
        expect('value' in peak).toBe(a.peakStressPa !== undefined)
        if (a.peakStressPa === undefined) {
          expect(peak.passed).toBe(false)
          expect(e.status).toBe('modelNotApplicable')
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
