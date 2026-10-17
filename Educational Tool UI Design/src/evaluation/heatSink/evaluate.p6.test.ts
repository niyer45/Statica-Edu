// Feature: heat-sink-1, Property 6: Accepted iff applicable and every constraint passes
// **Validates: HSK-07, HSK-10, HSK-13, MM-11**
//
// For any valid design under any (positive) constraint limits: the five constraints are reported in
// fixed order; failures are exactly the failed ids in that order; status is modelNotApplicable iff
// the analysis is not applicable (so such a design is never Accepted), otherwise accepted iff
// nothing failed; `accepted ⇔ status === 'accepted'`; each upper-bound constraint passes iff
// withinLimit(value, limit) and the gap iff withinLowerLimit(value, limit).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbHeatSinkDesign, heatSinkChallenge } from '../../../test/fixtures/heatSink'
import { assertProperty } from '../../../test/pbt'
import type { HeatSinkChallenge } from '../../challenge/heatSink/types'
import { analyzeHeatSink } from '../../physics/heatSink/analyze'
import { withinLimit } from '../tolerance'
import { HEAT_SINK_CONSTRAINT_ORDER } from './constraints'
import { evaluateHeatSink } from './evaluate'
import { withinLowerLimit } from './tolerance'

const base = heatSinkChallenge()
const scale = fc.double({ min: 0.05, max: 20, noNaN: true })

const arbChallenge: fc.Arbitrary<HeatSinkChallenge> = fc.tuple(scale, scale, scale, scale).map(([kt, km, kh, kg]) => ({
  ...base,
  constraints: {
    // Scale the allowed rise, keeping the limit above ambient.
    maxBaseTemperatureK: base.ambientTemperatureK + (base.constraints.maxBaseTemperatureK - base.ambientTemperatureK) * kt,
    maxMassKg: base.constraints.maxMassKg * km,
    maxFinHeightM: base.constraints.maxFinHeightM * kh,
    minFinGapM: base.constraints.minFinGapM * kg,
  },
}))

describe('Property 6: acceptance semantics', () => {
  it('holds for every valid design and limit set', () => {
    assertProperty(
      fc.property(arbHeatSinkDesign(base), arbChallenge, (d, ch) => {
        const a = analyzeHeatSink(d, ch)
        const e = evaluateHeatSink(d, a, ch)
        expect(e.constraints.map((c) => c.id)).toEqual([...HEAT_SINK_CONSTRAINT_ORDER])
        expect(e.failures).toEqual(e.constraints.filter((c) => !c.passed).map((c) => c.id))
        for (const c of e.constraints) {
          if (c.unit === 'bool') continue
          expect(c.passed).toBe(c.bound === 'lower' ? withinLowerLimit(c.value, c.limit) : withinLimit(c.value, c.limit))
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
