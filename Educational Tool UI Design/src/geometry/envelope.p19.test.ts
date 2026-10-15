// Feature: engineering-intuition-mvp, Property 19: Envelope swap
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbValidSection, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { orientedEnvelope } from './envelope'
import { GEOM_TOL, sectionBoundingBox, type Section } from './sections'

/** **Validates: Requirements 7.2, 7.3** */
describe('Property 19: Envelope swap', () => {
  const limits = bundledChallenge().sectionLimits

  /** The 90° envelope expressed as a function of an envelope (swap width and height). */
  const swap = (e: { widthZM: number; heightYM: number }) => ({ widthZM: e.heightYM, heightYM: e.widthZM })

  /** Expected unrotated (b, h): circle/tube use d/D for both; rectangle/I-section use width × height. */
  function expectedBH(s: Section): { b: number; h: number } {
    switch (s.kind) {
      case 'circle':
        return { b: s.diameterM, h: s.diameterM }
      case 'tube':
        return { b: s.outerDiameterM, h: s.outerDiameterM }
      case 'rectangle':
      case 'iSection':
        return { b: s.widthM, h: s.heightM }
    }
  }

  it('orientedEnvelope(s, 90) equals orientedEnvelope(s, 0) with width and height swapped', () => {
    assertProperty(
      fc.property(arbValidSection(limits), (s) => {
        const e0 = orientedEnvelope(s, 0)
        const e90 = orientedEnvelope(s, 90)
        // Exact equality is expected (pure field swap); GEOM_TOL is the spec's allowance.
        expect(e90).toEqual(swap(e0))
        expect(Math.abs(e90.widthZM - e0.heightYM)).toBeLessThanOrEqual(GEOM_TOL)
        expect(Math.abs(e90.heightYM - e0.widthZM)).toBeLessThanOrEqual(GEOM_TOL)
      }),
    )
  })

  it('maps absolutely: 0° → Z=b, Y=h; 90° → Z=h, Y=b (circle/tube b=h=d/D)', () => {
    assertProperty(
      fc.property(arbValidSection(limits), (s) => {
        const { b, h } = expectedBH(s)
        expect(sectionBoundingBox(s)).toEqual({ widthM: b, heightM: h })
        expect(orientedEnvelope(s, 0)).toEqual({ widthZM: b, heightYM: h })
        expect(orientedEnvelope(s, 90)).toEqual({ widthZM: h, heightYM: b })
      }),
    )
  })

  it('applying the 90° swap twice returns the 0° envelope', () => {
    assertProperty(
      fc.property(arbValidSection(limits), (s) => {
        const e0 = orientedEnvelope(s, 0)
        expect(swap(orientedEnvelope(s, 90))).toEqual(e0)
        expect(swap(swap(e0))).toEqual(e0)
      }),
    )
  })
})
