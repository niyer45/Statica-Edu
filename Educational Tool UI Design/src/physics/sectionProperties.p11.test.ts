// Feature: engineering-intuition-mvp, Property 11: Section consistency
//
// **Validates: Requirements 8.8**
//
// Degenerate cases of the hollow/composite formulas must collapse to the simpler section:
// - tube with d = 0  ≡ circle with diameter D
// - I-section with tw = b ≡ rectangle(b, h)
// for A, Ixx, Iyy, cVertical, cHorizontal, within relative 1e-12.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbSectionOfKind, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Section } from '../geometry/sections'
import { sectionProperties, type SectionProperties } from './sectionProperties'

const REL_TOL = 1e-12
const KEYS: readonly (keyof SectionProperties)[] = ['areaM2', 'IxxM4', 'IyyM4', 'cVerticalM', 'cHorizontalM']

const limits = bundledChallenge().sectionLimits

/** Asserts every property of `a` equals `b` within relative tolerance REL_TOL. */
function expectSameProperties(a: SectionProperties, b: SectionProperties): void {
  for (const k of KEYS) {
    const scale = Math.max(Math.abs(a[k]), Math.abs(b[k]))
    expect(Math.abs(a[k] - b[k]), `${k}: ${a[k]} vs ${b[k]}`).toBeLessThanOrEqual(REL_TOL * scale)
  }
}

// Valid tubes over the challenge range, forced to d = 0 (valid: wall D/2 ≥ minWall by construction).
const arbSolidTube = arbSectionOfKind('tube', limits).map((s) => ({ ...s, innerDiameterM: 0 }))

// Valid I-sections over the challenge range, forced to tw = b (valid: tw ≤ b).
const arbFullWebI = arbSectionOfKind('iSection', limits).map((s) => ({ ...s, webThicknessM: s.widthM }))

describe('Property 11: section consistency', () => {
  it('tube with d = 0 equals circle with diameter D', () => {
    assertProperty(
      fc.property(arbSolidTube, (tube) => {
        const circle: Section = { kind: 'circle', diameterM: tube.outerDiameterM }
        expectSameProperties(sectionProperties(tube), sectionProperties(circle))
      }),
    )
  })

  it('I-section with tw = b equals rectangle(b, h)', () => {
    assertProperty(
      fc.property(arbFullWebI, (iSec) => {
        const rect: Section = { kind: 'rectangle', widthM: iSec.widthM, heightM: iSec.heightM }
        expectSameProperties(sectionProperties(iSec), sectionProperties(rect))
      }),
    )
  })
})
