import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import type { Challenge } from '../../challenge/types'
import type { BeamDesign, Section } from '../../geometry/sections'
import { analyze } from '../../physics/analyze'
import { baseline, rectTall, tubeSameMass } from '../../../test/fixtures/designs'
import {
  BEAM_LENGTH_SEGMENTS,
  buildBeamGeometry,
  buildDeformedBeamGeometry,
  deformBeamGeometry,
  deformationParams,
  sectionShape,
} from './index'

if (!bundledChallengeResult.ok) throw new Error('bundled challenge failed to load')
const ch: Challenge = bundledChallengeResult.value

// Vertex positions are Float32, so geometry assertions use 1e-6 m tolerances.
const box = (g: ReturnType<typeof buildBeamGeometry>) => {
  g.computeBoundingBox()
  const b = g.boundingBox
  if (!b) throw new Error('no bounding box')
  return b
}

const distinctX = (g: ReturnType<typeof buildBeamGeometry>) => {
  const pos = g.getAttribute('position')
  const xs = new Set<number>()
  for (let i = 0; i < pos.count; i++) xs.add(Number(pos.getX(i).toFixed(6)))
  return xs.size
}

describe('sectionShape', () => {
  it('adds the inner hole for a tube', () => {
    const tube: Section = { kind: 'tube', outerDiameterM: 0.05, innerDiameterM: 0.04 }
    expect(sectionShape(tube).holes).toHaveLength(1)
  })

  it('has no holes for solid sections', () => {
    expect(sectionShape(baseline.design.section).holes).toHaveLength(0)
    expect(sectionShape(rectTall.design.section).holes).toHaveLength(0)
  })
})

describe('buildBeamGeometry', () => {
  it('extrudes along +X over [0, L] centred on the axis with 40 segments', () => {
    const L = rectTall.design.lengthM
    const g = buildBeamGeometry(rectTall.design.section, 0, L)
    const b = box(g)
    expect(b.min.x).toBeCloseTo(0, 6)
    expect(b.max.x).toBeCloseTo(L, 6)
    // 0°: width (Z) = b = 15 mm, height (Y) = h = 45 mm
    expect(b.max.z - b.min.z).toBeCloseTo(0.015, 6)
    expect(b.max.y - b.min.y).toBeCloseTo(0.045, 6)
    expect(b.max.y + b.min.y).toBeCloseTo(0, 6)
    expect(distinctX(g)).toBe(BEAM_LENGTH_SEGMENTS + 1)
  })

  it('swaps width and height at 90°', () => {
    const g = buildBeamGeometry(rectTall.design.section, 90, rectTall.design.lengthM)
    const b = box(g)
    expect(b.max.z - b.min.z).toBeCloseTo(0.045, 6)
    expect(b.max.y - b.min.y).toBeCloseTo(0.015, 6)
  })
})

describe('deformBeamGeometry', () => {
  const d: BeamDesign = tubeSameMass.design
  const a = analyze(d, ch)
  const p = deformationParams(d, a, ch)

  it('moves the tip down by k·δ_tip, keeps the root fixed, and leaves the input untouched', () => {
    const base = buildBeamGeometry(d.section, d.orientationDeg, d.lengthM)
    const before = Array.from(base.getAttribute('position').array)
    const deformed = deformBeamGeometry(base, p)
    expect(Array.from(base.getAttribute('position').array)).toEqual(before)

    const pos = deformed.getAttribute('position')
    const r = d.section.kind === 'tube' ? d.section.outerDiameterM / 2 : 0
    let tipMin = Infinity
    let rootMin = Infinity
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      if (Math.abs(x - d.lengthM) < 1e-6) tipMin = Math.min(tipMin, pos.getY(i))
      if (Math.abs(x) < 1e-6) rootMin = Math.min(rootMin, pos.getY(i))
    }
    expect(rootMin).toBeCloseTo(-r, 6)
    expect(tipMin).toBeCloseTo(-r - ch.visualization.exaggerationFactor * a.tipDeflectionM, 6)
  })

  it('does not mutate the analysis', () => {
    const snapshot = structuredClone(a)
    buildDeformedBeamGeometry(d.section, d.orientationDeg, p).dispose()
    expect(a).toEqual(snapshot)
  })
})
