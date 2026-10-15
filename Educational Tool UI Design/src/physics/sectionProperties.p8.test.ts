// Feature: engineering-intuition-mvp, Property 8: Axisymmetric invariance
//
// **Validates: Requirements 8.3**
//
// For circle and tube sections, Ixx = Iyy, and the bending analysis (I_bend, c, δ, σ, m)
// is identical for orientations 0° and 90°. analyze() is not implemented yet (task 9.2), so
// the analysis is composed from sectionProperties/bendingProperties and the beam formulas,
// using F, L, E, ρ from the bundled challenge.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbSectionOfKind, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Orientation, Section } from '../geometry/sections'
import { maxMoment, nominalStress, tipDeflection } from './beam'
import { bendingProperties, sectionProperties } from './sectionProperties'

const ch = bundledChallenge()
const F = ch.load.forceN
const L = ch.initialDesign.lengthM
const E = ch.material.elasticModulusPa
const rho = ch.material.densityKgM3

function analysis(s: Section, o: Orientation) {
  const p = sectionProperties(s)
  const { I, c } = bendingProperties(p, o)
  return {
    I,
    c,
    deflectionM: tipDeflection(F, L, E, I),
    stressPa: nominalStress(maxMoment(F, L), c, I),
    massKg: rho * p.areaM2 * L,
  }
}

describe('Property 8: Axisymmetric invariance', () => {
  for (const kind of ['circle', 'tube'] as const) {
    it(`${kind}: Ixx = Iyy and the analysis is identical at 0° and 90°`, () => {
      assertProperty(
        fc.property(arbSectionOfKind(kind, ch.sectionLimits), (s) => {
          const p = sectionProperties(s)
          expect(Math.abs(p.IxxM4 - p.IyyM4)).toBeLessThanOrEqual(1e-12 * Math.max(p.IxxM4, p.IyyM4))
          expect(p.IxxM4).toBe(p.IyyM4)
          expect(analysis(s, 90)).toStrictEqual(analysis(s, 0))
        }),
      )
    })
  }
})
