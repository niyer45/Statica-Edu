// Feature: mounting-bracket-1, Property 5: Uniform-bar limit
// **Validates: MBR-12, MBR-17 (b)**
//
// A uniform bar (d = D) equals the cantilever rectangle formulas FL³/(3EI), 6FL/(bh²) and ρbhL
// (relative 1e-12, test-side formulas), peaks at the root with no step keys, and is bitwise
// independent of the step location and fillet radius.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { bracket, bracketChallenge, relClose } from '../../../test/fixtures/bracket'
import { assertProperty } from '../../../test/pbt'
import { analyzeBracket } from './analyze'

const ch = bracketChallenge()
const L = ch.designLimits
const range = (r: { minM: number; maxM: number }) => fc.double({ min: r.minM, max: r.maxM, noNaN: true })

describe('Property 5: uniform-bar limit', () => {
  it('matches the rectangle formulas and ignores a and r', () => {
    assertProperty(
      fc.property(range({ minM: L.rootDepthM.minM, maxM: L.rootDepthM.maxM }), range(L.stepLocationM), range(L.filletRadiusM), range(L.stepLocationM), range(L.filletRadiusM), (h, a1, r1, a2, r2) => {
        const F = ch.load.forceN
        const b = ch.thicknessM
        const len = ch.lengthM
        const I = (b * h ** 3) / 12
        const x = analyzeBracket(bracket('u', h, h, a1, r1), ch)
        expect(relClose(x.tipDeflectionM, (F * len ** 3) / (3 * ch.material.elasticModulusPa * I), 1e-12)).toBe(true)
        expect(relClose(x.rootStressPa, (6 * F * len) / (b * h ** 2), 1e-12)).toBe(true)
        expect(relClose(x.massKg, ch.material.densityKgM3 * b * h * len, 1e-12)).toBe(true)
        expect(x.peakStressPa).toBe(x.rootStressPa)
        expect(x.peakLocation).toBe('root')
        expect('ktStep' in x || 'stepNominalStressPa' in x).toBe(false)
        expect(analyzeBracket(bracket('u', h, h, a2, r2), ch)).toEqual(x)
      }),
    )
  })
})
