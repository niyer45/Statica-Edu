// Feature: engineering-intuition-mvp, Property 3: Length scaling
// **Validates: Requirements 9.6**
//
// ∀ valid design and λ ∈ [0.1, 10]: scaling the span L by λ (all else unchanged) scales tip
// deflection by λ³, nominal stress by λ, and mass by λ, each within relative 1e-12.
// Length is locked in the challenge, so the property is checked both at the beam-function level
// and through analyze() with a challenge copy whose initialDesign.lengthM is λL.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbDesign, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Challenge } from '../challenge/types'
import type { BeamDesign } from '../geometry/sections'
import { analyze } from './analyze'
import { maxMoment, nominalStress, tipDeflection } from './beam'
import { bendingProperties, sectionProperties } from './sectionProperties'

const REL = 1e-12

/** |a − b| ≤ rel · max(|a|, |b|). */
function relClose(a: number, b: number, rel: number): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b))
}

const ch = bundledChallenge()
const F = ch.load.forceN
const L = ch.initialDesign.lengthM
const E = ch.material.elasticModulusPa
const rho = ch.material.densityKgM3

const arbLambda = fc.oneof(
  fc.constant(0.5),
  fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
)

/** Challenge copy whose locked length is `lengthM`. */
function challengeWithLength(lengthM: number): Challenge {
  const copy = structuredClone(ch)
  copy.initialDesign.lengthM = lengthM
  return copy
}

/** δ, σ, m from the beam building blocks at span `span`. */
function beamMetrics(d: BeamDesign, span: number) {
  const p = sectionProperties(d.section)
  const { I, c } = bendingProperties(p, d.orientationDeg)
  return {
    delta: tipDeflection(F, span, E, I),
    sigma: nominalStress(maxMoment(F, span), c, I),
    mass: rho * p.areaM2 * span,
  }
}

function expectScaled(base: { delta: number; sigma: number; mass: number }, scaled: typeof base, lambda: number) {
  expect(relClose(scaled.delta, lambda ** 3 * base.delta, REL), 'deflection ∝ λ³').toBe(true)
  expect(relClose(scaled.sigma, lambda * base.sigma, REL), 'stress ∝ λ').toBe(true)
  expect(relClose(scaled.mass, lambda * base.mass, REL), 'mass ∝ λ').toBe(true)
}

describe('Property 3: length scaling', () => {
  it('beam functions: δ ∝ λ³, σ ∝ λ, m ∝ λ', () => {
    assertProperty(
      fc.property(arbDesign(ch), arbLambda, (d, lambda) => {
        expectScaled(beamMetrics(d, L), beamMetrics(d, lambda * L), lambda)
      }),
    )
  })

  it('analyze(): δ ∝ λ³, σ ∝ λ, m ∝ λ with a λL challenge copy', () => {
    assertProperty(
      fc.property(arbDesign(ch), arbLambda, (d, lambda) => {
        const lambdaL = lambda * L
        const a = analyze(d, ch)
        const b = analyze({ ...d, lengthM: lambdaL }, challengeWithLength(lambdaL))
        expectScaled(
          { delta: a.tipDeflectionM, sigma: a.nominalMaxStressPa, mass: a.massKg },
          { delta: b.tipDeflectionM, sigma: b.nominalMaxStressPa, mass: b.massKg },
          lambda,
        )
        // Section-only quantities are unaffected by span.
        expect(b.bendingInertiaM4).toBe(a.bendingInertiaM4)
        expect(b.areaM2).toBe(a.areaM2)
        expect(relClose(b.maxMomentNm, lambda * a.maxMomentNm, REL)).toBe(true)
      }),
    )
  })

  it('λ = ½ divides tip deflection by 8 (spec §8)', () => {
    assertProperty(
      fc.property(arbDesign(ch), (d) => {
        const a = analyze(d, ch)
        const b = analyze({ ...d, lengthM: L / 2 }, challengeWithLength(L / 2))
        expect(relClose(b.tipDeflectionM, a.tipDeflectionM / 8, REL)).toBe(true)
        expect(relClose(tipDeflection(F, L / 2, E, 1e-8), tipDeflection(F, L, E, 1e-8) / 8, REL)).toBe(true)
      }),
    )
  })
})
