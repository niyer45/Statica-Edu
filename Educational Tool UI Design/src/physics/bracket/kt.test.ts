import { describe, expect, it } from 'vitest'
import { nextUp, toleranceEdge } from '../../../test/torsionNumeric'
import { REL_TOL } from '../tolerance'
import { KT_LOWER_BRANCH } from './constants'
import { ktBranchFor, ktCoefficients, ktFitDefined, ktPolynomial, shoulderFilletKt, shoulderRatios } from './kt'

// Shoulder-fillet Kt fit (task 46.2; MBR-13). Worksheet spot values are asserted in
// test/fixtures/bracket.worksheet.test.ts and bracket.alternative.test.ts.

describe('shoulderRatios', () => {
  it('computes h, h/r, r/h, D/d and 2h/D', () => {
    expect(shoulderRatios(30, 20, 1)).toEqual({ shoulderHeightM: 5, heightToRadiusRatio: 5, radiusToHeightRatio: 0.2, stepRatio: 1.5, depthFraction: 1 / 3 })
  })
})

describe('fit range (inclusive within REL_TOL)', () => {
  const at = (heightToRadiusRatio: number, radiusToHeightRatio: number) => ktFitDefined({ heightToRadiusRatio, radiusToHeightRatio })

  it('is defined at h/r = 20 and r/h = 10 and up to the tolerance edge, undefined one double past it', () => {
    expect(at(20, 1 / 20)).toBe(true)
    expect(at(toleranceEdge(20, REL_TOL), 0.05)).toBe(true)
    expect(at(nextUp(toleranceEdge(20, REL_TOL)), 0.05)).toBe(false)
    expect(at(0.1, 10)).toBe(true)
    expect(at(0.1, toleranceEdge(10, REL_TOL))).toBe(true)
    expect(at(0.1, nextUp(toleranceEdge(10, REL_TOL)))).toBe(false)
  })

  it('is undefined for non-finite ratios (a uniform bar has r/h = ∞)', () => {
    expect(at(0, Number.POSITIVE_INFINITY)).toBe(false)
    expect(at(Number.NaN, 1)).toBe(false)
    expect(shoulderFilletKt(shoulderRatios(0.03, 0.03, 0.001))).toBeUndefined()
  })
})

describe('branch rule (K-3)', () => {
  it('uses the lower branch at h/r = 2 inclusively and the upper one past the tolerance edge', () => {
    expect(ktBranchFor(1.9999999999999996)).toBe('lower')
    expect(ktBranchFor(2)).toBe('lower')
    expect(ktBranchFor(toleranceEdge(2, REL_TOL))).toBe('lower')
    expect(ktBranchFor(nextUp(toleranceEdge(2, REL_TOL)))).toBe('upper')
    expect(ktBranchFor(0.1)).toBe('lower')
    expect(ktBranchFor(20)).toBe('upper')
  })

  it('shoulderFilletKt reports the branch it used', () => {
    expect(shoulderFilletKt(shoulderRatios(0.028, 0.024, 0.001))?.branch).toBe('lower')
    expect(shoulderFilletKt(shoulderRatios(0.03, 0.02, 0.001))?.branch).toBe('upper')
  })
})

describe('polynomial', () => {
  it('evaluates Ci = α + β√(h/r) + γ(h/r) and the cubic in 2h/D', () => {
    const [c1, c2, c3, c4] = ktCoefficients(4, KT_LOWER_BRANCH)
    expect(c1).toBeCloseTo(1.006 + 0.967 * 2 + 0.013 * 4, 14)
    expect(c4).toBeCloseTo(-0.405 + 0.249 * 2 - 0.2 * 4, 14)
    expect(ktPolynomial(4, 0.5, 'lower')).toBeCloseTo(c1 + c2 * 0.5 + c3 * 0.25 + c4 * 0.125, 14)
    // At 2h/D = 0 the polynomial reduces to C1.
    expect(ktPolynomial(4, 0, 'lower')).toBe(c1)
  })
})
