import { describe, expect, it } from 'vitest'
import {
  clamp,
  dampingCoefficient,
  naturalFrequencyHz,
  relativeDisplacementPeakRatio,
  relativeDisplacementRatio,
  staticDeflection,
  transmissibility,
  transmissibilityCurve,
  transmissibilityPeakRatio,
} from './response'

// Closed-form SDOF base-excitation response (task 50.2; design "Model sdofBaseIsolation v1").

describe('response formulas', () => {
  it('compute f_n, c and δ_st from their definitions', () => {
    expect(naturalFrequencyHz(4 * Math.PI * Math.PI * 9, 1)).toBeCloseTo(3, 14)
    expect(dampingCoefficient(0.5, 4, 9)).toBe(6)
    expect(staticDeflection(2, 10, 4)).toBe(5)
  })

  it('TR and Z/Y follow the closed forms at r = 1 and r = 2', () => {
    // At resonance: TR = √(1 + 4ζ²)/(2ζ), Z/Y = 1/(2ζ).
    expect(transmissibility(1, 0.1)).toBeCloseTo(Math.sqrt(1.04) / 0.2, 13)
    expect(relativeDisplacementRatio(1, 0.1)).toBeCloseTo(5, 13)
    // r = 2, ζ = 0.25: (1 − 4)² + 1 = 10, 1 + 1 = 2.
    expect(transmissibility(2, 0.25)).toBeCloseTo(Math.sqrt(2 / 10), 15)
    expect(relativeDisplacementRatio(2, 0.25)).toBeCloseTo(4 / Math.sqrt(10), 15)
  })

  it('peak ratios: r_p = 1 and r_z = 1 undamped; r_z is unbounded for ζ² ≥ 1/2', () => {
    expect(transmissibilityPeakRatio(0)).toBe(1)
    expect(relativeDisplacementPeakRatio(0)).toBe(1)
    expect(transmissibilityPeakRatio(0.3)).toBeLessThan(1)
    expect(relativeDisplacementPeakRatio(0.3)).toBeGreaterThan(1)
    expect(relativeDisplacementPeakRatio(0.75)).toBe(Number.POSITIVE_INFINITY)
  })

  it('clamp keeps values in range and lets the upper bound win', () => {
    expect(clamp(5, 1, 3)).toBe(3)
    expect(clamp(-1, 1, 3)).toBe(1)
    expect(clamp(2, 1, 3)).toBe(2)
    expect(clamp(2, 5, 3)).toBe(3)
  })
})

describe('transmissibilityCurve', () => {
  it('samples [0, maxHz] evenly with both ends included', () => {
    const pts = transmissibilityCurve(10, 0.1, 60, 241)
    expect(pts).toHaveLength(241)
    expect(pts[0]).toEqual({ frequencyHz: 0, transmissibility: 1 })
    expect(pts[240].frequencyHz).toBe(60)
    expect(pts[40].frequencyHz).toBe(10)
    expect(pts[40].transmissibility).toBe(transmissibility(1, 0.1))
  })

  it('uses at least two samples', () => {
    expect(transmissibilityCurve(10, 0.1, 60, 1).map((p) => p.frequencyHz)).toEqual([0, 60])
    expect(transmissibilityCurve(10, 0.1, 60, 3.7).map((p) => p.frequencyHz)).toEqual([0, 30, 60])
  })
})
