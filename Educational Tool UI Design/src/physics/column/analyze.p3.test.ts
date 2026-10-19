// Feature: column-buckling-1, Property 3: Column analysis is finite, positive and consistent
// **Validates: task 68, MM-03, MM-10**
//
// For every valid design, analyzeColumn returns a deep-frozen analysis naming eulerColumnBuckling
// v1 whose numeric fields are all finite and > 0, with the internal identities P_cr = n P,
// σ_E = P_cr / A, σ = P / A, λ = KL / r, r² = I / A and m = ρ A L, and applicable iff no
// not-applicable reason was raised.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbColumnDesign, columnChallenge } from '../../../test/fixtures/column'
import { assertProperty } from '../../../test/pbt'
import { analyzeColumn } from './analyze'

const ch = columnChallenge()
const rel = (a: number, b: number) => Math.abs(a / b - 1)

describe('Property 3: column analysis invariants', () => {
  it('holds for every valid design', () => {
    assertProperty(
      fc.property(arbColumnDesign(ch), (d) => {
        const a = analyzeColumn(d, ch)
        expect(a.modelId).toBe('eulerColumnBuckling')
        expect(Object.isFrozen(a)).toBe(true)
        for (const [k, v] of Object.entries(a)) if (typeof v === 'number') expect(Number.isFinite(v) && v > 0, k).toBe(true)
        expect(rel(a.bucklingSafetyFactor * ch.load.forceN, a.criticalLoadN)).toBeLessThan(1e-12)
        expect(rel(a.eulerStressPa * a.areaM2, a.criticalLoadN)).toBeLessThan(1e-12)
        expect(rel(a.axialStressPa * a.areaM2, ch.load.forceN)).toBeLessThan(1e-12)
        expect(rel(a.slenderness * a.radiusOfGyrationM, a.effectiveLengthM)).toBeLessThan(1e-12)
        expect(rel(a.radiusOfGyrationM ** 2 * a.areaM2, a.secondMomentM4)).toBeLessThan(1e-12)
        expect(rel(a.massKg, ch.material.densityKgM3 * a.areaM2 * d.lengthM)).toBeLessThan(1e-12)
        expect(a.applicable).toBe(a.notApplicableReasons.length === 0)
      }),
    )
  })
})
