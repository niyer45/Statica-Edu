// Feature: fatigue-analysis-1, Property 6: Accepted iff applicable and every check passes
// **Validates: task 70, FAT-09, MM-11**
//
// For any valid design under any positive limits: five constraints in fixed order with the right
// bounds; failures are exactly the failed ids in order; modelNotApplicable iff not applicable;
// otherwise accepted iff nothing failed; lower bounds pass iff withinLowerLimit and upper bounds iff
// withinLimit; utilization > 1 exactly for a failed numeric check.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbFatigueDesign, fatigueChallenge } from '../../../test/fixtures/fatigue'
import { assertProperty } from '../../../test/pbt'
import type { FatigueChallenge } from '../../challenge/fatigue/types'
import { analyzeFatigue } from '../../physics/fatigue/analyze'
import { withinLowerLimit } from '../heatSink/tolerance'
import { withinLimit } from '../tolerance'
import { FATIGUE_CONSTRAINT_ORDER } from './constraints'
import { evaluateFatigue } from './evaluate'

const base = fatigueChallenge()
const scale = fc.double({ min: 0.2, max: 5, noNaN: true })
const arbChallenge: fc.Arbitrary<FatigueChallenge> = fc.tuple(scale, scale, scale, scale).map(([kf, ky, km, ks]) => ({
  ...base,
  constraints: {
    minFatigueSafetyFactor: base.constraints.minFatigueSafetyFactor * kf,
    minYieldSafetyFactor: base.constraints.minYieldSafetyFactor * ky,
    maxMassKg: base.constraints.maxMassKg * km,
    minShoulderFaceM: base.constraints.minShoulderFaceM * ks,
  },
}))

describe('Property 6: acceptance', () => {
  it('holds for any design and limits', () => {
    assertProperty(
      fc.property(arbFatigueDesign(base), arbChallenge, (d, ch) => {
        const a = analyzeFatigue(d, ch)
        const e = evaluateFatigue(d, a, ch)
        expect(e.constraints.map((c) => c.id)).toEqual(FATIGUE_CONSTRAINT_ORDER)
        expect(e.failures).toEqual(e.constraints.filter((c) => !c.passed).map((c) => c.id))
        expect(e.status === 'modelNotApplicable').toBe(!a.applicable)
        if (a.applicable) expect(e.status === 'accepted').toBe(e.failures.length === 0)
        expect(e.accepted).toBe(e.status === 'accepted')
        for (const c of e.constraints) {
          if (c.unit === 'bool') continue
          expect(c.passed).toBe(c.bound === 'lower' ? withinLowerLimit(c.value, c.limit) : withinLimit(c.value, c.limit))
          if (Math.abs(c.utilization - 1) > 1e-6) expect(c.utilization > 1).toBe(!c.passed)
        }
        expect(e.constraints.map((c) => c.bound)).toEqual(['lower', 'lower', 'upper', 'lower', 'upper'])
        expect(Object.isFrozen(e)).toBe(true)
      }),
    )
  })
})
