// Feature: engineering-intuition-mvp, Property 23: Inclusive boundary
// **Validates: Requirements 11.3**
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Challenge } from '../challenge/types'
import { analyze } from '../physics/analyze'
import type { Analysis } from '../physics/types'
import { arbDesign, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { acceptanceStatus } from './acceptance'
import { CONSTRAINT_ORDER, evaluateConstraints } from './constraints'
import { evaluate } from './evaluate'
import { REL_TOL, withinLimit } from './tolerance'
import type { ConstraintId } from './types'

const ch = bundledChallenge()

type NumericId = 'deflection' | 'stress' | 'mass' | 'envelopeWidth' | 'envelopeHeight'
const LIMIT_KEY: Record<NumericId, keyof Challenge['constraints']> = {
  deflection: 'maxDeflectionM',
  stress: 'maxStressPa',
  mass: 'maxMassKg',
  envelopeWidth: 'maxWidthM',
  envelopeHeight: 'maxHeightM',
}
const NUMERIC_IDS = Object.keys(LIMIT_KEY) as NumericId[]

/**
 * Positive finite limits in the normal double range. Subnormals lose the 1e-6 step to
 * rounding, and limits near MAX_VALUE overflow when scaled, so neither can express the
 * boundary values the property is about.
 */
const arbLimit = fc.oneof(
  fc.double({ min: 1e-300, max: 1e300, noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: 1e-6, max: 1e9, noNaN: true, noDefaultInfinity: true }),
)

/** Unfrozen challenge copy with one constraint limit replaced. */
function withLimit(id: NumericId, limit: number): Challenge {
  const copy = structuredClone(ch)
  copy.constraints[LIMIT_KEY[id]] = limit
  return copy
}

describe('Property 23: Inclusive boundary (Req 11.3)', () => {
  it('withinLimit: value = limit passes, limit·(1+1e-6) fails, limit·(1+REL_TOL/2) passes', () => {
    assertProperty(
      fc.property(arbLimit, (limit) => {
        expect(withinLimit(limit, limit)).toBe(true)
        expect(withinLimit(limit * (1 + 1e-6), limit)).toBe(false)
        expect(withinLimit(limit * (1 + REL_TOL / 2), limit)).toBe(true)
      }),
    )
  })

  it('evaluate: a limit set at, just below (1e-6), and within REL_TOL/2 of the value', () => {
    assertProperty(
      fc.property(arbDesign(ch), fc.constantFrom(...NUMERIC_IDS), fc.boolean(), (d, id, applicable) => {
        const a: Analysis = { ...analyze(d, ch), applicable }
        const idx = CONSTRAINT_ORDER.indexOf(id)
        const base = evaluateConstraints(d, a, ch)
        const v = base[idx].value
        expect(Number.isFinite(v) && v > 0).toBe(true)

        const check = (limit: number, expectPass: boolean) => {
          const e = evaluate(d, a, withLimit(id, limit))
          const c = e.constraints[idx]
          expect(c.id).toBe(id)
          expect(c.value).toBe(v)
          expect(c.limit).toBe(limit)
          expect(c.passed).toBe(expectPass)
          expect(e.failures.includes(id)).toBe(!expectPass)
          // Every other constraint is unaffected by this limit.
          e.constraints.forEach((other, i) => {
            if (i !== idx) expect(other.passed).toBe(base[i].passed)
          })
          const expectedFailures: ConstraintId[] = e.constraints.filter((x) => !x.passed).map((x) => x.id)
          expect(e.failures).toEqual(expectedFailures)
          expect(e.status).toBe(acceptanceStatus(applicable, expectedFailures))
        }

        check(v, true) // value equals limit
        check(v / (1 + 1e-6), false) // value = limit·(1 + 1e-6)
        check(v / (1 + REL_TOL / 2), true) // value = limit·(1 + REL_TOL/2)
      }),
    )
  })
})
