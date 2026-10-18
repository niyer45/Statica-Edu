import { describe, expect, it } from 'vitest'
import bundledChallenge from '../../src/challenge/challenges/cantilever-beam-1.json'
import { bundledChallengeResult } from '../../src/challenge/content'
import type { ConstraintId } from '../../src/evaluation/types'
import { evaluate } from '../../src/evaluation/evaluate'
import type { BeamDesign, Section } from '../../src/geometry/sections'
import { analyze } from '../../src/physics/analyze'
import { bendingProperties, sectionProperties } from '../../src/physics/sectionProperties'
import { FIXTURE_REL_TOL } from './designs'

// Example test E4: hand-calculated section values (Req 8.1, 8.10), plus the still-valid
// checks from the template's deleted src/physics.test.ts re-expressed on the spec engine.
// Arithmetic is done in mm and converted (1 mm² = 1e-6 m², 1 mm⁴ = 1e-12 m⁴).

if (!bundledChallengeResult.ok) {
  throw new Error(
    `Bundled challenge failed to load: ${JSON.stringify(bundledChallengeResult.error)}`,
  )
}
const challenge = bundledChallengeResult.value

const LENGTH_M: number = bundledChallenge.initialDesign.lengthM
const MATERIAL_ID: string = bundledChallenge.initialDesign.materialId

function design(id: string, section: Section, orientationDeg: 0 | 90 = 0): BeamDesign {
  return { id, section, orientationDeg, lengthM: LENGTH_M, materialId: MATERIAL_ID }
}

function expectRel(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(FIXTURE_REL_TOL * Math.abs(expected))
}

describe('E4: hand-calculated section properties', () => {
  it('rectangle b = 20, h = 40 mm', () => {
    // A   = b·h      = 20·40          = 800 mm²       = 8.0e-4 m²
    // Ixx = b·h³/12  = 20·64 000/12   = 106 666.7 mm⁴ = 1.0667e-7 m⁴
    // Iyy = h·b³/12  = 40·8 000/12    = 26 666.7 mm⁴  = 2.6667e-8 m⁴
    const p = sectionProperties({ kind: 'rectangle', widthM: 0.02, heightM: 0.04 })
    expectRel(p.areaM2, 8e-4)
    expectRel(p.IxxM4, 1.0667e-7)
    expectRel(p.IyyM4, 2.6667e-8)
    expect(p.cVerticalM).toBeCloseTo(0.02, 12) // h/2
    expect(p.cHorizontalM).toBeCloseTo(0.01, 12) // b/2
  })

  it('solid circle D = 30 mm', () => {
    // A = π·D²/4  = π·900/4     = 706.86 mm²   = 7.0686e-4 m²
    // I = π·D⁴/64 = π·810 000/64 = 39 760.8 mm⁴ = 3.9761e-8 m⁴ (Ixx = Iyy)
    const p = sectionProperties({ kind: 'circle', diameterM: 0.03 })
    expectRel(p.areaM2, 7.0686e-4)
    expectRel(p.IxxM4, 3.9761e-8)
    expectRel(p.IyyM4, 3.9761e-8)
    expect(p.cVerticalM).toBeCloseTo(0.015, 12)
  })

  it('tube D = 40, d = 34 mm (template check: annular A and I)', () => {
    // D² − d² = 1600 − 1156             = 444 mm²
    // A       = π·444/4                 = 348.72 mm²     = 3.4872e-4 m²
    // D⁴ − d⁴ = 2 560 000 − 1 336 336   = 1 223 664 mm⁴
    // I       = π·1 223 664/64          = 60 066.6 mm⁴   = 6.0067e-8 m⁴
    const p = sectionProperties({ kind: 'tube', outerDiameterM: 0.04, innerDiameterM: 0.034 })
    expectRel(p.areaM2, (Math.PI * (0.04 ** 2 - 0.034 ** 2)) / 4)
    expectRel(p.IxxM4, (Math.PI * (0.04 ** 4 - 0.034 ** 4)) / 64)
    expectRel(p.areaM2, 3.4872e-4)
    expectRel(p.IxxM4, 6.0067e-8)
    expectRel(p.IyyM4, 6.0067e-8)
    expect(p.cVerticalM).toBeCloseTo(0.02, 12) // D/2
  })

  it('I-section b = 40, h = 60, tf = 4, tw = 3 mm', () => {
    // hw  = h − 2·tf                    = 60 − 8                          = 52 mm
    // A   = 2·b·tf + tw·hw              = 320 + 156                       = 476 mm² = 4.76e-4 m²
    // Ixx = (b·h³ − (b − tw)·hw³)/12    = (8 640 000 − 37·140 608)/12
    //                                   = (8 640 000 − 5 202 496)/12      = 286 458.7 mm⁴ = 2.8646e-7 m⁴
    // Iyy = (2·tf·b³ + hw·tw³)/12       = (2·4·64 000 + 52·27)/12
    //                                   = (512 000 + 1 404)/12            = 42 783.3 mm⁴  = 4.2783e-8 m⁴
    const p = sectionProperties({
      kind: 'iSection',
      widthM: 0.04,
      heightM: 0.06,
      flangeThicknessM: 0.004,
      webThicknessM: 0.003,
    })
    expectRel(p.areaM2, 4.76e-4)
    expectRel(p.IxxM4, 2.8646e-7)
    expectRel(p.IyyM4, 4.2783e-8)
    expect(p.cVerticalM).toBeCloseTo(0.03, 12)
    expect(p.cHorizontalM).toBeCloseTo(0.02, 12)
  })
})

describe('E4: template checks re-expressed on the spec engine', () => {
  it('rectangle 20×40 rotated 90° gives δ90/δ0 = 4 and σ90/σ0 = 2', () => {
    // δ ∝ 1/I:      δ90/δ0 = Ixx/Iyy = (h/b)²            = (40/20)²   = 4
    // σ = M·c/I:    σ90/σ0 = (b/2 / Iyy)/(h/2 / Ixx)     = (10/20)·4  = 2
    const section: Section = { kind: 'rectangle', widthM: 0.02, heightM: 0.04 }
    const a0 = analyze(design('rect0', section, 0), challenge)
    const a90 = analyze(design('rect90', section, 90), challenge)

    expect(a90.areaM2).toBe(a0.areaM2)
    expect(a90.massKg).toBe(a0.massKg)
    expectRel(a90.tipDeflectionM / a0.tipDeflectionM, 4)
    expectRel(a90.nominalMaxStressPa / a0.nominalMaxStressPa, 2)

    const p = sectionProperties(section)
    expect(bendingProperties(p, 0)).toEqual({ I: p.IxxM4, c: p.cVerticalM })
    expect(bendingProperties(p, 90)).toEqual({ I: p.IyyM4, c: p.cHorizontalM })
  })

  it('the Ø30 circle (the v1 baseline) fails deflection but passes mass and stress', () => {
    const d = design('solid30', { kind: 'circle', diameterM: 0.03 })
    const a = analyze(d, challenge)
    const e = evaluate(d, a, challenge)
    const passed = (id: ConstraintId): boolean | undefined =>
      e.constraints.find((c) => c.id === id)?.passed

    expect(passed('deflection')).toBe(false)
    expect(passed('mass')).toBe(true)
    expect(passed('stress')).toBe(true)
    expect(e.failures).toContain('deflection')
    expect(e.failures).not.toContain('mass')
    expect(e.failures).not.toContain('stress')
  })
})
