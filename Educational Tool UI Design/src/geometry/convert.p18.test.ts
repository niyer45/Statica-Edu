// Feature: engineering-intuition-mvp, Property 18: Conversion validity
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { SectionDefaults, SectionKind, SectionLimits } from '../challenge/types'
import { arbAnyKind, arbValidSection, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { convertSection } from './convert'
import { GEOM_TOL, sectionBoundingBox, type Section } from './sections'
import { validateSection } from './validate'

// Property 18 (Req 6.9, 6.11), plus the Req 6.10 default/fallback rule as interpreted in
// convert.ts's header: a default is used exactly when it lies in its Req 6.1 permissible range
// (within GEOM_TOL) for the converted outer size; otherwise the range's largest value is used
// (tube: wall = D/2, i.e. d = 0; I: tf = (h − minClearWeb)/2, tw = b).

const range = (minM: number, maxM: number) => ({ minM, maxM, stepM: 0.0005 })

const bundled = bundledChallenge()

/** Narrower limits than the bundled challenge so conversions clamp from above as well as below. */
const altLimits: SectionLimits = {
  circle: { diameterM: range(0.005, 0.05) },
  tube: { outerDiameterM: range(0.012, 0.06), minWallM: 0.002 },
  rectangle: { widthM: range(0.003, 0.12), heightM: range(0.003, 0.09) },
  iSection: {
    widthM: range(0.02, 0.08),
    heightM: range(0.015, 0.1),
    minFlangeThicknessM: 0.003,
    minWebThicknessM: 0.003,
    minClearWebHeightM: 0.003,
  },
}

/** Defaults larger than small sections allow, so the fallback branch fires often. */
const largeDefaults: SectionDefaults = {
  tubeWallM: 0.02,
  iSectionFlangeThicknessM: 0.02,
  iSectionWebThicknessM: 0.03,
}

/** Arbitrary defaults spanning below-minimum, valid, and too-large values. */
const arbDefaults: fc.Arbitrary<SectionDefaults> = fc.record({
  tubeWallM: fc.double({ min: 0.0005, max: 0.06, noNaN: true }),
  iSectionFlangeThicknessM: fc.double({ min: 0.0005, max: 0.06, noNaN: true }),
  iSectionWebThicknessM: fc.double({ min: 0.0005, max: 0.1, noNaN: true }),
})

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const inRange = (v: number, lo: number, hi: number) => v >= lo - GEOM_TOL && v <= hi + GEOM_TOL

/** Expected bounding box of the converted section (Req 6.9, with convert.ts's derived lower bounds). */
function expectedBox(s: Section, k: SectionKind, L: SectionLimits): { widthM: number; heightM: number } {
  const { widthM: b, heightM: h } = sectionBoundingBox(s)
  const size = Math.max(b, h)
  switch (k) {
    case 'circle': {
      const D = clamp(size, L.circle.diameterM.minM, L.circle.diameterM.maxM)
      return { widthM: D, heightM: D }
    }
    case 'tube': {
      const r = L.tube.outerDiameterM
      const D = clamp(size, Math.max(r.minM, 2 * L.tube.minWallM), r.maxM)
      return { widthM: D, heightM: D }
    }
    case 'rectangle':
      return {
        widthM: clamp(b, L.rectangle.widthM.minM, L.rectangle.widthM.maxM),
        heightM: clamp(h, L.rectangle.heightM.minM, L.rectangle.heightM.maxM),
      }
    case 'iSection': {
      const I = L.iSection
      return {
        widthM: clamp(b, Math.max(I.widthM.minM, I.minWebThicknessM), I.widthM.maxM),
        heightM: clamp(h, Math.max(I.heightM.minM, 2 * I.minFlangeThicknessM + I.minClearWebHeightM), I.heightM.maxM),
      }
    }
  }
}

interface Counters {
  defaultUsed: number
  fallbackUsed: number
}

/** Checks Req 6.10 for the thicknesses of `out`, counting defaults / fallbacks seen in `c`. */
function checkThicknesses(out: Section, L: SectionLimits, d: SectionDefaults, c: Counters): void {
  if (out.kind === 'tube') {
    const D = out.outerDiameterM
    if (inRange(d.tubeWallM, L.tube.minWallM, D / 2)) {
      c.defaultUsed++
      expect(out.innerDiameterM).toBe(Math.max(0, D - 2 * d.tubeWallM) + 0)
      expect(Math.abs((D - out.innerDiameterM) / 2 - Math.min(d.tubeWallM, D / 2))).toBeLessThanOrEqual(GEOM_TOL)
    } else {
      c.fallbackUsed++
      expect(out.innerDiameterM).toBe(0) // wall = D/2, the largest permissible wall
    }
  }
  if (out.kind === 'iSection') {
    const I = L.iSection
    const maxTf = (out.heightM - I.minClearWebHeightM) / 2
    if (inRange(d.iSectionFlangeThicknessM, I.minFlangeThicknessM, maxTf)) {
      c.defaultUsed++
      expect(out.flangeThicknessM).toBe(d.iSectionFlangeThicknessM)
    } else {
      c.fallbackUsed++
      expect(out.flangeThicknessM).toBe(maxTf)
    }
    if (inRange(d.iSectionWebThicknessM, I.minWebThicknessM, out.widthM)) {
      c.defaultUsed++
      expect(out.webThicknessM).toBe(d.iSectionWebThicknessM)
    } else {
      c.fallbackUsed++
      expect(out.webThicknessM).toBe(out.widthM)
    }
  }
}

function checkConversion(s: Section, k: SectionKind, L: SectionLimits, d: SectionDefaults, c: Counters): void {
  const before = structuredClone(s)
  const out = convertSection(s, k, L, d)

  expect(s).toEqual(before) // input untouched
  expect(out.kind).toBe(k)
  expect(validateSection(out, L)).toEqual([])

  if (k === s.kind) {
    expect(out).toEqual(s) // Req 6.11
    return
  }

  const box = sectionBoundingBox(out)
  const want = expectedBox(s, k, L)
  expect(Math.abs(box.widthM - want.widthM)).toBeLessThanOrEqual(GEOM_TOL)
  expect(Math.abs(box.heightM - want.heightM)).toBeLessThanOrEqual(GEOM_TOL)

  checkThicknesses(out, L, d, c)
}

/** **Validates: Requirements 6.9, 6.11** (and the 6.10 default/fallback rule) */
describe('Property 18: Conversion validity', () => {
  const cases: [string, SectionLimits, SectionDefaults][] = [
    ['bundled limits and defaults', bundled.sectionLimits, bundled.sectionDefaults],
    ['bundled limits, large defaults', bundled.sectionLimits, largeDefaults],
    ['narrow limits, large defaults', altLimits, largeDefaults],
  ]

  it.each(cases)('%s: valid, right kind, clamped bbox, same kind deep-equal', (_name, L, d) => {
    const c: Counters = { defaultUsed: 0, fallbackUsed: 0 }
    assertProperty(fc.property(arbValidSection(L), arbAnyKind, (s, k) => checkConversion(s, k, L, d, c)))
    expect(c.defaultUsed + c.fallbackUsed).toBeGreaterThan(0)
  })

  it.each([
    ['bundled limits', bundled.sectionLimits],
    ['narrow limits', altLimits],
  ] as const)('%s, arbitrary defaults: defaults used when valid, largest permissible value otherwise', (_name, L) => {
    const c: Counters = { defaultUsed: 0, fallbackUsed: 0 }
    assertProperty(
      fc.property(arbValidSection(L), arbAnyKind, arbDefaults, (s, k, d) => checkConversion(s, k, L, d, c)),
    )
    // The generators must exercise both the default and the fallback branch.
    expect(c.defaultUsed).toBeGreaterThan(0)
    expect(c.fallbackUsed).toBeGreaterThan(0)
  })

  it('same kind returns a deep-equal section', () => {
    assertProperty(
      fc.property(arbValidSection(bundled.sectionLimits), arbDefaults, (s, d) => {
        expect(convertSection(s, s.kind, bundled.sectionLimits, d)).toEqual(s)
      }),
    )
  })
})
