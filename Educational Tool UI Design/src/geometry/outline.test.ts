import { describe, expect, it } from 'vitest'
import { sectionOutline } from './outline'
import { sectionBoundingBox, type Section, type Vec2 } from './sections'

const circle: Section = { kind: 'circle', diameterM: 0.05 }
const tube: Section = { kind: 'tube', outerDiameterM: 0.06, innerDiameterM: 0.04 }
const solidTube: Section = { kind: 'tube', outerDiameterM: 0.06, innerDiameterM: 0 }
const rect: Section = { kind: 'rectangle', widthM: 0.02, heightM: 0.08 }
const iSec: Section = {
  kind: 'iSection',
  widthM: 0.05,
  heightM: 0.1,
  flangeThicknessM: 0.008,
  webThicknessM: 0.005,
}

function extents(pts: Vec2[]): { widthM: number; heightM: number } {
  const us = pts.map((p) => p.u)
  const vs = pts.map((p) => p.v)
  return {
    widthM: Math.max(...us) - Math.min(...us),
    heightM: Math.max(...vs) - Math.min(...vs),
  }
}

/** Shoelace signed area: positive for counter-clockwise. */
function signedArea(pts: Vec2[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    a += p.u * q.v - q.u * p.v
  }
  return a / 2
}

describe('sectionOutline', () => {
  it.each([circle, tube, rect, iSec])('outer extents equal the bounding box ($kind)', (s) => {
    const e = extents(sectionOutline(s).outer)
    const bb = sectionBoundingBox(s)
    expect(e.widthM).toBeCloseTo(bb.widthM, 12)
    expect(e.heightM).toBeCloseTo(bb.heightM, 12)
  })

  it('outer contours are counter-clockwise', () => {
    for (const s of [circle, tube, rect, iSec]) {
      expect(signedArea(sectionOutline(s).outer)).toBeGreaterThan(0)
    }
  })

  it('circle uses the requested number of segments (default 48)', () => {
    expect(sectionOutline(circle).outer).toHaveLength(48)
    expect(sectionOutline(circle, 16).outer).toHaveLength(16)
  })

  it('clamps invalid segment counts to an integer ≥ 8', () => {
    expect(sectionOutline(circle, 3).outer).toHaveLength(8)
    expect(sectionOutline(circle, 12.6).outer).toHaveLength(13)
    expect(sectionOutline(circle, Number.NaN).outer).toHaveLength(48)
  })

  it('tube has one clockwise hole of the inner diameter', () => {
    const { holes } = sectionOutline(tube)
    expect(holes).toHaveLength(1)
    expect(signedArea(holes[0]!)).toBeLessThan(0)
    expect(extents(holes[0]!).widthM).toBeCloseTo(0.04, 12)
  })

  it('tube with d = 0 has no hole', () => {
    expect(sectionOutline(solidTube).holes).toEqual([])
  })

  it('rectangle has 4 points and I-section 12 points, no holes', () => {
    expect(sectionOutline(rect).outer).toHaveLength(4)
    expect(sectionOutline(iSec).outer).toHaveLength(12)
    expect(sectionOutline(iSec).holes).toEqual([])
  })

  it('I-section web and flange faces sit at tw/2 and h/2 − tf', () => {
    const outer = sectionOutline(iSec).outer
    expect(outer[3]!.u).toBeCloseTo(0.0025, 12)
    expect(outer[4]!.v).toBeCloseTo(0.05 - 0.008, 12)
  })
})
