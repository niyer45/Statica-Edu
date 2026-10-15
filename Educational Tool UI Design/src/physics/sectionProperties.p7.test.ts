// Feature: engineering-intuition-mvp, Property 7: Rectangle orientation swap
// **Validates: Requirements 8.4, 8.5**
//
// analyze() (task 9.2) does not exist yet, so δ, σ, and m are computed here from the physics
// building blocks with F, L, E, ρ from the bundled challenge. analyze()-level coverage of the
// orientation swap comes via Property 12/13 (task 9.x).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbSectionOfKind, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { SectionLimits } from '../challenge/types'
import type { Orientation, Section } from '../geometry/sections'
import { maxMoment, nominalStress, tipDeflection } from './beam'
import { bendingProperties, sectionProperties } from './sectionProperties'

const REL = 1e-12

/** |a − b| ≤ rel · max(|a|, |b|). */
function relClose(a: number, b: number, rel: number): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b))
}

const ch = bundledChallenge()
const limits = ch.sectionLimits
const F = ch.load.forceN
const L = ch.initialDesign.lengthM
const E = ch.material.elasticModulusPa
const rho = ch.material.densityKgM3

type Rect = Extract<Section, { kind: 'rectangle' }>

function inRange(v: number, r: { minM: number; maxM: number }): boolean {
  return v >= r.minM && v <= r.maxM
}

/** Swapped rectangle (h, b) is also within the width/height ranges. */
function swapIsValid(s: Rect, lim: SectionLimits): boolean {
  return inRange(s.heightM, lim.rectangle.widthM) && inRange(s.widthM, lim.rectangle.heightM)
}

// Width and height ranges are equal in the bundled challenge, so the filter never rejects;
// it stays as a guard if the content changes.
const arbRect = arbSectionOfKind('rectangle', limits).filter((s) => swapIsValid(s, limits))

const swap = (s: Rect): Rect => ({ kind: 'rectangle', widthM: s.heightM, heightM: s.widthM })

function analysis(s: Section, o: Orientation) {
  const p = sectionProperties(s)
  const { I, c } = bendingProperties(p, o)
  return {
    I,
    c,
    delta: tipDeflection(F, L, E, I),
    sigma: nominalStress(maxMoment(F, L), c, I),
    mass: rho * p.areaM2 * L,
  }
}

describe('Property 7: rectangle orientation swap', () => {
  it('bundled rectangle width and height ranges are equal (swap stays valid)', () => {
    expect(limits.rectangle.widthM.minM).toBe(limits.rectangle.heightM.minM)
    expect(limits.rectangle.widthM.maxM).toBe(limits.rectangle.heightM.maxM)
  })

  it('Ixx(b, h) ≈ Iyy(h, b)', () => {
    assertProperty(
      fc.property(arbRect, (s) => {
        const a = sectionProperties(s)
        const b = sectionProperties(swap(s))
        expect(relClose(a.IxxM4, b.IyyM4, REL)).toBe(true)
        expect(relClose(a.IyyM4, b.IxxM4, REL)).toBe(true)
      }),
    )
  })

  it('(b, h, 90°) matches (h, b, 0°) in I, c, δ, σ, and m', () => {
    assertProperty(
      fc.property(arbRect, (s) => {
        const rotated = analysis(s, 90)
        const swapped = analysis(swap(s), 0)
        for (const key of ['I', 'c', 'delta', 'sigma', 'mass'] as const) {
          expect(relClose(rotated[key], swapped[key], REL), key).toBe(true)
        }
      }),
    )
  })

  it('h > b ⇒ I_bend(0°) > I_bend(90°) with ratio (h/b)²', () => {
    assertProperty(
      fc.property(
        arbRect.filter((s) => s.heightM > s.widthM),
        (s) => {
          const I0 = analysis(s, 0).I
          const I90 = analysis(s, 90).I
          expect(I0).toBeGreaterThan(I90)
          expect(relClose(I0 / I90, (s.heightM / s.widthM) ** 2, REL)).toBe(true)
        },
      ),
    )
  })

  it('example: 0.01 × 0.04 rectangle is 16× stiffer upright', () => {
    const s: Rect = { kind: 'rectangle', widthM: 0.01, heightM: 0.04 }
    expect(relClose(analysis(s, 0).I / analysis(s, 90).I, 16, REL)).toBe(true)
    expect(analysis(s, 0).mass).toBe(analysis(s, 90).mass)
  })
})
