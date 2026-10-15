// Feature: engineering-intuition-mvp, Property 21: Acceptance iff all pass
// **Validates: Requirements 11.8, 12.2, 12.3, 12.4**
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbDesign, arbHostileNumber, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Challenge } from '../challenge/types'
import { orientedEnvelope } from '../geometry/envelope'
import type { BeamDesign } from '../geometry/sections'
import { validateDesign } from '../geometry/validate'
import { analyze } from '../physics/analyze'
import type { Analysis } from '../physics/types'
import { CONSTRAINT_ORDER } from './constraints'
import { evaluate } from './evaluate'
import { withinLimit } from './tolerance'
import type { ConstraintId } from './types'

const ch = bundledChallenge()
type LimitKey = keyof Challenge['constraints']
const LIMIT_KEYS: readonly LimitKey[] = ['maxMassKg', 'maxDeflectionM', 'maxStressPa', 'maxWidthM', 'maxHeightM']

/** Per-limit scale factor in [0.25, 4], or 1 (unperturbed) so the bundled limits are also covered. */
const arbFactor = fc.oneof(fc.constant(1), fc.double({ min: 0.25, max: 4, noNaN: true, noDefaultInfinity: true }))
const arbFactors = fc.tuple(...LIMIT_KEYS.map(() => arbFactor))

function perturbed(factors: readonly number[]): Challenge {
  const copy = structuredClone(ch)
  LIMIT_KEYS.forEach((k, i) => (copy.constraints[k] = ch.constraints[k] * factors[i]))
  return copy
}

/** Optional override: keep the real value, or replace it with a scaled / hostile number. */
const arbOverride = fc.option(
  fc.oneof(fc.double({ min: 0.25, max: 4, noNaN: true, noDefaultInfinity: true }).map((s) => ({ scale: s })), arbHostileNumber.map((v) => ({ value: v }))),
  { nil: undefined },
)
const apply = (real: number, o: { scale: number } | { value: number } | undefined) =>
  o === undefined ? real : 'scale' in o ? real * o.scale : o.value

/** Independently derived expected failures, in CONSTRAINT_ORDER. */
function expectedFailures(d: BeamDesign, a: Analysis, c: Challenge): ConstraintId[] {
  const k = c.constraints
  const env = orientedEnvelope(d.section, d.orientationDeg)
  const passed: Record<ConstraintId, boolean> = {
    deflection: withinLimit(a.tipDeflectionM, k.maxDeflectionM),
    stress: withinLimit(a.nominalMaxStressPa, k.maxStressPa),
    mass: withinLimit(a.massKg, k.maxMassKg),
    envelopeWidth: withinLimit(env.widthZM, k.maxWidthM),
    envelopeHeight: withinLimit(env.heightYM, k.maxHeightM),
    featureGeometry: validateDesign(d, c).length === 0,
    applicability: a.applicable === true,
  }
  return CONSTRAINT_ORDER.filter((id) => !passed[id])
}

function checkInvariant(d: BeamDesign, a: Analysis, c: Challenge): void {
  const e = evaluate(d, a, c)
  expect(e.constraints.map((r) => r.id)).toEqual([...CONSTRAINT_ORDER])
  const failed = e.constraints.filter((r) => !r.passed).map((r) => r.id)
  expect(e.failures).toEqual(failed)
  expect(e.failures).toEqual(expectedFailures(d, a, c))
  const allPass = e.constraints.every((r) => r.passed)
  expect(e.accepted).toBe(a.applicable === true && allPass)
  expect(e.accepted).toBe(e.status === 'accepted')
}

describe('Property 21: Acceptance iff all pass', () => {
  it('real analyses under bundled and perturbed limits', () => {
    assertProperty(
      fc.property(arbDesign(ch), arbFactors, (d, factors) => {
        const c = perturbed(factors)
        checkInvariant(d, analyze(d, c), c)
      }),
    )
  })

  it('analyses with overridden applicable / δ / σ / m under perturbed limits', () => {
    assertProperty(
      fc.property(
        arbDesign(ch),
        arbFactors,
        fc.boolean(),
        arbOverride,
        arbOverride,
        arbOverride,
        (d, factors, applicable, oDefl, oStress, oMass) => {
          const c = perturbed(factors)
          const real = analyze(d, c)
          const a: Analysis = {
            ...real,
            applicable,
            tipDeflectionM: apply(real.tipDeflectionM, oDefl),
            nominalMaxStressPa: apply(real.nominalMaxStressPa, oStress),
            massKg: apply(real.massKg, oMass),
          }
          checkInvariant(d, a, c)
        },
      ),
    )
  })
})
