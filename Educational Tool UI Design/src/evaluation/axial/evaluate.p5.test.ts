// Feature: stress-strain-1, Property 5: Accepted iff applicable and every check passes
// **Validates: SSR-07, SSR-10, SSR-13, MM-11**
//
// For any valid rod under any positive limits, design factor and yield strengths: the four checks
// are reported in fixed order; failures are exactly the failed ids in that order; status is
// modelNotApplicable iff the analysis is not applicable (never Accepted), otherwise accepted iff
// nothing failed; each numeric check passes iff withinLimit(value, limit); the stress limit is the
// stored yield strength divided by the design factor.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbAxialDesign, axialChallenge } from '../../../test/fixtures/axial'
import { assertProperty } from '../../../test/pbt'
import type { AxialChallenge } from '../../challenge/axial/types'
import { analyzeRod } from '../../physics/axial/analyze'
import { withinLimit } from '../tolerance'
import { AXIAL_CONSTRAINT_ORDER } from './constraints'
import { evaluateRod } from './evaluate'

const base = axialChallenge()
const scale = fc.double({ min: 0.05, max: 20, noNaN: true })

const arbChallenge: fc.Arbitrary<AxialChallenge> = fc
  .tuple(scale, scale, scale, fc.double({ min: 1, max: 5, noNaN: true }))
  .map(([kd, km, ky, n]) => ({
    ...base,
    designFactor: n,
    materials: base.materials.map((m) => ({ ...m, yieldStressPa: m.yieldStressPa * ky })),
    constraints: { maxElongationM: base.constraints.maxElongationM * kd, maxMassKg: base.constraints.maxMassKg * km },
  }))

describe('Property 5: acceptance semantics', () => {
  it('holds for every valid design and limit set', () => {
    assertProperty(fc.property(arbAxialDesign(base), arbChallenge, (d, ch) => {
      const a = analyzeRod(d, ch)
      const e = evaluateRod(d, a, ch)
      expect(e.constraints.map((c) => c.id)).toEqual([...AXIAL_CONSTRAINT_ORDER])
      expect(e.failures).toEqual(e.constraints.filter((c) => !c.passed).map((c) => c.id))
      for (const c of e.constraints) if (c.unit !== 'bool') expect(c.passed).toBe(withinLimit(c.value, c.limit))
      expect(e.constraints[0]!.limit).toBe(a.yieldStressPa / ch.designFactor)
      if (!a.applicable) {
        expect(e.status).toBe('modelNotApplicable')
        expect(e.failures).toContain('applicability')
      } else {
        expect(e.status).toBe(e.failures.length === 0 ? 'accepted' : 'notAccepted')
      }
      expect(e.accepted).toBe(e.status === 'accepted')
      expect(e.accepted).toBe(a.applicable && e.constraints.every((c) => c.passed))
    }))
  })
})
