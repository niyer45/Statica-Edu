// Feature: vibration-isolation-1, Property 6: Accepted iff applicable and every constraint passes
// **Validates: VIB-07, VIB-10, VIB-13, MM-11**
//
// For any valid design under any (positive) constraint limits and mount stroke: the five
// constraints are reported in fixed order; failures are exactly the failed ids in that order;
// status is modelNotApplicable iff the analysis is not applicable (so such a design is never
// Accepted), otherwise accepted iff nothing failed; `accepted ⇔ status === 'accepted'`; each
// numeric constraint passes iff withinLimit(value, limit).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVibrationDesign, vibrationChallenge } from '../../../test/fixtures/vibration'
import { assertProperty } from '../../../test/pbt'
import type { VibrationChallenge } from '../../challenge/vibration/types'
import { analyzeIsolator } from '../../physics/vibration/analyze'
import { withinLimit } from '../tolerance'
import { VIBRATION_CONSTRAINT_ORDER } from './constraints'
import { evaluateIsolator } from './evaluate'

const base = vibrationChallenge()
const scale = fc.double({ min: 0.05, max: 20, noNaN: true })

const arbChallenge: fc.Arbitrary<VibrationChallenge> = fc
  .tuple(scale, scale, scale, scale, scale)
  .map(([kt, ks, kp, kz, kstroke]) => ({
    ...base,
    mount: { linearStrokeM: base.mount.linearStrokeM * kstroke },
    constraints: {
      maxWorstInBandTransmissibility: base.constraints.maxWorstInBandTransmissibility * kt,
      maxStaticDeflectionM: base.constraints.maxStaticDeflectionM * ks,
      maxPeakTransmissibility: base.constraints.maxPeakTransmissibility * kp,
      maxRelativeDisplacementM: base.constraints.maxRelativeDisplacementM * kz,
    },
  }))

describe('Property 6: acceptance semantics', () => {
  it('holds for every valid design and limit set', () => {
    assertProperty(
      fc.property(arbVibrationDesign(base), arbChallenge, (d, ch) => {
        const a = analyzeIsolator(d, ch)
        const e = evaluateIsolator(d, a, ch)
        expect(e.constraints.map((c) => c.id)).toEqual([...VIBRATION_CONSTRAINT_ORDER])
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
