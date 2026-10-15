// Feature: engineering-intuition-mvp, Property 15: Clamp validity
//
// ∀ valid s, param p of s.kind, and any number v (finite or hostile):
//   - clampParam(s, p, v, limits) is valid (validateSection returns []);
//   - clamping twice with the same p and v equals clamping once (deep equality);
//   - a non-finite v returns a section deep-equal to s;
//   - for finite v, the clamped p lies within permissibleRange(s, p, limits).
// Idempotence compares clampParam(clampParam(s, p, v), p, v) with clampParam(s, p, v), since the
// permissible range of a coupled parameter may differ after the first clamp.
//
// **Validates: Requirements 6.1, 6.3, 6.4**

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  arbAnyNumber,
  arbHostileNumber,
  arbParamFor,
  arbSectionOfKind,
  arbValidSection,
  bundledChallenge,
  SECTION_KINDS,
} from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { SectionKind, SectionLimits } from '../challenge/types'
import { clampParam, paramsOf, permissibleRange } from './clamp'
import { GEOM_TOL, type Section } from './sections'
import { validateSection } from './validate'

const bundledLimits: SectionLimits = bundledChallenge().sectionLimits

const range = (minM: number, maxM: number, stepM = 0.0005) => ({ minM, maxM, stepM })

// Tighter limits where the coupled/derived bounds sit close to the range minimums.
const tightLimits: SectionLimits = {
  circle: { diameterM: range(0.005, 0.1) },
  tube: { outerDiameterM: range(0.004, 0.1), minWallM: 0.002 },
  rectangle: { widthM: range(0.003, 0.1), heightM: range(0.003, 0.1) },
  iSection: {
    widthM: range(0.003, 0.1),
    heightM: range(0.009, 0.1),
    minFlangeThicknessM: 0.003,
    minWebThicknessM: 0.003,
    minClearWebHeightM: 0.003,
  },
}

const LIMIT_SETS: { label: string; limits: SectionLimits }[] = [
  { label: 'bundled challenge limits', limits: bundledLimits },
  { label: 'tight limits', limits: tightLimits },
]

interface ClampCase {
  s: Section
  p: string
  v: number
}

function read(s: Section, p: string): number {
  return (s as unknown as Record<string, number>)[p] as number
}

/** Values around a bound: exact, ±GEOM_TOL, ±1e-12. */
function nearBound(b: number): fc.Arbitrary<number> {
  return fc.constantFrom(b, b + GEOM_TOL, b - GEOM_TOL, b + 1e-12, b - 1e-12)
}

/** Mix of in-range, near-bound, far-outside, hostile, and arbitrary numbers for (s, p). */
function arbValueFor(s: Section, p: string, limits: SectionLimits): fc.Arbitrary<number> {
  const r = permissibleRange(s, p, limits)
  if (r === null) throw new Error(`no permissible range for ${s.kind}.${p}`)
  const span = Math.max(r.maxM - r.minM, 1e-3)
  return fc.oneof(
    fc.double({ min: r.minM, max: r.maxM, noNaN: true, noDefaultInfinity: true }),
    nearBound(r.minM),
    nearBound(r.maxM),
    fc.double({ min: r.maxM + span, max: r.maxM + 1e3, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: -1e3, max: r.minM - span, noNaN: true, noDefaultInfinity: true }),
    arbHostileNumber,
    arbAnyNumber,
  )
}

function arbCaseOfKind(kind: SectionKind, limits: SectionLimits): fc.Arbitrary<ClampCase> {
  return fc
    .tuple(arbSectionOfKind(kind, limits) as fc.Arbitrary<Section>, arbParamFor(kind) as fc.Arbitrary<string>)
    .chain(([s, p]) => arbValueFor(s, p, limits).map((v) => ({ s, p, v })))
}

/** Same shape, but the section comes from arbValidSection and p from paramsOf(s.kind). */
function arbCaseAny(limits: SectionLimits): fc.Arbitrary<ClampCase> {
  return arbValidSection(limits).chain((s) =>
    fc
      .constantFrom(...paramsOf(s.kind))
      .chain((p) => arbValueFor(s, p, limits).map((v) => ({ s, p, v }))),
  )
}

function checkCase({ s, p, v }: ClampCase, limits: SectionLimits): void {
  // Precondition: the generated section is valid.
  expect(validateSection(s, limits)).toEqual([])
  const snapshot = structuredClone(s)

  const once = clampParam(s, p, v, limits)
  expect(validateSection(once, limits)).toEqual([])
  expect(once.kind).toBe(s.kind)

  const twice = clampParam(once, p, v, limits)
  expect(twice).toEqual(once)

  if (!Number.isFinite(v)) {
    expect(once).toEqual(s)
  } else {
    const r = permissibleRange(s, p, limits)
    expect(r).not.toBeNull()
    const got = read(once, p)
    expect(got).toBeGreaterThanOrEqual(r!.minM)
    expect(got).toBeLessThanOrEqual(r!.maxM)
  }

  // Inputs are never mutated.
  expect(s).toEqual(snapshot)
}

describe.each(LIMIT_SETS)('Property 15: clamp validity ($label)', ({ limits }) => {
  it.each(SECTION_KINDS.map((kind) => ({ kind })))(
    '$kind: result is valid, idempotent, unchanged for non-finite v, and within the permissible range',
    ({ kind }) => {
      assertProperty(fc.property(arbCaseOfKind(kind, limits), (c) => checkCase(c, limits)))
    },
  )

  it('any valid section and parameter: same properties', () => {
    assertProperty(fc.property(arbCaseAny(limits), (c) => checkCase(c, limits)))
  })
})
