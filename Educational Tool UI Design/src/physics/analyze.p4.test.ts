// Feature: engineering-intuition-mvp, Property 4: Modulus scaling
// **Validates: Requirements 9.7**
//
// Doubling E with all other inputs unchanged halves tipDeflectionM (relative 1e-12) and leaves
// nominalMaxStressPa and massKg bitwise identical. Exercised through analyze() with a challenge
// copy whose material.elasticModulusPa is doubled.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbDesign, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Challenge } from '../challenge/types'
import { analyze } from './analyze'

const REL = 1e-12

/** |a − b| ≤ rel · max(|a|, |b|). */
function relClose(a: number, b: number, rel: number): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b))
}

const ch = bundledChallenge()

/** Copy of `base` with only the elastic modulus doubled. */
function withDoubledModulus(base: Challenge): Challenge {
  const copy = structuredClone(base)
  copy.material.elasticModulusPa = base.material.elasticModulusPa * 2
  return copy
}

const ch2E = withDoubledModulus(ch)

describe('Property 4: modulus scaling', () => {
  it('the challenge copy differs only in E (doubled)', () => {
    expect(ch2E.material.elasticModulusPa).toBe(2 * ch.material.elasticModulusPa)
    expect({ ...ch2E, material: { ...ch2E.material, elasticModulusPa: ch.material.elasticModulusPa } }).toEqual(ch)
  })

  it('doubling E halves δ and leaves σ and m bitwise identical', () => {
    assertProperty(
      fc.property(arbDesign(ch), (d) => {
        const a = analyze(d, ch)
        const b = analyze(d, ch2E)
        expect(relClose(b.tipDeflectionM, a.tipDeflectionM / 2, REL), 'tipDeflectionM').toBe(true)
        expect(Object.is(b.nominalMaxStressPa, a.nominalMaxStressPa), 'nominalMaxStressPa').toBe(true)
        expect(Object.is(b.massKg, a.massKg), 'massKg').toBe(true)
      }),
    )
  })
})
