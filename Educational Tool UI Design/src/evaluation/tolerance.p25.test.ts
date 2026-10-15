// Feature: engineering-intuition-mvp, Property 25: Non-finite never passes
// **Validates: Requirements 11.4, 12.10**
//
// C5 (constraint engine): withinLimit(NaN | ±Infinity, lim) = false, and likewise for a
// non-finite limit. Through evaluate(): an analysis whose δ, σ, or m is non-finite fails that
// constraint, all 7 constraints are still reported, and the result is never accepted.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbDesign, arbHostileNumber, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { analyze } from '../physics/analyze'
import type { Analysis } from '../physics/types'
import { CONSTRAINT_ORDER } from './constraints'
import { evaluate } from './evaluate'
import { REL_TOL, withinLimit } from './tolerance'
import type { ConstraintId } from './types'

const ch = bundledChallenge()

const NON_FINITE: readonly number[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
const arbNonFinite = fc.constantFrom(...NON_FINITE)

/** Hostile values mixed with ordinary doubles (finite or not). */
const arbMixed = fc.oneof(arbHostileNumber, fc.double(), fc.double({ min: -1e3, max: 1e3, noNaN: true }))

const NUMERIC_FIELDS = [
  { field: 'tipDeflectionM', id: 'deflection' },
  { field: 'nominalMaxStressPa', id: 'stress' },
  { field: 'massKg', id: 'mass' },
] as const satisfies readonly { field: keyof Analysis; id: ConstraintId }[]

describe('Property 25: Non-finite never passes', () => {
  it('withinLimit is false whenever value or limit is non-finite', () => {
    // Put a non-finite on one side (or both); the other side is any hostile/ordinary number.
    const arbPair = fc.oneof(
      fc.tuple(arbNonFinite, arbMixed),
      fc.tuple(arbMixed, arbNonFinite),
      fc.tuple(arbNonFinite, arbNonFinite),
    )
    assertProperty(
      fc.property(arbPair, fc.oneof(fc.constant(REL_TOL), fc.double({ min: 0, max: 1, noNaN: true })), ([v, lim], tol) => {
        expect(withinLimit(v, lim)).toBe(false)
        expect(withinLimit(v, lim, tol)).toBe(false)
      }),
    )
  })

  it('withinLimit on arbHostileNumber pairs: true implies both finite', () => {
    assertProperty(
      fc.property(arbMixed, arbMixed, (v, lim) => {
        if (withinLimit(v, lim)) {
          expect(Number.isFinite(v) && Number.isFinite(lim)).toBe(true)
        }
        if (!Number.isFinite(v) || !Number.isFinite(lim)) expect(withinLimit(v, lim)).toBe(false)
      }),
    )
  })

  it('evaluate: a non-finite δ, σ, or m fails that constraint, keeps 7 constraints, never accepts', () => {
    assertProperty(
      fc.property(
        arbDesign(ch),
        fc.constantFrom(...NUMERIC_FIELDS),
        arbNonFinite,
        fc.boolean(),
        (d, { field, id }, bad, applicable) => {
          const a: Analysis = { ...analyze(d, ch), [field]: bad, applicable }
          const ev = evaluate(d, a, ch)

          expect(ev.constraints.map((c) => c.id)).toEqual([...CONSTRAINT_ORDER])
          const c = ev.constraints.find((x) => x.id === id)
          expect(c?.passed).toBe(false)
          expect(Object.is(c?.value, bad)).toBe(true)
          expect(ev.failures).toContain(id)
          expect(ev.accepted).toBe(false)
          expect(ev.status).not.toBe('accepted')
          expect(ev.status).toBe(applicable ? 'notAccepted' : 'modelNotApplicable')
        },
      ),
    )
  })

  it('evaluate: a non-finite challenge limit fails that constraint and is never accepted', () => {
    const LIMITS = [
      { key: 'maxDeflectionM', id: 'deflection' },
      { key: 'maxStressPa', id: 'stress' },
      { key: 'maxMassKg', id: 'mass' },
    ] as const
    assertProperty(
      fc.property(arbDesign(ch), fc.constantFrom(...LIMITS), arbNonFinite, (d, { key, id }, bad) => {
        const edited = structuredClone(ch)
        edited.constraints = { ...edited.constraints, [key]: bad }
        const a = analyze(d, edited)
        const ev = evaluate(d, a, edited)
        expect(ev.constraints).toHaveLength(7)
        expect(ev.constraints.find((x) => x.id === id)?.passed).toBe(false)
        expect(ev.accepted).toBe(false)
      }),
    )
  })
})
