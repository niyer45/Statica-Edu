// Feature: engineering-intuition-mvp, Property 13: Determinism
// **Validates: Requirements 8.11, 9.11**
//
// analyze(d, ch) deep-equals analyze(structuredClone(d), ch) and a repeated call, leaves its
// (deep-frozen) inputs unchanged without throwing, and returns a deep-frozen Analysis.
// Determinism is exact, so results are compared with toStrictEqual (bitwise numbers), not
// with a tolerance.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbDesign, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { deepFreeze } from '../challenge/deepFreeze'
import { analyze } from './analyze'

const ch = bundledChallenge()

/** Every object/array reachable from `x` (including `x`) is frozen. Returns the first unfrozen path. */
function firstUnfrozenPath(x: unknown, path = '$', seen = new WeakSet<object>()): string | null {
  if (x === null || typeof x !== 'object') return null
  if (seen.has(x)) return null
  seen.add(x)
  if (!Object.isFrozen(x)) return path
  for (const key of Reflect.ownKeys(x)) {
    const child = (x as Record<PropertyKey, unknown>)[key]
    const found = firstUnfrozenPath(child, `${path}.${String(key)}`, seen)
    if (found !== null) return found
  }
  return null
}

describe('Property 13: determinism', () => {
  it('analyze is deterministic, does not mutate frozen inputs, and returns a deep-frozen result', () => {
    assertProperty(
      fc.property(arbDesign(ch), (design) => {
        // Snapshots taken before any call, compared after to detect mutation.
        const designBefore = structuredClone(design)
        const chCopy = structuredClone(ch)
        const chBefore = structuredClone(chCopy)
        const frozenDesign = deepFreeze(design)
        const frozenCh = deepFreeze(chCopy)

        const a = analyze(frozenDesign, frozenCh)
        const b = analyze(structuredClone(design), frozenCh)
        const c = analyze(frozenDesign, frozenCh)
        const d = analyze(structuredClone(design), structuredClone(chBefore))

        expect(b).toStrictEqual(a)
        expect(c).toStrictEqual(a)
        expect(d).toStrictEqual(a)

        expect(frozenDesign).toStrictEqual(designBefore)
        expect(frozenCh).toStrictEqual(chBefore)

        for (const r of [a, b, c, d]) expect(firstUnfrozenPath(r)).toBeNull()
      }),
    )
  })

  it('example: the initial design analyzes identically twice and the result is frozen', () => {
    const d = deepFreeze(structuredClone(ch.initialDesign))
    const r1 = analyze(d, ch)
    const r2 = analyze(structuredClone(ch.initialDesign), ch)
    expect(r2).toStrictEqual(r1)
    expect(Object.isFrozen(r1)).toBe(true)
    expect(Object.isFrozen(r1.warnings)).toBe(true)
    expect(Object.isFrozen(r1.notApplicableReasons)).toBe(true)
    expect(d).toStrictEqual(ch.initialDesign)
  })
})
