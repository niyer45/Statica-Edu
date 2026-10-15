// Feature: engineering-intuition-mvp, Property 10: Containment bounds
// **Validates: Requirements 8.7**
//
// An I-section fits inside its b × h bounding rectangle, and a tube inside its outer circle,
// so neither can exceed the bounding shape's area or second moment.
//
// Floating-point notes:
// - Non-strict bounds. Ixx = (b·h³ − (b − tw)·hw³)/12 and the tube formulas only subtract a
//   non-negative term from the same expression the bound uses, and IEEE rounding is monotone,
//   so those `≤` checks are exact. The I-section area 2·b·tf + tw·hw is a sum of separately
//   rounded products, so at tw = b it can land a few ulps above b·h; it gets a 4·ε relative
//   allowance.
// - Strict bounds only hold when the removed material is representable against the total.
//   tw = b·(1 − 1e-16) or d = 1e-200 rounds the removed term to nothing, so strictness is
//   checked only when the gap is meaningful: b − tw > 1e-9·b for the I-section, and
//   d²/D² > 1e-9 (area) / d⁴/D⁴ > 1e-9 (inertia) for the tube. Below those gaps the
//   non-strict bound is still asserted.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbSectionOfKind, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { sectionProperties } from './sectionProperties'

const limits = bundledChallenge().sectionLimits

/** Relative gap below which strictness is not expected to survive rounding. */
const MEANINGFUL_GAP = 1e-9
const AREA_SUM_TOL = 4 * Number.EPSILON

describe('Property 10: Containment bounds', () => {
  it('I-section: A ≤ b·h and Ixx ≤ b·h³/12, strictly when tw is meaningfully below b', () => {
    let strictCases = 0
    assertProperty(
      fc.property(arbSectionOfKind('iSection', limits), (s) => {
        const { widthM: b, heightM: h, webThicknessM: tw } = s
        const p = sectionProperties(s)
        const boxArea = b * h
        const boxI = (b * h ** 3) / 12

        expect(p.areaM2).toBeLessThanOrEqual(boxArea * (1 + AREA_SUM_TOL))
        expect(p.IxxM4).toBeLessThanOrEqual(boxI)

        if (b - tw > MEANINGFUL_GAP * b) {
          strictCases++
          expect(p.areaM2).toBeLessThan(boxArea)
          expect(p.IxxM4).toBeLessThan(boxI)
        }
      }),
    )
    // Guard against a generator change silently skipping the strict branch.
    expect(strictCases).toBeGreaterThan(0)
  })

  it('tube with d > 0: A < πD²/4 and Ixx, Iyy < πD⁴/64 (strict when d is meaningful)', () => {
    let strictCases = 0
    assertProperty(
      fc.property(
        arbSectionOfKind('tube', limits).filter((s) => s.innerDiameterM > 0),
        (s) => {
          const { outerDiameterM: D, innerDiameterM: d } = s
          const p = sectionProperties(s)
          const circleArea = (Math.PI * D ** 2) / 4
          const circleI = (Math.PI * D ** 4) / 64

          expect(p.areaM2).toBeLessThanOrEqual(circleArea)
          expect(p.IxxM4).toBeLessThanOrEqual(circleI)
          expect(p.IyyM4).toBeLessThanOrEqual(circleI)

          const ratio = d / D
          if (ratio ** 2 > MEANINGFUL_GAP) expect(p.areaM2).toBeLessThan(circleArea)
          if (ratio ** 4 > MEANINGFUL_GAP) {
            strictCases++
            expect(p.IxxM4).toBeLessThan(circleI)
            expect(p.IyyM4).toBeLessThan(circleI)
          }
        },
      ),
    )
    expect(strictCases).toBeGreaterThan(0)
  })

  it('tube with d = 0 equals the solid-circle bound exactly', () => {
    assertProperty(
      fc.property(arbSectionOfKind('tube', limits), (t) => {
        const s = { ...t, innerDiameterM: 0 }
        const D = s.outerDiameterM
        const p = sectionProperties(s)
        const circle = sectionProperties({ kind: 'circle', diameterM: D })
        expect(p.areaM2).toBe((Math.PI * D ** 2) / 4)
        expect(p.IxxM4).toBe((Math.PI * D ** 4) / 64)
        expect(p.IyyM4).toBe(p.IxxM4)
        expect(p.areaM2).toBe(circle.areaM2)
        expect(p.IxxM4).toBe(circle.IxxM4)
      }),
    )
  })

  it('reference I-section (h 60, b 40, tf 4, tw 3 mm) is strictly inside its box', () => {
    const p = sectionProperties({
      kind: 'iSection',
      widthM: 0.04,
      heightM: 0.06,
      flangeThicknessM: 0.004,
      webThicknessM: 0.003,
    })
    expect(p.areaM2).toBeLessThan(0.04 * 0.06)
    expect(p.IxxM4).toBeLessThan((0.04 * 0.06 ** 3) / 12)
  })
})
