import { describe, expect, it } from 'vitest'
import type { SectionLimits } from '../challenge/types'
import { clampParam, paramsOf, permissibleRange, SECTION_PARAMS, trySetParam } from './clamp'
import type { Section } from './sections'
import { validateSection } from './validate'

const range = (minM: number, maxM: number, stepM = 0.0005) => ({ minM, maxM, stepM })

// Limits following the design data table (independent of the bundled JSON).
const limits: SectionLimits = {
  circle: { diameterM: range(0.005, 0.1) },
  tube: { outerDiameterM: range(0.01, 0.1), minWallM: 0.002 },
  rectangle: { widthM: range(0.003, 0.1), heightM: range(0.003, 0.1) },
  iSection: {
    widthM: range(0.01, 0.1),
    heightM: range(0.01, 0.1),
    minFlangeThicknessM: 0.003,
    minWebThicknessM: 0.003,
    minClearWebHeightM: 0.003,
  },
}

const circle: Section = { kind: 'circle', diameterM: 0.03 }
const tube: Section = { kind: 'tube', outerDiameterM: 0.04, innerDiameterM: 0.03 }
const rect: Section = { kind: 'rectangle', widthM: 0.02, heightM: 0.04 }
const iSec: Section = {
  kind: 'iSection',
  widthM: 0.04,
  heightM: 0.06,
  flangeThicknessM: 0.005,
  webThicknessM: 0.004,
}

function expectValid(s: Section) {
  expect(validateSection(s, limits)).toEqual([])
}

describe('paramsOf / SECTION_PARAMS', () => {
  it('lists parameters per kind in validator order', () => {
    expect(paramsOf('tube')).toEqual(['outerDiameterM', 'innerDiameterM'])
    expect(paramsOf('iSection')).toEqual(SECTION_PARAMS.iSection)
  })
})

describe('permissibleRange', () => {
  it('narrows dependent thicknesses from the current section', () => {
    expect(permissibleRange(tube, 'innerDiameterM', limits)).toEqual({ minM: 0, maxM: 0.04 - 0.004 })
    expect(permissibleRange(iSec, 'flangeThicknessM', limits)).toEqual({
      minM: 0.003,
      maxM: (0.06 - 0.003) / 2,
    })
    expect(permissibleRange(iSec, 'webThicknessM', limits)).toEqual({ minM: 0.003, maxM: 0.04 })
  })

  it('applies derived lower bounds so coupled shrinking stays valid', () => {
    const tight: SectionLimits = {
      ...limits,
      tube: { outerDiameterM: range(0.001, 0.1), minWallM: 0.002 },
      iSection: { ...limits.iSection, widthM: range(0.001, 0.1), heightM: range(0.001, 0.1) },
    }
    expect(permissibleRange(tube, 'outerDiameterM', tight)?.minM).toBe(0.004)
    expect(permissibleRange(iSec, 'heightM', tight)?.minM).toBeCloseTo(0.009, 15)
    expect(permissibleRange(iSec, 'widthM', tight)?.minM).toBe(0.003)
  })

  it('returns null for a parameter the kind does not have', () => {
    expect(permissibleRange(circle, 'widthM', limits)).toBeNull()
  })
})

