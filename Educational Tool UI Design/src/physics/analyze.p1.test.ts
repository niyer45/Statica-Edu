// Feature: engineering-intuition-mvp, Property 1: Finiteness
//
// **Validates: Requirements 8.2, 9.2**
//
// For every valid design over the bundled challenge (all section kinds, both orientations),
// analyze(d, ch) never throws and every numeric field of the result is finite and > 0.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbDesign, arbDesignWith, bundledChallenge, SECTION_KINDS } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Orientation } from '../geometry/sections'
import { analyze } from './analyze'
import type { Analysis } from './types'

const NUMERIC_FIELDS = [
  'areaM2',
  'IxxM4',
  'IyyM4',
  'bendingInertiaM4',
  'extremeFiberM',
  'massKg',
  'tipDeflectionM',
  'maxMomentNm',
  'nominalMaxStressPa',
] as const satisfies readonly (keyof Analysis)[]

const ORIENTATIONS: readonly Orientation[] = [0, 90]

/** Returns a description of the first non-finite or non-positive numeric field, or null. */
function badField(a: Analysis): string | null {
  for (const f of NUMERIC_FIELDS) {
    const v: unknown = a[f]
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return `${f} = ${String(v)}`
  }
  return null
}

describe('Property 1: Finiteness', () => {
  const ch = bundledChallenge()

  it('bundled challenge allows every section kind', () => {
    expect([...ch.allowedSections].sort()).toEqual([...SECTION_KINDS].sort())
  })

  it('analyze never throws and every numeric field is finite and > 0 (any valid design)', () => {
    assertProperty(
      fc.property(arbDesign(ch), (d) => {
        const a = analyze(d, ch)
        const bad = badField(a)
        if (bad !== null) throw new Error(`non-finite or non-positive field: ${bad}`)
      }),
    )
  })

  // Per kind × orientation so each combination is exercised regardless of oneof weighting.
  for (const kind of SECTION_KINDS) {
    for (const orientation of ORIENTATIONS) {
      it(`holds for ${kind} at ${orientation}°`, () => {
        assertProperty(
          fc.property(arbDesignWith(ch, { kinds: [kind], orientation }), (d) => {
            const a = analyze(d, ch)
            expect(d.section.kind).toBe(kind)
            expect(d.orientationDeg).toBe(orientation)
            const bad = badField(a)
            if (bad !== null) throw new Error(`non-finite or non-positive field: ${bad}`)
          }),
        )
      })
    }
  }
})
