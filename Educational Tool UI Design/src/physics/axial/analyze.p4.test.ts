// Feature: stress-strain-1, Property 4: Axial scaling laws
// **Validates: SSR-13 (scaling)**
//
// For any valid rod and scale factors: elongation is linear in load and length and inversely
// proportional to E; stress does not depend on E or L and scales with the load; mass is linear in
// length and density; doubling the diameter quarters the stress and the elongation.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbAxialDesign, axialChallenge, relClose } from '../../../test/fixtures/axial'
import { assertProperty } from '../../../test/pbt'
import type { AxialChallenge } from '../../challenge/axial/types'
import { analyzeRod } from './analyze'

const base = axialChallenge()
const k = fc.double({ min: 0.1, max: 10, noNaN: true })

function scaled(kP: number, kL: number, kE: number, kRho: number): AxialChallenge {
  return {
    ...base,
    forceN: base.forceN * kP,
    lengthM: base.lengthM * kL,
    materials: base.materials.map((m) => ({ ...m, elasticModulusPa: m.elasticModulusPa * kE, densityKgM3: m.densityKgM3 * kRho })),
  }
}

describe('Property 4: scaling laws', () => {
  it('holds for load, length, modulus and density', () => {
    assertProperty(fc.property(arbAxialDesign(base), k, k, k, k, (d, kP, kL, kE, kRho) => {
      const a = analyzeRod(d, base)
      const b = analyzeRod(d, scaled(kP, kL, kE, kRho))
      expect(relClose(b.elongationM, (a.elongationM * kP * kL) / kE, 1e-12)).toBe(true)
      expect(relClose(b.stressPa, a.stressPa * kP, 1e-12)).toBe(true)
      expect(relClose(b.massKg, a.massKg * kL * kRho, 1e-12)).toBe(true)
      expect(relClose(b.strain, (a.strain * kP) / kE, 1e-12)).toBe(true)
    }))
  })

  it('doubling the diameter quarters the stress and the elongation', () => {
    const r = base.diameterLimits
    assertProperty(fc.property(fc.double({ min: r.minM, max: r.maxM / 2, noNaN: true }), fc.constantFrom(...base.materials.map((m) => m.id)), (dm, m) => {
      const a = analyzeRod({ id: 'a', diameterM: dm, materialId: m }, base)
      const b = analyzeRod({ id: 'b', diameterM: 2 * dm, materialId: m }, base)
      expect(relClose(b.stressPa, a.stressPa / 4, 1e-12)).toBe(true)
      expect(relClose(b.elongationM, a.elongationM / 4, 1e-12)).toBe(true)
      expect(relClose(b.massKg, a.massKg * 4, 1e-12)).toBe(true)
    }))
  })
})
