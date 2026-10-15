// Feature: engineering-intuition-mvp, Property 22: Not-applicable dominance
// **Validates: Requirements 10.8, 12.1**
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbDesign, arbHostileNumber, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Challenge } from '../challenge/types'
import type { BeamDesign } from '../geometry/sections'
import { APPLICABILITY_CODES } from '../physics/constants'
import { analyze } from '../physics/analyze'
import type { Analysis, ApplicabilityIssue } from '../physics/types'
import { CONSTRAINT_ORDER } from './constraints'
import { evaluate } from './evaluate'
import type { ConstraintId } from './types'

const ch = bundledChallenge()
type LimitKey = keyof Challenge['constraints']
const LIMIT_KEYS: readonly LimitKey[] = ['maxMassKg', 'maxDeflectionM', 'maxStressPa', 'maxWidthM', 'maxHeightM']
/** Which numeric constraint each limit governs. */
const LIMIT_OF: Record<LimitKey, ConstraintId> = {
  maxMassKg: 'mass',
  maxDeflectionM: 'deflection',
  maxStressPa: 'stress',
  maxWidthM: 'envelopeWidth',
  maxHeightM: 'envelopeHeight',
}

const arbFactor = fc.oneof(fc.constant(1), fc.double({ min: 0.25, max: 4, noNaN: true, noDefaultInfinity: true }))
const arbFactors = fc.tuple(...LIMIT_KEYS.map(() => arbFactor))

const arbIssue: fc.Arbitrary<ApplicabilityIssue> = fc.record({
  code: fc.constantFrom(...APPLICABILITY_CODES),
  message: fc.string({ maxLength: 20 }),
  value: fc.oneof(fc.double({ min: 0, max: 10, noNaN: true }), arbHostileNumber),
  threshold: fc.double({ min: 0, max: 1, noNaN: true }),
})
const arbIssues = fc.array(arbIssue, { maxLength: 4 })

/** Optional numeric override: keep the real value or replace it with a hostile number. */
const arbOverride = fc.option(arbHostileNumber, { nil: undefined })

function checkDominance(d: BeamDesign, a: Analysis, c: Challenge): void {
  expect(a.applicable).toBe(false)
  const e = evaluate(d, a, c)
  expect(e.status).toBe('modelNotApplicable')
  expect(e.accepted).toBe(false)
  expect(e.failures).toContain('applicability')
}

describe('Property 22: Not-applicable dominance', () => {
  it('applicable=false dominates under perturbed limits, hostile metrics, and any warnings', () => {
    assertProperty(
      fc.property(
        arbDesign(ch),
        arbFactors,
        arbIssues,
        arbIssues,
        arbOverride,
        arbOverride,
        arbOverride,
        (d, factors, warnings, reasons, oDefl, oStress, oMass) => {
          const c = structuredClone(ch)
          LIMIT_KEYS.forEach((k, i) => (c.constraints[k] = ch.constraints[k] * factors[i]))
          const real = analyze(d, c)
          const a: Analysis = {
            ...real,
            applicable: false,
            warnings,
            notApplicableReasons: reasons,
            tipDeflectionM: oDefl ?? real.tipDeflectionM,
            nominalMaxStressPa: oStress ?? real.nominalMaxStressPa,
            massKg: oMass ?? real.massKg,
          }
          checkDominance(d, a, c)
        },
      ),
    )
  })

  it('applicable=false dominates even when every other constraint passes', () => {
    assertProperty(
      fc.property(
        arbDesign(ch),
        fc.double({ min: 1, max: 4, noNaN: true, noDefaultInfinity: true }),
        arbIssues,
        (d, slack, warnings) => {
          // Loosen every limit to at least slack × the design's value so all numeric constraints pass.
          const probe = evaluate(d, { ...analyze(d, ch), applicable: true }, ch)
          const c = structuredClone(ch)
          for (const k of LIMIT_KEYS) {
            const v = probe.constraints.find((r) => r.id === LIMIT_OF[k])?.value ?? Number.NaN
            if (Number.isFinite(v)) c.constraints[k] = Math.max(ch.constraints[k], v * slack)
          }
          const real = analyze(d, c)
          const ok: Analysis = { ...real, applicable: true, warnings: [], notApplicableReasons: [] }
          const baseline = evaluate(d, ok, c)
          fc.pre(baseline.accepted)
          expect(baseline.status).toBe('accepted')

          const a: Analysis = { ...ok, applicable: false, warnings }
          const e = evaluate(d, a, c)
          checkDominance(d, a, c)
          // Only applicability flips; every other constraint is unchanged and still passes.
          expect(e.failures).toEqual(['applicability'])
          for (const id of CONSTRAINT_ORDER) {
            const r = e.constraints.find((x) => x.id === id)
            expect(r?.passed).toBe(id !== 'applicability')
          }
        },
      ),
    )
  })
})
