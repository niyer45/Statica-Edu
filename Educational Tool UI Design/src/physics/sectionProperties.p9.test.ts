// Feature: engineering-intuition-mvp, Property 9: Cubic depth scaling
// **Validates: Requirements 8.6**
//
// For a valid rectangle (b, h) and k > 0 with (b, k·h) still valid: Ixx scales by k³, Iyy by k,
// and area and mass (m = ρ·A·L, ρ and L from the bundled challenge) by k. analyze() (task 9.2)
// does not exist yet, so mass is computed here from sectionProperties.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbSectionOfKind, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Section } from '../geometry/sections'
import { validateSection } from '../geometry/validate'
import { sectionProperties } from './sectionProperties'

const REL = 1e-12

/** |a − b| ≤ rel · max(|a|, |b|). */
function relClose(a: number, b: number, rel: number): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b))
}

const ch = bundledChallenge()
const limits = ch.sectionLimits
const L = ch.initialDesign.lengthM
const rho = ch.material.densityKgM3
const hRange = limits.rectangle.heightM

type Rect = Extract<Section, { kind: 'rectangle' }>

const massOf = (s: Rect): number => rho * sectionProperties(s).areaM2 * L

/**
 * A valid rectangle plus k ∈ [hMin/h, hMax/h], so k·h lies in the height range by construction.
 * The scaled height is clamped to the range to absorb a possible 1-ulp overshoot from k·h.
 */
const arbScaled: fc.Arbitrary<{ s: Rect; k: number; scaled: Rect }> = arbSectionOfKind('rectangle', limits).chain(
  (s) => {
    const kMin = hRange.minM / s.heightM
    const kMax = hRange.maxM / s.heightM
    return fc
      .oneof(fc.constant(1), fc.double({ min: kMin, max: kMax, noNaN: true, noDefaultInfinity: true }))
      .map((k) => {
        const h = Math.min(Math.max(k * s.heightM, hRange.minM), hRange.maxM)
        return { s, k, scaled: { kind: 'rectangle' as const, widthM: s.widthM, heightM: h } }
      })
  },
)

describe('Property 9: cubic depth scaling', () => {
  it('h → k·h (b fixed): Ixx × k³, Iyy × k, area × k, mass × k', () => {
    assertProperty(
      fc.property(arbScaled, ({ s, k, scaled }) => {
        expect(k).toBeGreaterThan(0)
        expect(validateSection(s, limits)).toEqual([])
        expect(validateSection(scaled, limits)).toEqual([])

        const p = sectionProperties(s)
        const q = sectionProperties(scaled)
        expect(relClose(q.IxxM4, k ** 3 * p.IxxM4, REL), 'Ixx').toBe(true)
        expect(relClose(q.IyyM4, k * p.IyyM4, REL), 'Iyy').toBe(true)
        expect(relClose(q.areaM2, k * p.areaM2, REL), 'area').toBe(true)
        expect(relClose(massOf(scaled), k * massOf(s), REL), 'mass').toBe(true)
      }),
    )
  })

  it('example (spec §8): doubling depth with fixed width gives Ixx × 8 and mass × 2', () => {
    const s: Rect = { kind: 'rectangle', widthM: 0.01, heightM: 0.02 }
    const deeper: Rect = { ...s, heightM: 0.04 }
    expect(validateSection(s, limits)).toEqual([])
    expect(validateSection(deeper, limits)).toEqual([])

    const p = sectionProperties(s)
    const q = sectionProperties(deeper)
    expect(relClose(q.IxxM4 / p.IxxM4, 8, REL)).toBe(true)
    expect(relClose(q.IyyM4 / p.IyyM4, 2, REL)).toBe(true)
    // Mass is reported and grows with depth; it is not ignored.
    expect(massOf(s)).toBeGreaterThan(0)
    expect(relClose(massOf(deeper) / massOf(s), 2, REL)).toBe(true)
  })
})
