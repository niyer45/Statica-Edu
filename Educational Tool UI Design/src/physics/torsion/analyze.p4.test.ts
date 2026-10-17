// Feature: torsion-shaft-1, Property 4: Torsion scaling laws
// **Validates: TSH-13 (scaling)**
//
// φ is linear in T and L and proportional to 1/G; τ_max is independent of L and G; m is linear in
// L. Each case scales one input by k with every other input unchanged (relative 1e-12, or bitwise
// identical where the quantity does not depend on the input).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbTorsionDesign, relClose, torsionChallenge } from '../../../test/fixtures/torsion'
import { assertProperty } from '../../../test/pbt'
import type { TorsionChallenge } from '../../challenge/torsion/types'
import { analyzeShaft } from './analyze'

const ch = torsionChallenge()
const REL = 1e-12
const arbK = fc.double({ min: 0.25, max: 4, noNaN: true })

const withTorque = (k: number): TorsionChallenge => ({ ...ch, torqueNm: ch.torqueNm * k })
const withModulus = (k: number): TorsionChallenge => ({ ...ch, material: { ...ch.material, shearModulusPa: ch.material.shearModulusPa * k } })

describe('Property 4: scaling laws', () => {
  it('φ and τ are linear in T; m is independent of T', () => {
    assertProperty(
      fc.property(arbTorsionDesign(ch), arbK, (d, k) => {
        const a = analyzeShaft(d, ch)
        const b = analyzeShaft(d, withTorque(k))
        expect(relClose(b.twistRad, k * a.twistRad, REL)).toBe(true)
        expect(relClose(b.maxShearStressPa, k * a.maxShearStressPa, REL)).toBe(true)
        expect(Object.is(b.massKg, a.massKg)).toBe(true)
      }),
    )
  })

  it('φ and m are linear in L; τ is independent of L', () => {
    assertProperty(
      fc.property(arbTorsionDesign(ch), arbK, (d, k) => {
        const a = analyzeShaft(d, ch)
        const b = analyzeShaft({ ...d, lengthM: d.lengthM * k }, ch)
        expect(relClose(b.twistRad, k * a.twistRad, REL)).toBe(true)
        expect(relClose(b.massKg, k * a.massKg, REL)).toBe(true)
        expect(relClose(b.torsionalStiffnessNmPerRad, a.torsionalStiffnessNmPerRad / k, REL)).toBe(true)
        expect(Object.is(b.maxShearStressPa, a.maxShearStressPa)).toBe(true)
      }),
    )
  })

  it('φ ∝ 1/G; τ and m are independent of G', () => {
    assertProperty(
      fc.property(arbTorsionDesign(ch), arbK, (d, k) => {
        const a = analyzeShaft(d, ch)
        const b = analyzeShaft(d, withModulus(k))
        expect(relClose(b.twistRad, a.twistRad / k, REL)).toBe(true)
        expect(relClose(b.torsionalStiffnessNmPerRad, k * a.torsionalStiffnessNmPerRad, REL)).toBe(true)
        expect(Object.is(b.maxShearStressPa, a.maxShearStressPa)).toBe(true)
        expect(Object.is(b.massKg, a.massKg)).toBe(true)
      }),
    )
  })
})
