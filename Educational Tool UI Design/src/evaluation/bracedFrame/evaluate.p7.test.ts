// Feature: braced-frame-1, Property 7: Accepted iff stable, applicable and every constraint passes
// **Validates: BFR-07, BFR-11, BFR-12, MM-10, MM-11**
//
// For any design (mechanisms included) under any positive limits, material yield stress and load
// factor: constraints follow the fixed order, with roofDrift and utilization present iff the frame
// solved; failures are exactly the failed ids in order; status is modelNotApplicable iff the
// analysis is not applicable (so a mechanism is never Accepted and its stability fails), otherwise
// accepted iff nothing failed; `accepted ⇔ status === 'accepted'`; numeric constraints pass iff
// withinLimit(value, limit); margins exist for drift and utilization iff solved.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracedFrameDesign, bracedFrameChallenge } from '../../../test/fixtures/bracedFrame'
import { assertProperty } from '../../../test/pbt'
import type { BracedFrameChallenge } from '../../challenge/bracedFrame/types'
import { analyzeBracedFrame } from '../../physics/bracedFrame/analyze'
import { withinLimit } from '../tolerance'
import { BRACED_FRAME_CONSTRAINT_ORDER } from './constraints'
import { evaluateBracedFrame } from './evaluate'

const base = bracedFrameChallenge()
const scale = fc.double({ min: 0.05, max: 20, noNaN: true })

const arbChallenge: fc.Arbitrary<BracedFrameChallenge> = fc
  .tuple(scale, scale, scale, fc.double({ min: 0.5, max: 2, noNaN: true }), fc.double({ min: 0.5, max: 1.5, noNaN: true }))
  .map(([kd, ku, km, ky, kl]) => ({
    ...base,
    material: { ...base.material, yieldStressPa: base.material.yieldStressPa * ky },
    loads: base.loads.map((l) => ({ ...l, fxN: l.fxN * kl, fyN: l.fyN * kl })),
    constraints: {
      maxRoofDriftM: base.constraints.maxRoofDriftM * kd,
      maxUtilization: base.constraints.maxUtilization * ku,
      maxMassKg: base.constraints.maxMassKg * km,
    },
  }))

describe('Property 7: acceptance semantics', () => {
  it('holds for every design and limit set', () => {
    assertProperty(
      fc.property(arbBracedFrameDesign(), arbChallenge, (d, ch) => {
        const a = analyzeBracedFrame(d, ch)
        const e = evaluateBracedFrame(d, a, ch)
        const solved = a.status === 'solved'
        const expectedOrder = BRACED_FRAME_CONSTRAINT_ORDER.filter((id) => solved || (id !== 'roofDrift' && id !== 'utilization'))
        expect(e.constraints.map((c) => c.id)).toEqual(expectedOrder)
        expect(e.failures).toEqual(e.constraints.filter((c) => !c.passed).map((c) => c.id))
        for (const c of e.constraints) {
          if (c.unit !== 'bool') expect(c.passed).toBe(withinLimit(c.value, c.limit))
        }
        expect(e.constraints[0].passed).toBe(solved)
        if (!a.applicable) {
          expect(e.status).toBe('modelNotApplicable')
          expect(e.failures).toContain('applicability')
        } else {
          expect(e.status).toBe(e.failures.length === 0 ? 'accepted' : 'notAccepted')
        }
        expect(e.accepted).toBe(e.status === 'accepted')
        expect(e.accepted).toBe(solved && a.applicable && e.constraints.every((c) => c.passed))
        expect(Object.keys(e.efficiency).sort()).toEqual(solved ? ['driftUsage', 'massUsage', 'maxUtilization'] : ['massUsage'])
      }),
    )
  })
})
