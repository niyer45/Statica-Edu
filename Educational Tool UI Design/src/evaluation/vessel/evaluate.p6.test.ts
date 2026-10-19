// Feature: pressure-vessel-1, Property 6: Accepted iff applicable and every constraint passes
// **Validates: task 69, PVS-07, MM-10, MM-11**
//
// For any valid design under any (positive) limits, yield stress and design factor: the seven
// constraints are reported in fixed order; failures are exactly the failed ids in that order;
// status is modelNotApplicable iff the analysis is not applicable (so such a design is never
// Accepted), otherwise accepted iff nothing failed; `accepted ⇔ status === 'accepted'`; maxima
// pass iff withinLimit(value, limit) and the volume minimum iff withinLimit(limit, value).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVesselDesign, vesselChallenge } from '../../../test/fixtures/vessel'
import { assertProperty } from '../../../test/pbt'
import type { VesselChallenge } from '../../challenge/vessel/types'
import { analyzeVessel } from '../../physics/vessel/analyze'
import { withinLimit } from '../tolerance'
import { VESSEL_CONSTRAINT_ORDER } from './constraints'
import { evaluateVessel } from './evaluate'

const base = vesselChallenge()
const scale = fc.double({ min: 0.05, max: 20, noNaN: true })

const arbChallenge: fc.Arbitrary<VesselChallenge> = fc
  .tuple(scale, scale, scale, scale, fc.double({ min: 1, max: 5, noNaN: true }))
  .map(([kv, kl, km, ky, n]) => ({
    ...base,
    designFactor: n,
    material: { ...base.material, yieldStressPa: base.material.yieldStressPa * ky },
    constraints: {
      minVolumeM3: base.constraints.minVolumeM3 * kv,
      maxOverallLengthM: base.constraints.maxOverallLengthM * kl,
      maxMassKg: base.constraints.maxMassKg * km,
    },
  }))

describe('Property 6: vessel acceptance', () => {
  it('holds for every valid design and limit set', () => {
    assertProperty(
      fc.property(arbVesselDesign(base), arbChallenge, (d, ch) => {
        const a = analyzeVessel(d, ch)
        const e = evaluateVessel(d, a, ch)
        expect(e.constraints.map((c) => c.id)).toEqual([...VESSEL_CONSTRAINT_ORDER])
        expect(e.failures).toEqual(e.constraints.filter((c) => !c.passed).map((c) => c.id))
        expect(e.status).toBe(!a.applicable ? 'modelNotApplicable' : e.failures.length === 0 ? 'accepted' : 'notAccepted')
        expect(e.accepted).toBe(e.status === 'accepted')
        for (const c of e.constraints) {
          if (c.unit === 'bool') expect(c.passed).toBe(a.applicable)
          else if (c.bound === 'min') expect(c.passed).toBe(withinLimit(c.limit, c.value))
          else expect(c.passed).toBe(withinLimit(c.value, c.limit))
          if (c.unit !== 'bool') expect(c.passed).toBe(c.utilization <= 1 + 1e-9)
        }
      }),
    )
  })
})
