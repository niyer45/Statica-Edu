// Feature: engineering-intuition-mvp, Property 16: Clamp locality
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbAnyNumber, arbParamFor, arbValidSection, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { clampParam } from './clamp'
import type { Section } from './sections'

/** **Validates: Requirements 6.2** */
describe('Property 16: Clamp locality', () => {
  const limits = bundledChallenge().sectionLimits
  const { minWallM } = limits.tube
  const { minClearWebHeightM } = limits.iSection

  type Coupling = { driver: string; coupled: string; target: (r: Record<string, number>) => number }

  /** Req 6.2 (a)–(c): the only coupled thickness allowed to move when `param` is set. */
  function couplingFor(kind: Section['kind'], param: string): Coupling | null {
    if (kind === 'tube' && param === 'outerDiameterM') {
      return { driver: param, coupled: 'innerDiameterM', target: (r) => Math.max(0, r[param]! - 2 * minWallM) }
    }
    if (kind === 'iSection' && param === 'heightM') {
      return { driver: param, coupled: 'flangeThicknessM', target: (r) => (r[param]! - minClearWebHeightM) / 2 }
    }
    if (kind === 'iSection' && param === 'widthM') {
      return { driver: param, coupled: 'webThicknessM', target: (r) => r[param]! }
    }
    return null
  }

  const arbCase = arbValidSection(limits).chain((s) =>
    fc.tuple(fc.constant(s), arbParamFor(s.kind) as fc.Arbitrary<string>, arbAnyNumber),
  )

  it('changes only p, plus documented coupled thicknesses that shrink to the exact Req 6.2 value', () => {
    assertProperty(
      fc.property(arbCase, ([s, p, v]) => {
        const r = clampParam(s, p, v, limits)
        expect(r.kind).toBe(s.kind)
        expect(Object.keys(r).sort()).toEqual(Object.keys(s).sort())

        const before = s as unknown as Record<string, number>
        const after = r as unknown as Record<string, number>
        const coupling = couplingFor(s.kind, p)

        for (const key of Object.keys(s)) {
          if (key === 'kind' || key === p) continue
          if (coupling && key === coupling.coupled && !Object.is(after[key], before[key])) {
            // Coupled shrink: strictly smaller, exactly the Req 6.2 value, and only when the
            // driving dimension was reduced.
            expect(after[key]).toBeLessThan(before[key]!)
            expect(after[key]).toBe(coupling.target(after))
            expect(after[coupling.driver]).toBeLessThan(before[coupling.driver]!)
            continue
          }
          expect(after[key]).toBe(before[key])
        }
      }),
    )
  })

  it('example: shrinking tube D below the wall minimum couples d to D − 2·minWall', () => {
    const s: Section = { kind: 'tube', outerDiameterM: 0.04, innerDiameterM: 0.03 }
    // Bundled limits: D ∈ [0.01, 0.1], minWall = 0.002. Wall at D = 0.032 would be 0.001.
    const r = clampParam(s, 'outerDiameterM', 0.032, limits)
    expect(r).toEqual({ kind: 'tube', outerDiameterM: 0.032, innerDiameterM: 0.032 - 2 * minWallM })
  })
})
