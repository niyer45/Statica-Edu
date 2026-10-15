import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import type { BeamDesign } from '../../geometry/sections'
import { analyze } from '../../physics/analyze'
import { deflectionShape } from '../../physics/beam'
import { bundledChallenge } from '../../../test/arbitraries'
import { FIXTURES, baseline, rectFlat, rectTall, reference, tinyCircle, type Fixture } from '../../../test/fixtures/designs'
import {
  buildBeamGeometry,
  buildDeformedBeamGeometry,
  deformBeamGeometry,
  deformationParams,
  deformedVertexY,
  visualDeflectionScale,
  visualOffset,
  type DeformationParams,
} from './index'

// Task 14.2 (Req 25.2, 25.3, 25.6, 9.12). Basic geometry (extent, segments, root/tip, no input
// mutation) is covered by beamGeometry.test.ts; this file covers the exaggeration cap, the
// uncapped k·w(x) shape, and that mesh generation never changes the analysis.

const ch = bundledChallenge()
const k = ch.visualization.exaggerationFactor
const capFraction = ch.visualization.maxVisualDeflectionFractionOfL

/** Vertex positions are Float32: absolute tolerance in metres for mesh-derived values. */
const F32_TOL = 1e-6

const paramsFor = (d: BeamDesign): DeformationParams => deformationParams(d, analyze(d, ch), ch)

/** Physical deflection w(x) from the physics reference implementation. */
const w = (p: DeformationParams, x: number) =>
  deflectionShape(p.forceN, p.lengthM, p.elasticModulusPa, p.bendingInertiaM4, x)

/** Sample points along the beam, including both ends. */
const samplesAlong = (L: number, n = 24) => Array.from({ length: n + 1 }, (_, i) => (i / n) * L)

/** Per-vertex downward displacement (base Y − deformed Y) paired with the vertex x. */
function displacements(base: BufferGeometry, deformed: BufferGeometry): { x: number; dy: number }[] {
  const a = base.getAttribute('position')
  const b = deformed.getAttribute('position')
  expect(b.count).toBe(a.count)
  const out: { x: number; dy: number }[] = []
  for (let i = 0; i < a.count; i++) {
    expect(b.getX(i)).toBe(a.getX(i))
    expect(b.getZ(i)).toBe(a.getZ(i))
    out.push({ x: a.getX(i), dy: a.getY(i) - b.getY(i) })
  }
  return out
}

const isCapped = (f: Fixture) => k * f.expected.tipDeflectionM > capFraction * f.design.lengthM

describe('visual deflection cap (Req 25.2)', () => {
  const d = tinyCircle.design
  const p = paramsFor(d)
  const L = d.lengthM
  const cap = capFraction * L

  it('tinyCircle is in the capped regime for the bundled challenge', () => {
    expect(capFraction).toBe(0.3)
    expect(k * p.tipDeflectionM).toBeGreaterThan(cap)
    expect(visualDeflectionScale(p)).toBeCloseTo(cap / p.tipDeflectionM, 12)
    expect(visualDeflectionScale(p)).toBeLessThan(k)
  })

  it('keeps every visual offset ≤ 0.3·L and reaches the cap at the tip', () => {
    for (const x of samplesAlong(L)) {
      expect(visualOffset(x, p)).toBeLessThanOrEqual(cap * (1 + 1e-12))
    }
    expect(visualOffset(L, p)).toBeCloseTo(cap, 12)
    // x outside [0, L] is clamped, so it cannot exceed the cap either.
    expect(visualOffset(2 * L, p)).toBeCloseTo(cap, 12)
    expect(visualOffset(-L, p)).toBe(0)
  })

  it('scales the shape uniformly: offset(x) / w(x) is constant along the beam', () => {
    const scale = visualDeflectionScale(p)
    for (const x of samplesAlong(L).slice(1)) {
      expect(visualOffset(x, p) / w(p, x)).toBeCloseTo(scale, 9)
    }
  })

  it('mesh: max vertex displacement ≤ 0.3·L, at the tip, for both orientations', () => {
    for (const orientation of [0, 90] as const) {
      const base = buildBeamGeometry(d.section, orientation, L)
      const deformed = deformBeamGeometry(base, p)
      const dys = displacements(base, deformed).map((v) => v.dy)
      const maxDy = Math.max(...dys)
      expect(maxDy).toBeLessThanOrEqual(cap + F32_TOL)
      expect(maxDy).toBeCloseTo(cap, 5)
      expect(Math.min(...dys)).toBeGreaterThanOrEqual(-F32_TOL)
      base.dispose()
      deformed.dispose()
    }
  })

  it('every fixture stays within the cap', () => {
    for (const f of FIXTURES) {
      const fp = paramsFor(f.design)
      expect(visualOffset(f.design.lengthM, fp)).toBeLessThanOrEqual(capFraction * f.design.lengthM * (1 + 1e-12))
    }
  })
})

describe('uncapped offset = k·w(x) (Req 25.2, 25.3)', () => {
  const uncapped = FIXTURES.filter((f) => !isCapped(f))

  it('covers the expected fixtures', () => {
    expect(k).toBe(15)
    expect(uncapped.map((f) => f.name)).toEqual(
      expect.arrayContaining([baseline.name, reference.name, rectTall.name]),
    )
    // 15·δ exceeds 0.3·L = 0.18 m for these two (rectFlat: 15 × 24.7 mm ≈ 0.37 m).
    expect(uncapped.map((f) => f.name)).not.toContain(tinyCircle.name)
    expect(uncapped.map((f) => f.name)).not.toContain(rectFlat.name)
  })

  it.each(uncapped.map((f) => [f.name, f] as const))('%s: offset(x) = 15·w(x) along the beam', (_, f) => {
    const p = paramsFor(f.design)
    expect(visualDeflectionScale(p)).toBe(k)
    for (const x of samplesAlong(f.design.lengthM)) {
      const expected = k * w(p, x)
      expect(visualOffset(x, p)).toBeCloseTo(expected, 15)
      expect(deformedVertexY(x, 0.01, p)).toBeCloseTo(0.01 - expected, 15)
    }
    // Tip offset is k·δ_tip from the analysis (w(L) = δ_tip).
    expect(visualOffset(f.design.lengthM, p)).toBeCloseTo(k * p.tipDeflectionM, 12)
  })

  it.each([0, 90] as const)('mesh vertices are displaced by 15·w(x) at their own x (rectTall, mesh %s°)', (orientation) => {
    const d = rectTall.design
    const p = paramsFor(d)
    const base = buildBeamGeometry(d.section, orientation, d.lengthM)
    const deformed = deformBeamGeometry(base, p)
    for (const { x, dy } of displacements(base, deformed)) {
      expect(Math.abs(dy - k * w(p, x))).toBeLessThanOrEqual(F32_TOL)
    }
    base.dispose()
    deformed.dispose()
  })
})

describe('mesh generation never changes the analysis (Req 25.6, 9.12)', () => {
  it.each(FIXTURES.map((f) => [f.name, f] as const))('%s: analysis deep-equal with and without mesh', (_, f) => {
    const d = f.design
    const without = analyze(d, ch)
    const designBefore = structuredClone(d)

    const a = analyze(d, ch)
    const p = deformationParams(d, a, ch)
    const g = buildDeformedBeamGeometry(d.section, d.orientationDeg, p)
    g.dispose()
    const after = analyze(d, ch)

    expect(a).toEqual(without)
    expect(after).toEqual(without)
    expect(d).toEqual(designBefore)
  })
})
