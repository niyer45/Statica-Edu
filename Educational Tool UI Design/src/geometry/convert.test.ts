import { describe, expect, it } from 'vitest'
import { bundledChallenge } from '../../test/arbitraries'
import type { SectionKind } from '../challenge/types'
import { convertSection } from './convert'
import { GEOM_TOL, sectionBoundingBox, type Section } from './sections'
import { validateSection } from './validate'

const ch = bundledChallenge()
const limits = ch.sectionLimits
const defaults = ch.sectionDefaults
const convert = (s: Section, k: SectionKind) => convertSection(s, k, limits, defaults)

const circle: Section = { kind: 'circle', diameterM: 0.03 }
const examples: Section[] = [
  circle,
  { kind: 'tube', outerDiameterM: 0.04, innerDiameterM: 0.03 },
  { kind: 'rectangle', widthM: 0.015, heightM: 0.045 },
  { kind: 'iSection', widthM: 0.04, heightM: 0.06, flangeThicknessM: 0.005, webThicknessM: 0.003 },
]
const KINDS: SectionKind[] = ['circle', 'tube', 'rectangle', 'iSection']

describe('convertSection', () => {
  it('uses the bundled challenge defaults (tube wall 4 mm, tf = tw = 4 mm)', () => {
    expect(defaults).toEqual({
      tubeWallM: 0.004,
      iSectionFlangeThicknessM: 0.004,
      iSectionWebThicknessM: 0.004,
    })
  })

  it('6.9/6.10: circle Ø30 → I-section keeps a 30×30 bounding box with default thicknesses', () => {
    const r = convert(circle, 'iSection')
    expect(r.kind).toBe('iSection')
    if (r.kind !== 'iSection') return
    expect(r.widthM).toBeCloseTo(0.03, 12)
    expect(r.heightM).toBeCloseTo(0.03, 12)
    expect(r.flangeThicknessM).toBe(0.004)
    expect(r.webThicknessM).toBe(0.004)
    expect(validateSection(r, limits)).toEqual([])
  })

  it('circle Ø30 → tube gives D 30, d 22', () => {
    const r = convert(circle, 'tube')
    expect(r.kind).toBe('tube')
    if (r.kind !== 'tube') return
    expect(r.outerDiameterM).toBeCloseTo(0.03, 12)
    expect(r.innerDiameterM).toBeCloseTo(0.022, 12)
  })

  it('circle Ø30 → rectangle gives 30×30', () => {
    expect(convert(circle, 'rectangle')).toEqual({ kind: 'rectangle', widthM: 0.03, heightM: 0.03 })
  })

  it('I-section 60×40 → circle uses max(b, h) = Ø60', () => {
    const i: Section = { kind: 'iSection', widthM: 0.04, heightM: 0.06, flangeThicknessM: 0.004, webThicknessM: 0.004 }
    expect(convert(i, 'circle')).toEqual({ kind: 'circle', diameterM: 0.06 })
    expect(convert(i, 'tube')).toEqual({ kind: 'tube', outerDiameterM: 0.06, innerDiameterM: 0.052 })
  })

  it('6.9/6.10: tiny rectangle 3×3 → I-section clamps up to the minimum size and falls back to the largest tf', () => {
    const r = convert({ kind: 'rectangle', widthM: 0.003, heightM: 0.003 }, 'iSection')
    expect(r.kind).toBe('iSection')
    if (r.kind !== 'iSection') return
    // h ≥ max(10, 2·3 + 3) = 10 mm; b ≥ max(10, 3) = 10 mm.
    expect(r.widthM).toBe(0.01)
    expect(r.heightM).toBe(0.01)
    // Default tf = 4 would leave a 2 mm web (< 3 mm), so tf = (10 − 3)/2 = 3.5 mm. tw = 4 fits.
    expect(r.flangeThicknessM).toBeCloseTo(0.0035, 12)
    expect(r.webThicknessM).toBe(0.004)
    expect(validateSection(r, limits)).toEqual([])
  })

  it('6.10: I-section web falls back to tw = b when the default web is wider than the section', () => {
    // Ø5 clamps up to b = h = 10 mm. A 12 mm default web exceeds b, so tw = b = 10 mm;
    // tf = 4 still overlaps (10 − 8 < 3), so tf = 3.5 mm.
    const r = convertSection({ kind: 'circle', diameterM: 0.005 }, 'iSection', limits, {
      ...defaults,
      iSectionWebThicknessM: 0.012,
    })
    expect(r).toEqual({
      kind: 'iSection',
      widthM: 0.01,
      heightM: 0.01,
      flangeThicknessM: expect.closeTo(0.0035, 12) as number,
      webThicknessM: 0.01,
    })
    expect(validateSection(r, limits)).toEqual([])
  })

  it('6.10: small circle → tube falls back to a solid wall when the default wall does not fit', () => {
    // Ø5 clamps up to D = 10 mm; wall 4 mm fits (≤ 5 mm), so d = 2 mm.
    expect(convert({ kind: 'circle', diameterM: 0.005 }, 'tube')).toEqual({
      kind: 'tube',
      outerDiameterM: 0.01,
      innerDiameterM: expect.closeTo(0.002, 12) as number,
    })
    // With a 6 mm default wall (> D/2), the wall falls back to D/2, i.e. d = 0.
    const r = convertSection({ kind: 'circle', diameterM: 0.005 }, 'tube', limits, { ...defaults, tubeWallM: 0.006 })
    expect(r).toEqual({ kind: 'tube', outerDiameterM: 0.01, innerDiameterM: 0 })
    expect(validateSection(r, limits)).toEqual([])
  })

  it('same kind returns a section deep-equal to the input', () => {
    for (const s of examples) expect(convert(s, s.kind)).toEqual(s)
  })

  it('does not mutate its input', () => {
    for (const s of examples) {
      const copy = structuredClone(s)
      for (const k of KINDS) convert(s, k)
      expect(s).toEqual(copy)
    }
  })

  it('every conversion pair validates and preserves the clamped bounding box', () => {
    for (const s of examples) {
      for (const k of KINDS) {
        const r = convert(s, k)
        expect(r.kind).toBe(k)
        expect(validateSection(r, limits)).toEqual([])
        if (k === s.kind) continue
        const src = sectionBoundingBox(s)
        const out = sectionBoundingBox(r)
        // Every example is within all target ranges, so no clamping applies here.
        const round = k === 'circle' || k === 'tube'
        const w = round ? Math.max(src.widthM, src.heightM) : src.widthM
        const hh = round ? w : src.heightM
        expect(Math.abs(out.widthM - w)).toBeLessThanOrEqual(GEOM_TOL)
        expect(Math.abs(out.heightM - hh)).toBeLessThanOrEqual(GEOM_TOL)
      }
    }
  })
})
