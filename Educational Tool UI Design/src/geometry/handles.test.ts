import { describe, expect, it } from 'vitest'
import type { SectionLimits } from '../challenge/types'
import { permissibleRange } from './clamp'
import { handlesFor } from './handles'
import { SECTION_PARAMS } from './params'
import type { Section } from './sections'

const limits: SectionLimits = {
  circle: { diameterM: { minM: 0.005, maxM: 0.1, stepM: 0.0005 } },
  tube: { outerDiameterM: { minM: 0.01, maxM: 0.1, stepM: 0.0005 }, minWallM: 0.002 },
  rectangle: {
    widthM: { minM: 0.005, maxM: 0.08, stepM: 0.0005 },
    heightM: { minM: 0.005, maxM: 0.08, stepM: 0.001 },
  },
  iSection: {
    widthM: { minM: 0.01, maxM: 0.08, stepM: 0.0005 },
    heightM: { minM: 0.02, maxM: 0.08, stepM: 0.001 },
    minFlangeThicknessM: 0.002,
    minWebThicknessM: 0.0015,
    minClearWebHeightM: 0.01,
  },
}

const circle: Section = { kind: 'circle', diameterM: 0.05 }
const tube: Section = { kind: 'tube', outerDiameterM: 0.06, innerDiameterM: 0.04 }
const rect: Section = { kind: 'rectangle', widthM: 0.02, heightM: 0.08 }
const iSec: Section = {
  kind: 'iSection',
  widthM: 0.05,
  heightM: 0.06,
  flangeThicknessM: 0.008,
  webThicknessM: 0.005,
}

const byParam = (s: Section, o: 0 | 90) =>
  Object.fromEntries(handlesFor(s, o, limits).map((h) => [h.param, h]))

describe('handlesFor', () => {
  it.each([circle, tube, rect, iSec])('one handle per editable parameter ($kind)', (s) => {
    const params = handlesFor(s, 0, limits).map((h) => h.param)
    expect(params).toEqual([...SECTION_PARAMS[s.kind]])
  })

  it('uses student-facing labels', () => {
    expect(handlesFor(tube, 0, limits).map((h) => h.label)).toEqual([
      'Outer diameter',
      'Inner diameter',
    ])
    expect(handlesFor(iSec, 0, limits).map((h) => h.label)).toEqual([
      'Width',
      'Height',
      'Flange thickness',
      'Web thickness',
    ])
  })

  it('maps width/tw → Z and height/tf → Y at 0°, swapped at 90°', () => {
    const at0 = byParam(iSec, 0)
    const at90 = byParam(iSec, 90)
    expect([at0.widthM!.axis, at0.heightM!.axis]).toEqual(['Z', 'Y'])
    expect([at0.flangeThicknessM!.axis, at0.webThicknessM!.axis]).toEqual(['Y', 'Z'])
    expect([at90.widthM!.axis, at90.heightM!.axis]).toEqual(['Y', 'Z'])
    expect([at90.flangeThicknessM!.axis, at90.webThicknessM!.axis]).toEqual(['Z', 'Y'])
    expect(byParam(rect, 90).widthM!.axis).toBe('Y')
  })

  it('diameters always use Y', () => {
    for (const o of [0, 90] as const) {
      expect(handlesFor(circle, o, limits).every((h) => h.axis === 'Y')).toBe(true)
      expect(handlesFor(tube, o, limits).every((h) => h.axis === 'Y')).toBe(true)
    }
  })

  it('anchors sit on the outline edge for each parameter', () => {
    const h = byParam(rect, 0)
    expect(h.widthM!.anchorM).toEqual({ u: 0.01, v: 0 })
    expect(h.heightM!.anchorM).toEqual({ u: 0, v: 0.04 })
    expect(byParam(circle, 0).diameterM!.anchorM).toEqual({ u: 0, v: 0.025 })
  })

  it('outer-dimension ranges come from the challenge', () => {
    expect(byParam(rect, 0).heightM!.range).toEqual(limits.rectangle.heightM)
    expect(byParam(tube, 0).outerDiameterM!.range).toEqual(limits.tube.outerDiameterM)
  })

  it('tube inner diameter range is [0, D − 2·minWall]', () => {
    const r = byParam(tube, 0).innerDiameterM!.range
    expect(r.minM).toBe(0)
    expect(r.maxM).toBeCloseTo(0.06 - 2 * 0.002, 12)
    expect(r.stepM).toBe(limits.tube.outerDiameterM.stepM)
  })

  it('I-section tf ∈ [minTf, (h − minClear)/2] and tw ∈ [minTw, b]', () => {
    const h = byParam(iSec, 0)
    expect(h.flangeThicknessM!.range.minM).toBe(0.002)
    expect(h.flangeThicknessM!.range.maxM).toBeCloseTo((0.06 - 0.01) / 2, 12)
    expect(h.flangeThicknessM!.range.stepM).toBe(limits.iSection.heightM.stepM)
    expect(h.webThicknessM!.range).toEqual({
      minM: 0.0015,
      maxM: 0.05,
      stepM: limits.iSection.widthM.stepM,
    })
  })

  // Limits whose challenge minimums sit below the derived bounds, so those bounds bind.
  const loose: SectionLimits = {
    ...limits,
    tube: { outerDiameterM: { minM: 0.001, maxM: 0.1, stepM: 0.0005 }, minWallM: 0.002 },
    iSection: {
      ...limits.iSection,
      widthM: { minM: 0.001, maxM: 0.08, stepM: 0.0005 },
      heightM: { minM: 0.001, maxM: 0.08, stepM: 0.001 },
    },
  }
  // tf upper bound (0.012 − 0.01)/2 = 0.001 < minTf → degenerate range collapses to tf.
  const thinI: Section = {
    kind: 'iSection',
    widthM: 0.03,
    heightM: 0.012,
    flangeThicknessM: 0.001,
    webThicknessM: 0.002,
  }

  it.each([
    ['default', limits],
    ['loose', loose],
  ] as const)('range min/max equal permissibleRange for every kind and param (%s limits)', (_, lim) => {
    for (const s of [circle, tube, rect, iSec, thinI]) {
      for (const o of [0, 90] as const) {
        for (const h of handlesFor(s, o, lim)) {
          const r = permissibleRange(s, h.param, lim)
          expect(r).not.toBeNull()
          expect({ minM: h.range.minM, maxM: h.range.maxM }).toEqual(r)
        }
      }
    }
  })

  it('derived lower bounds bind: tube D ≥ 2·minWall, I h ≥ 2·minTf + minClear, I b ≥ minTw', () => {
    expect(handlesFor(tube, 0, loose)[0]!.range.minM).toBeCloseTo(0.004, 12)
    const h = Object.fromEntries(handlesFor(iSec, 0, loose).map((d) => [d.param, d]))
    expect(h.heightM!.range.minM).toBeCloseTo(2 * 0.002 + 0.01, 12)
    expect(h.widthM!.range.minM).toBe(0.0015)
  })

  it('degenerate tf range collapses to the current value', () => {
    const tf = handlesFor(thinI, 0, limits).find((d) => d.param === 'flangeThicknessM')!
    expect(tf.range).toEqual({ minM: 0.001, maxM: 0.001, stepM: limits.iSection.heightM.stepM })
  })
})