describe('clampParam', () => {
  it('sets an in-range value exactly and leaves other params alone', () => {
    expect(clampParam(rect, 'widthM', 0.05, limits)).toEqual({ ...rect, widthM: 0.05 })
    expect(clampParam(iSec, 'flangeThicknessM', 0.01, limits)).toEqual({ ...iSec, flangeThicknessM: 0.01 })
  })

  it('clamps to each range bound', () => {
    expect(clampParam(circle, 'diameterM', 1, limits)).toEqual({ kind: 'circle', diameterM: 0.1 })
    expect(clampParam(circle, 'diameterM', -5, limits)).toEqual({ kind: 'circle', diameterM: 0.005 })
    expect(clampParam(tube, 'innerDiameterM', 0.039, limits)).toEqual({ ...tube, innerDiameterM: 0.04 - 0.004 })
    expect(clampParam(tube, 'innerDiameterM', -0.01, limits)).toEqual({ ...tube, innerDiameterM: 0 })
    expect(clampParam(iSec, 'flangeThicknessM', 1, limits)).toEqual({ ...iSec, flangeThicknessM: (0.06 - 0.003) / 2 })
    expect(clampParam(iSec, 'flangeThicknessM', 0, limits)).toEqual({ ...iSec, flangeThicknessM: 0.003 })
    expect(clampParam(iSec, 'webThicknessM', 1, limits)).toEqual({ ...iSec, webThicknessM: 0.04 })
    expect(clampParam(iSec, 'webThicknessM', 0, limits)).toEqual({ ...iSec, webThicknessM: 0.003 })
    for (const s of [
      clampParam(tube, 'innerDiameterM', 0.039, limits),
      clampParam(iSec, 'flangeThicknessM', 1, limits),
      clampParam(iSec, 'webThicknessM', 1, limits),
    ]) {
      expectValid(s)
    }
  })

  it('normalizes −0 to 0 for the tube inner diameter', () => {
    const out = clampParam(tube, 'innerDiameterM', -0, limits)
    expect(out.kind === 'tube' && Object.is(out.innerDiameterM, 0)).toBe(true)
  })

  it('6.2(a): reducing D shrinks d to max(0, D − 2·minWall)', () => {
    const out = clampParam(tube, 'outerDiameterM', 0.02, limits)
    expect(out).toEqual({ kind: 'tube', outerDiameterM: 0.02, innerDiameterM: 0.02 - 0.004 })
    expectValid(out)
    // D at its minimum: d shrinks to 0.006.
    const min = clampParam(tube, 'outerDiameterM', 0, limits)
    expect(min).toEqual({ kind: 'tube', outerDiameterM: 0.01, innerDiameterM: 0.01 - 0.004 })
    expectValid(min)
  })

  it('6.2(a): d is kept when the wall is still thick enough, and never grows', () => {
    expect(clampParam(tube, 'outerDiameterM', 0.035, limits)).toEqual({ ...tube, outerDiameterM: 0.035 })
    expect(clampParam(tube, 'outerDiameterM', 0.1, limits)).toEqual({ ...tube, outerDiameterM: 0.1 })
  })

  it('6.2(b): reducing h shrinks tf to (h − minClear)/2', () => {
    const out = clampParam(iSec, 'heightM', 0.01, limits)
    expect(out).toEqual({ ...iSec, heightM: 0.01, flangeThicknessM: (0.01 - 0.003) / 2 })
    expectValid(out)
    expect(clampParam(iSec, 'heightM', 0.1, limits)).toEqual({ ...iSec, heightM: 0.1 })
  })

  it('6.2(c): reducing b below tw shrinks tw to b', () => {
    const wide: Section = { ...iSec, webThicknessM: 0.03 } as Section
    const out = clampParam(wide, 'widthM', 0.02, limits)
    expect(out).toEqual({ ...wide, widthM: 0.02, webThicknessM: 0.02 })
    expectValid(out)
    expect(clampParam(wide, 'widthM', 0.035, limits)).toEqual({ ...wide, widthM: 0.035 })
  })

  it('6.3: non-finite values return the input unchanged', () => {
    for (const v of [NaN, Infinity, -Infinity]) {
      expect(clampParam(iSec, 'heightM', v, limits)).toBe(iSec)
      expect(clampParam(tube, 'outerDiameterM', v, limits)).toEqual(tube)
    }
  })

  it('returns the input unchanged for an unknown parameter', () => {
    expect(clampParam(circle, 'widthM', 0.05, limits)).toBe(circle)
  })

  it('does not mutate its input', () => {
    const copy = structuredClone(iSec)
    clampParam(iSec, 'heightM', 0.01, limits)
    expect(iSec).toEqual(copy)
  })

  it('6.4: is idempotent on coupled cases', () => {
    const cases: [Section, string, number][] = [
      [tube, 'outerDiameterM', 0.0123],
      [iSec, 'heightM', 0.0111],
      [{ ...iSec, webThicknessM: 0.03 } as Section, 'widthM', 0.0177],
      [iSec, 'flangeThicknessM', 0.5],
    ]
    for (const [s, p, v] of cases) {
      const once = clampParam(s, p, v, limits)
      expect(clampParam(once, p, v, limits)).toEqual(once)
    }
  })
})

describe('trySetParam', () => {
  it('replaces only the parameter when the result is valid', () => {
    expect(trySetParam(iSec, 'webThicknessM', 0.003, limits)).toEqual({
      ok: true,
      value: { ...iSec, webThicknessM: 0.003 },
    })
  })

  it('does not apply coupling and returns every validator error', () => {
    const r = trySetParam(tube, 'outerDiameterM', 0.02, limits)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toEqual(validateSection({ ...tube, outerDiameterM: 0.02 }, limits))
      expect(r.error.map((e) => e.code)).toEqual(['INNER_NOT_LESS_THAN_OUTER'])
    }
    const r2 = trySetParam(iSec, 'heightM', 0.2, limits)
    expect(!r2.ok && r2.error.map((e) => e.code)).toEqual(['ABOVE_MAX'])
  })

  it('6.7: non-finite values fail with NON_FINITE for that parameter', () => {
    for (const v of [NaN, Infinity, -Infinity]) {
      const r = trySetParam(rect, 'heightM', v, limits)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toEqual([expect.objectContaining({ code: 'NON_FINITE', param: 'heightM' })])
    }
  })

  it('rejects an unknown parameter', () => {
    const r = trySetParam(circle, 'widthM', 0.02, limits)
    expect(r.ok).toBe(false)
  })
})
