// Feature: engineering-intuition-mvp, Property 6: Mass formula
// **Validates: Requirements 9.1, 9.9**
//
// ∀ valid design d: analyze(d).massKg ≈ ρ·A·L (relative 1e-12), with A the closed-form
// section area computed independently here (Req 8.1 formulas). Mass does not depend on
// orientation: the same section at 0° and 90° gives bitwise-identical massKg (Req 9.9).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbDesign, arbDesignWith, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Challenge } from '../challenge/types'
import type { BeamDesign, Orientation, Section } from '../geometry/sections'
import { analyze } from './analyze'

const REL = 1e-12

/** |a − b| ≤ rel · max(|a|, |b|). */
function relClose(a: number, b: number, rel: number): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b))
}

/** Closed-form area (Req 8.1), independent of sectionProperties.ts. */
function closedFormArea(s: Section): number {
  switch (s.kind) {
    case 'circle':
      return (Math.PI * s.diameterM ** 2) / 4
    case 'tube':
      return (Math.PI * (s.outerDiameterM ** 2 - s.innerDiameterM ** 2)) / 4
    case 'rectangle':
      return s.widthM * s.heightM
    case 'iSection':
      return 2 * s.widthM * s.flangeThicknessM + s.webThicknessM * (s.heightM - 2 * s.flangeThicknessM)
  }
}

const ch = bundledChallenge()

/** Mutable copy of the challenge with material density multiplied by k; nothing else changes. */
function withDensityScaled(base: Challenge, k: number): Challenge {
  const copy = structuredClone(base)
  copy.material.densityKgM3 = base.material.densityKgM3 * k
  return copy
}

function checkMassFormula(d: BeamDesign, c: Challenge): void {
  const expected = c.material.densityKgM3 * closedFormArea(d.section) * d.lengthM
  const got = analyze(d, c).massKg
  expect(relClose(got, expected, REL), `massKg ${got} vs ρ·A·L ${expected}`).toBe(true)
}

function withOrientation(d: BeamDesign, o: Orientation): BeamDesign {
  return { ...d, orientationDeg: o }
}

/**
 * Designs valid at both orientations: orientation affects only the envelope check, which is
 * not part of validateDesign, so swapping orientation on a valid design keeps it valid.
 */
const arbDesign0 = arbDesignWith(ch, { orientation: 0 })

describe('Property 6: mass formula', () => {
  it('massKg ≈ ρ·A·L (relative 1e-12) for every valid design', () => {
    assertProperty(fc.property(arbDesign(ch), (d) => checkMassFormula(d, ch)))
  })

  it('massKg ≈ ρ·A·L with the material density scaled by k ∈ [0.1, 10]', () => {
    const arbK = fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true })
    assertProperty(fc.property(arbDesign(ch), arbK, (d, k) => checkMassFormula(d, withDensityScaled(ch, k))))
  })

  it('massKg is bitwise identical for the same section at 0° and 90°', () => {
    assertProperty(
      fc.property(arbDesign0, (d) => {
        const m0 = analyze(withOrientation(d, 0), ch).massKg
        const m90 = analyze(withOrientation(d, 90), ch).massKg
        expect(Object.is(m0, m90), `m(0°) = ${m0}, m(90°) = ${m90}`).toBe(true)
      }),
    )
  })

  it('example: initial design mass matches ρ·A·L and is orientation independent', () => {
    checkMassFormula(ch.initialDesign, ch)
    const m0 = analyze(withOrientation(ch.initialDesign, 0), ch).massKg
    const m90 = analyze(withOrientation(ch.initialDesign, 90), ch).massKg
    expect(Object.is(m0, m90)).toBe(true)
  })
})
