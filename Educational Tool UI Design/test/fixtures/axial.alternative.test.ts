import { describe, expect, it } from 'vitest'
import { analyzeRod } from '../../src/physics/axial/analyze'
import { axialElongation, circleArea } from '../../src/physics/axial/formulas'
import { TYPICAL_MATERIALS } from '../../src/physics/axial/materials'
import { AXIAL_DERIVED, AXIAL_WORKSHEET, axialChallenge, relClose, worksheetFixture } from './axial'

// SSR-13 alternative-method and limiting checks (design.md "Alternative-method and limiting
// checks"): routes that do not reuse the closed-form elongation or area of the implementation.

const ch = axialChallenge()

describe('Stress and Strain I alternative methods (SSR-13)', () => {
  it('Castigliano: δ = ∂U/∂P with U = P²L/(2AE), by central difference, matches the analysis', () => {
    for (const f of AXIAL_WORKSHEET) {
      const a = analyzeRod(f.design, ch)
      const U = (P: number) => (P * P * ch.lengthM) / (2 * a.areaM2 * a.elasticModulusPa)
      const h = 1
      const dUdP = (U(ch.forceN + h) - U(ch.forceN - h)) / (2 * h)
      expect(relClose(dUdP, a.elongationM, 1e-9), f.name).toBe(true)
    }
  })

  it('strain energy equals the work of the load: Pδ/2 = σ²AL/(2E)', () => {
    const a = analyzeRod(worksheetFixture('baseline').design, ch)
    const work = (ch.forceN * a.elongationM) / 2
    const energy = (a.stressPa * a.stressPa * a.areaM2 * ch.lengthM) / (2 * a.elasticModulusPa)
    expect(relClose(work, AXIAL_DERIVED.baselineStrainEnergyJ)).toBe(true)
    expect(relClose(energy, AXIAL_DERIVED.baselineStrainEnergyJ)).toBe(true)
  })

  it('the inscribed regular polygon area converges to πd²/4 from below', () => {
    const d = 0.013
    const polygon = (n: number) => (n / 2) * (d / 2) ** 2 * Math.sin((2 * Math.PI) / n)
    let previous = 0
    for (const n of [8, 64, 512, 4096]) {
      const p = polygon(n)
      expect(p).toBeGreaterThan(previous)
      expect(p).toBeLessThan(circleArea(d))
      previous = p
    }
    expect(Math.abs(polygon(4096) / circleArea(d) - 1)).toBeLessThan(4e-7)
  })

  it("Hooke's law and the strain definition hold for every row: σ = Eε, δ = εL, k = P/δ", () => {
    for (const f of AXIAL_WORKSHEET) {
      const a = analyzeRod(f.design, ch)
      expect(relClose(a.elasticModulusPa * a.strain, a.stressPa, 1e-12), f.name).toBe(true)
      expect(relClose(a.strain * ch.lengthM, a.elongationM, 1e-12), f.name).toBe(true)
      expect(relClose(ch.forceN / a.elongationM, a.axialStiffnessNPerM, 1e-12), f.name).toBe(true)
    }
  })

  it('stress does not depend on the material; stretch scales with 1/E at the same diameter', () => {
    const same = ['aluminiumSameDiameter', 'titaniumSameDiameter', 'steelStrong'].map((n) => analyzeRod(worksheetFixture(n).design, ch))
    expect(new Set(same.map((a) => a.stressPa)).size).toBe(1)
    const [al, ti] = same
    expect(relClose(al!.elongationM / ti!.elongationM, ti!.elasticModulusPa / al!.elasticModulusPa, 1e-12)).toBe(true)
  })

  it('no design can fail both stretch and mass: E/ρ exceeds PL²/(δ_max m_max) for every material', () => {
    const bound = (ch.forceN * ch.lengthM ** 2) / (ch.constraints.maxElongationM * ch.constraints.maxMassKg)
    for (const m of ch.materials) expect(m.elasticModulusPa / m.densityKgM3, m.id).toBeGreaterThan(bound)
  })

  it('the challenge materials carry the shared typical textbook values', () => {
    expect(ch.materials.map((m) => [m.id, m.elasticModulusPa, m.yieldStressPa, m.densityKgM3])).toEqual(
      TYPICAL_MATERIALS.map((m) => [m.id, m.elasticModulusPa, m.yieldStressPa, m.densityKgM3]),
    )
  })

  it('elongation scales linearly with load and length', () => {
    const A = circleArea(0.013)
    const base = axialElongation(20000, 2, A, 200e9)
    expect(relClose(axialElongation(40000, 2, A, 200e9), 2 * base, 1e-15)).toBe(true)
    expect(relClose(axialElongation(20000, 4, A, 200e9), 2 * base, 1e-15)).toBe(true)
  })
})
