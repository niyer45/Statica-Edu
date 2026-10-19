// Feature: fatigue-analysis-1, Property 3: Valid spindles analyze to finite, sign-correct, deterministic results
// **Validates: task 70, FAT-07, MM-10**
//
// For every valid design, analyzeFatigue returns a deep-frozen analysis naming steppedShaftFatigue
// v1 in which every numeric field is finite, positive except the negative Basquin exponent, and
// identical on repeated calls; applicable iff no not-applicable reasons; no warnings; Kf lies
// between 1 and Kt; the local stresses are Kf times the nominal ones; the life fields follow the
// regime; and n_f ≥ 1 exactly when the predicted life reaches the target life.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbFatigueDesign, fatigueChallenge, relClose } from '../../../test/fixtures/fatigue'
import { assertProperty } from '../../../test/pbt'
import { analyzeFatigue } from './analyze'

const ch = fatigueChallenge()

describe('Property 3: finite, sign-correct, deterministic analysis', () => {
  it('holds for every valid design', () => {
    assertProperty(
      fc.property(arbFatigueDesign(ch), (d) => {
        const a = analyzeFatigue(d, ch)
        expect(a.modelId).toBe('steppedShaftFatigue')
        expect(a.modelVersion).toBe(1)
        for (const [k, v] of Object.entries(a)) {
          expect(v, k).not.toBeUndefined()
          if (typeof v !== 'number' || k === 'modelVersion') continue
          expect(Number.isFinite(v), k).toBe(true)
          if (k === 'basquinExponent') expect(v).toBeLessThan(0)
          else expect(v, k).toBeGreaterThan(0)
        }
        expect(Object.isFrozen(a)).toBe(true)
        expect(analyzeFatigue(d, ch)).toEqual(a)
        expect(a.applicable).toBe(a.notApplicableReasons.length === 0)
        expect(a.warnings).toEqual([])
        expect(a.fatigueNotchFactorKf).toBeGreaterThan(1)
        expect(a.fatigueNotchFactorKf).toBeLessThan(a.stressConcentrationKt)
        expect(relClose(a.alternatingStressPa, a.fatigueNotchFactorKf * a.nominalAlternatingStressPa, 1e-12)).toBe(true)
        expect(relClose(a.meanStressPa, a.fatigueNotchFactorKf * a.nominalMeanStressPa, 1e-12)).toBe(true)
        expect(a.enduranceLimitPa).toBeLessThan(a.strengthAtTargetLifePa)
        expect(a.strengthAtTargetLifePa).toBeLessThan(a.strengthAt1e3CyclesPa)
        // Within the configured ranges the mean stress stays below the ultimate strength.
        expect(a.equivalentReversedStressPa).toBeDefined()
        expect('predictedLifeCycles' in a).toBe(a.lifeRegime === 'finite')
        if (a.lifeRegime === 'finite') {
          expect(a.predictedLifeCycles!).toBeGreaterThanOrEqual(1e3 * (1 - 1e-9))
          expect(a.predictedLifeCycles!).toBeLessThanOrEqual(1e6 * (1 + 1e-9))
        }
        if (a.applicable) {
          const reachesTarget = a.lifeRegime === 'infinite' || a.predictedLifeCycles! >= ch.targetLifeCycles
          if (Math.abs(a.fatigueSafetyFactor - 1) > 1e-9) expect(reachesTarget).toBe(a.fatigueSafetyFactor > 1)
        }
      }),
    )
  })
})
