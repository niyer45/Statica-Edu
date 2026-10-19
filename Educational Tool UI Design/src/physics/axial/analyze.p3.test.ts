// Feature: stress-strain-1, Property 3: Valid rods analyze to finite, positive, deterministic results
// **Validates: SSR-13, MM-10**
//
// For every valid design, analyzeRod returns a deep-frozen analysis naming axialTieRod v1 with every
// numeric field finite and > 0, identical on repeated calls, `applicable` true iff there are no
// not-applicable reasons, each code at most once, and σ = P/A, δ = PL/(AE), σ = Eε.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbAxialDesign, axialChallenge, relClose } from '../../../test/fixtures/axial'
import { assertProperty } from '../../../test/pbt'
import { analyzeRod } from './analyze'

const ch = axialChallenge()
const NUMERIC = ['diameterM', 'areaM2', 'elasticModulusPa', 'yieldStressPa', 'stressPa', 'strain', 'elongationM', 'axialStiffnessNPerM', 'massKg', 'yieldRatio'] as const

describe('Property 3: finite, positive, deterministic analysis', () => {
  it('holds for every valid design', () => {
    assertProperty(fc.property(arbAxialDesign(ch), (d) => {
      const a = analyzeRod(d, ch)
      expect([a.modelId, a.modelVersion]).toEqual(['axialTieRod', 1])
      for (const k of NUMERIC) expect(Number.isFinite(a[k]) && a[k] > 0, k).toBe(true)
      expect(Object.isFrozen(a)).toBe(true)
      expect(analyzeRod(d, ch)).toEqual(a)
      expect(a.applicable).toBe(a.notApplicableReasons.length === 0)
      const all = [...a.warnings, ...a.notApplicableReasons].map((i) => i.code)
      expect(new Set(all).size).toBe(all.length)
      expect(relClose(a.stressPa * a.areaM2, ch.forceN, 1e-12)).toBe(true)
      expect(relClose(a.elongationM * a.areaM2 * a.elasticModulusPa, ch.forceN * ch.lengthM, 1e-12)).toBe(true)
      expect(relClose(a.elasticModulusPa * a.strain, a.stressPa, 1e-12)).toBe(true)
    }))
  })
})
