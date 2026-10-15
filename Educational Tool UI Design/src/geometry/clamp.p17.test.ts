// Feature: engineering-intuition-mvp, Property 17: Strict set
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { SectionLimits } from '../challenge/types'
import {
  arbAnyNumber,
  arbHostileNumber,
  arbParamFor,
  arbValidSection,
  bundledChallenge,
} from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { trySetParam } from './clamp'
import type { Section } from './sections'
import { validateSection } from './validate'

// Function portion of Property 17 (the reducer half is task 19.13).

/** **Validates: Requirements 6.5, 6.6, 6.7** */
describe('Property 17: Strict set', () => {
  const limits = bundledChallenge().sectionLimits

  const read = (s: Section, p: string): number => (s as unknown as Record<string, number>)[p] as number

  /** Range limits that apply to `p` directly (independent of other parameters), if any. */
  function rangeFor(s: Section, p: string, L: SectionLimits): { minM: number; maxM: number } | null {
    switch (s.kind) {
      case 'circle':
        return L.circle.diameterM
      case 'tube':
        return p === 'outerDiameterM' ? L.tube.outerDiameterM : null
      case 'rectangle':
        return p === 'widthM' ? L.rectangle.widthM : L.rectangle.heightM
      case 'iSection':
        return p === 'widthM' ? L.iSection.widthM : p === 'heightM' ? L.iSection.heightM : null
    }
  }

  /** Values that make the candidate break a coupled rule (d ≥ D, thin wall, flanges overlap, tw > b, ...). */
  function couplingBreakers(s: Section, p: string, L: SectionLimits): fc.Arbitrary<number>[] {
    switch (s.kind) {
      case 'tube':
        return p === 'innerDiameterM'
          ? [
              fc.double({ min: s.outerDiameterM, max: 2 * s.outerDiameterM, noNaN: true }),
              fc.constant(s.outerDiameterM - L.tube.minWallM), // wall = minWall/2
            ]
          : [fc.constant(s.innerDiameterM), fc.constant(s.innerDiameterM + L.tube.minWallM)] // D ≤ d or wall too thin
      case 'iSection':
        switch (p) {
          case 'flangeThicknessM':
            return [fc.double({ min: s.heightM / 2, max: s.heightM, noNaN: true }), fc.constant(L.iSection.minFlangeThicknessM / 2)]
          case 'webThicknessM':
            return [fc.double({ min: s.widthM * 1.001, max: s.widthM * 2, noNaN: true }), fc.constant(L.iSection.minWebThicknessM / 2)]
          case 'widthM':
            return [fc.constant(s.webThicknessM / 2)] // tw > b
          default:
            return [fc.constant(2 * s.flangeThicknessM)] // no clear web left
        }
      default:
        return []
    }
  }

  /** Mix of values: valid candidates, out of range, coupling violations, hostile, and arbitrary doubles. */
  function arbValueFor(s: Section, p: string): fc.Arbitrary<number> {
    const cur = read(s, p)
    const r = rangeFor(s, p, limits)
    const options: fc.Arbitrary<number>[] = [
      fc.constant(cur), // unchanged value: always valid
      fc.double({ min: cur * 0.9, max: cur * 1.1, noNaN: true }), // near current: mostly valid
      arbHostileNumber,
      arbAnyNumber,
      ...couplingBreakers(s, p, limits),
    ]
    if (r) {
      options.push(
        fc.double({ min: r.minM, max: r.maxM, noNaN: true }),
        fc.constantFrom(r.minM, r.maxM),
        fc.double({ min: r.maxM * 1.01, max: r.maxM * 10, noNaN: true }),
        fc.double({ min: Number.MIN_VALUE, max: r.minM * 0.99, noNaN: true }),
      )
    }
    return fc.oneof(...options)
  }

  const arbCase = arbValidSection(limits).chain((s) =>
    arbParamFor(s.kind).chain((p) => arbValueFor(s, p).map((v) => ({ s, p: p as string, v }))),
  )

  it('ok iff the candidate validates; ok value is exactly the candidate; errors are the validator errors; input untouched', () => {
    let oks = 0
    let fails = 0
    assertProperty(
      fc.property(arbCase, ({ s, p, v }) => {
        const before = structuredClone(s)
        const frozen = Object.freeze({ ...s }) as Section
        const candidate = { ...s, [p]: v } as Section
        const expectedErrors = validateSection(candidate, limits)

        const res = trySetParam(frozen, p, v, limits)

        expect(res.ok).toBe(expectedErrors.length === 0)
        if (res.ok) {
          oks++
          // Only p replaced, no coupled adjustment; Object.is semantics (−0 stays −0).
          expect(res.value).toEqual(candidate)
          expect(Object.keys(res.value).sort()).toEqual(Object.keys(s).sort())
          expect(Object.is(read(res.value, p), v)).toBe(true)
        } else {
          fails++
          expect(res.error).toEqual(expectedErrors)
          if (!Number.isFinite(v)) {
            expect(res.error.some((e) => e.code === 'NON_FINITE' && e.param === p)).toBe(true)
          }
        }
        expect(frozen).toEqual(before)
        expect(s).toEqual(before)
      }),
    )
    // The generator must exercise both branches.
    expect(oks).toBeGreaterThan(0)
    expect(fails).toBeGreaterThan(0)
  })

  it('non-finite values always fail with NON_FINITE for that parameter', () => {
    assertProperty(
      fc.property(
        arbValidSection(limits).chain((s) =>
          fc.tuple(fc.constant(s), arbParamFor(s.kind), fc.constantFrom(Number.NaN, Infinity, -Infinity)),
        ),
        ([s, p, v]) => {
          const before = structuredClone(s)
          const res = trySetParam(s, p, v, limits)
          expect(res.ok).toBe(false)
          if (!res.ok) expect(res.error.some((e) => e.code === 'NON_FINITE' && e.param === p)).toBe(true)
          expect(s).toEqual(before)
        },
      ),
    )
  })
})
