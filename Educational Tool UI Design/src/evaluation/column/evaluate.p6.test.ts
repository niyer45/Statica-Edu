// Feature: column-buckling-1, Property 6: Accepted iff applicable and every constraint passes
// **Validates: task 68, CBK-07, MM-10, MM-11**
//
// For any valid design under any (positive) limits and yield stress: the four constraints are
// reported in fixed order; failures are exactly the failed ids in that order; the buckling minimum
// passes iff withinLimit(limit, value) and the maxima iff withinLimit(value, limit); utilization is
// demand over capacity; status is modelNotApplicable iff the analysis is not applicable, otherwise
// accepted iff nothing failed.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbColumnDesign, columnChallenge } from '../../../test/fixtures/column'
import { assertProperty } from '../../../test/pbt'
import type { ColumnChallenge } from '../../challenge/column/types'
import { analyzeColumn } from '../../physics/column/analyze'
import { withinLimit } from '../tolerance'
import { COLUMN_CONSTRAINT_ORDER } from './constraints'
import { evaluateColumn } from './evaluate'

const base = columnChallenge()
const scale = fc.double({ min: 0.05, max: 20, noNaN: true })

const arbChallenge: fc.Arbitrary<ColumnChallenge> = fc.tuple(scale, scale, scale, scale).map(([kn, ks, km, ky]) => ({
  ...base,
  material: { ...base.material, yieldStressPa: base.material.yieldStressPa * ky },
  constraints: {
    minBucklingSafetyFactor: base.constraints.minBucklingSafetyFactor * kn,
    maxAxialStressPa: base.constraints.maxAxialStressPa * ks,
    maxMassKg: base.constraints.maxMassKg * km,
  },
}))

describe('Property 6: acceptance semantics', () => {
  it('holds for every valid design and limit set', () => {
    assertProperty(
      fc.property(arbColumnDesign(base), arbChallenge, (d, ch) => {
        const a = analyzeColumn(d, ch)
        const e = evaluateColumn(d, a, ch)
        expect(e.constraints.map((c) => c.id)).toEqual([...COLUMN_CONSTRAINT_ORDER])
        expect(e.failures).toEqual(e.constraints.filter((c) => !c.passed).map((c) => c.id))
        for (const c of e.constraints) {
          if (c.unit === 'bool') continue
          expect(c.passed).toBe(c.sense === 'min' ? withinLimit(c.limit, c.value) : withinLimit(c.value, c.limit))
          expect(c.utilization).toBeCloseTo(c.sense === 'min' ? c.limit / c.value : c.value / c.limit, 12)
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
