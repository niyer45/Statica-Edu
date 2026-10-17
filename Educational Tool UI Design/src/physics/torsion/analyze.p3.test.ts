// Feature: torsion-shaft-1, Property 3: Valid shafts analyze to finite, positive, deterministic results
// **Validates: TSH-13, MM-10**
//
// For every valid design, analyzeShaft returns a deep-frozen analysis naming circularShaftTorsion v1
// with every numeric field finite and > 0, identical on repeated calls, with `applicable` true iff
// there are no not-applicable reasons, each code listed at most once, and τ_max = T(D/2)/J, φ = TL/(GJ).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbTorsionDesign, relClose, torsionChallenge } from '../../../test/fixtures/torsion'
import { assertProperty } from '../../../test/pbt'
import { analyzeShaft } from './analyze'

const ch = torsionChallenge()
const NUMERIC = ['areaM2', 'polarMomentM4', 'outerDiameterM', 'massKg', 'twistRad', 'maxShearStressPa', 'torsionalStiffnessNmPerRad'] as const

describe('Property 3: finite, positive, deterministic analysis', () => {
  it('holds for every valid design', () => {
    assertProperty(
      fc.property(arbTorsionDesign(ch), (d) => {
        const a = analyzeShaft(d, ch)
        expect(a.modelId).toBe('circularShaftTorsion')
        expect(a.modelVersion).toBe(1)
        for (const k of NUMERIC) expect(Number.isFinite(a[k]) && a[k] > 0, k).toBe(true)
        expect(Object.isFrozen(a)).toBe(true)
        expect(analyzeShaft(d, ch)).toEqual(a)
        expect(a.applicable).toBe(a.notApplicableReasons.length === 0)
        const all = [...a.warnings, ...a.notApplicableReasons].map((i) => i.code)
        expect(new Set(all).size).toBe(all.length)
        expect(relClose(a.twistRad * ch.material.shearModulusPa * a.polarMomentM4, ch.torqueNm * d.lengthM, 1e-12)).toBe(true)
        expect(relClose(a.maxShearStressPa * a.polarMomentM4, ch.torqueNm * (a.outerDiameterM / 2), 1e-12)).toBe(true)
      }),
    )
  })
})
