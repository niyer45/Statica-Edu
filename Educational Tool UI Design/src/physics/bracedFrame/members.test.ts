import { describe, expect, it } from 'vitest'
import { chsProperties, classifyForce, criticalSlenderness, eulerLoad, johnsonLoad, memberCapacity } from './members'

// Section properties and member capacity (task 49.2; BFR-10, BFR-12, BFR-14).

describe('chsProperties', () => {
  it('computes A, I and r of an annulus', () => {
    const p = chsProperties(0.1, 0.01)
    expect(p.areaM2).toBeCloseTo((Math.PI * (0.01 - 0.0064)) / 4, 15)
    expect(p.secondMomentM4).toBeCloseTo((Math.PI * (1e-4 - 0.08 ** 4)) / 64, 18)
    expect(p.radiusOfGyrationM).toBeCloseTo(Math.sqrt(p.secondMomentM4 / p.areaM2), 15)
  })
})

describe('capacity formulas', () => {
  it('Euler load, critical slenderness and Johnson load follow their definitions', () => {
    expect(eulerLoad(2, 3, 1)).toBeCloseTo(6 * Math.PI ** 2, 12)
    expect(criticalSlenderness(200e9, 250e6)).toBeCloseTo(Math.PI * Math.sqrt(1600), 12)
    // At λ = 0 the Johnson load is the squash load; at λ_c it is half of it (meets Euler tangentially).
    expect(johnsonLoad(2, 5, 0, 7)).toBe(10)
    const lc = criticalSlenderness(200e9, 250e6)
    expect(johnsonLoad(1, 250e6, lc, 200e9)).toBeCloseTo(125e6, 3)
    expect(eulerLoad(200e9, 1, lc) * 1).toBeCloseTo((Math.PI ** 2 * 200e9) / lc ** 2, 3)
  })

  it('tension and ≈ 0 members use A f_y; compression uses the lesser of A f_y and P_E', () => {
    const props = { areaM2: 1e-3, secondMomentM4: 1e-6 }
    expect(memberCapacity('tension', props, 3, 200e9, 250e6)).toEqual({ capacityN: 250000, mode: 'tensionYield' })
    expect(memberCapacity('zero', props, 3, 200e9, 250e6)).toEqual({ capacityN: 250000, mode: 'tensionYield' })
    const slender = memberCapacity('compression', props, 5, 200e9, 250e6)
    expect(slender.mode).toBe('euler')
    expect(slender.capacityN).toBeCloseTo(eulerLoad(200e9, 1e-6, 5), 6)
    // A very short member is governed by compression yield.
    expect(memberCapacity('compression', props, 0.1, 200e9, 250e6)).toEqual({ capacityN: 250000, mode: 'compressionYield' })
  })
})

describe('classifyForce (BFR-14)', () => {
  it('labels |N| ≤ 1e-9 · max|N| as ≈ 0 regardless of sign, otherwise by sign', () => {
    expect(classifyForce(1e-4, 1e5, 1e-9)).toBe('zero')
    expect(classifyForce(-1e-4, 1e5, 1e-9)).toBe('zero')
    expect(classifyForce(0, 0, 1e-9)).toBe('zero')
    expect(classifyForce(2e-4, 1e5, 1e-9)).toBe('tension')
    expect(classifyForce(-2e-4, 1e5, 1e-9)).toBe('compression')
  })
})
