import { describe, expect, it } from 'vitest'
import { evaluateFatigue } from '../../src/evaluation/fatigue/evaluate'
import { FATIGUE_PRIMARY_METRIC } from '../../src/evaluation/fatigue/metrics'
import { classifyRatio } from '../../src/evaluation/prediction'
import { validateFatigueDesign } from '../../src/geometry/fatigue/validate'
import { analyzeFatigue } from '../../src/physics/fatigue/analyze'
import { fatigueApplicabilityMetrics } from '../../src/physics/fatigue/applicability'
import { SURFACE_FINISHES } from '../../src/physics/fatigue/constants'
import { fatigueFraction, neuberConstantSqrtMm } from '../../src/physics/fatigue/formulas'
import { FATIGUE_COMMON, FATIGUE_WORKSHEET, fatigueChallenge, relClose, worksheetFixture, type FatigueFixture } from './fatigue'

// Task 70: every worksheet row of Fatigue Analysis I at 1e-9 relative (FAT-19). Expected values are
// transcribed constants from the standalone script in .kiro/specs/fatigue-analysis-1/.

const ch = fatigueChallenge()
const MPA = 1e6

function run(f: FatigueFixture) {
  const analysis = analyzeFatigue(f.design, ch)
  return { analysis, evaluation: evaluateFatigue(f.design, analysis, ch) }
}

const expectRel = (actual: number | undefined, expected: number, what: string) => {
  expect(actual, what).toBeTypeOf('number')
  expect(relClose(actual as number, expected), `${what}: ${actual} vs ${expected}`).toBe(true)
}

describe('Fatigue Analysis I worksheet', () => {
  it('uses the worksheet constants', () => {
    expect(ch.material.ultimateStrengthPa).toBe(630e6)
    expect(ch.material.yieldStrengthPa).toBe(530e6)
    expect(ch.load).toEqual({ meanForceN: 3000, alternatingForceN: 2000, armM: 0.05 })
    expect(ch.reliability).toEqual({ percent: 90, factor: 0.897 })
    expect(ch.targetLifeCycles).toBe(2e5)
    expectRel(fatigueFraction(ch.material.ultimateStrengthPa), FATIGUE_COMMON.f, 'f')
    expect(neuberConstantSqrtMm(ch.material.ultimateStrengthPa)).toBeCloseTo(FATIGUE_COMMON.sqrtAMm, 12)
    expectRel(SURFACE_FINISHES.asForged.aMpa, FATIGUE_COMMON.asForgedAMpa, 'as-forged a')
  })

  it.each(FATIGUE_WORKSHEET.map((f) => [f.name, f] as const))('%s matches the worksheet', (_name, f) => {
    expect(validateFatigueDesign(f.design, ch)).toEqual([])
    const { analysis: a, evaluation: e } = run(f)
    const x = f.expected
    expectRel(a.stressConcentrationKt, x.kt, 'Kt')
    expectRel(a.notchSensitivityQ, x.q, 'q')
    expectRel(a.fatigueNotchFactorKf, x.kf, 'Kf')
    expectRel(a.nominalAlternatingStressPa, x.saNomMpa * MPA, 'σa,0')
    expectRel(a.nominalMeanStressPa, x.smNomMpa * MPA, 'σm,0')
    expectRel(a.alternatingStressPa, x.saMpa * MPA, 'σa')
    expectRel(a.meanStressPa, x.smMpa * MPA, 'σm')
    expectRel(a.surfaceFactorKa, x.ka, 'ka')
    expectRel(a.sizeFactorKb, x.kb, 'kb')
    expectRel(a.unmodifiedEnduranceLimitPa, FATIGUE_COMMON.sePrimeMpa * MPA, "Se'")
    expectRel(a.enduranceLimitPa, x.seMpa * MPA, 'Se')
    expectRel(a.basquinCoefficientPa, x.a * MPA, 'a')
    expectRel(a.basquinExponent, x.b, 'b')
    expectRel(a.strengthAtTargetLifePa, x.sfMpa * MPA, 'S_t')
    expectRel(a.fatigueSafetyFactor, x.nf, 'n_f')
    expectRel(a.yieldSafetyFactor, x.ny, 'n_y')
    expectRel(a.equivalentReversedStressPa, x.srevMpa * MPA, 'σ_rev')
    if (x.life === 'inf') {
      expect(a.lifeRegime).toBe('infinite')
      expect('predictedLifeCycles' in a).toBe(false)
    } else if (x.life === 'none') {
      expect(a.lifeRegime).toBe('lowCycle')
      expect('predictedLifeCycles' in a).toBe(false)
    } else {
      expect(a.lifeRegime).toBe('finite')
      expectRel(a.predictedLifeCycles, x.life, 'life')
    }
    expectRel(a.shoulderFaceM, x.faceM, 'face')
    expectRel(a.massKg, x.massKg, 'mass')
    const m = fatigueApplicabilityMetrics(f.design, a, ch)
    for (const code of ['KT_FIT_RANGE', 'LOCAL_YIELD', 'LOW_CYCLE'] as const) expectRel(m[code], x.screens[code], code)
    expect(a.notApplicableReasons.map((i) => i.code)).toEqual(x.notApplicableCodes)
    expect(a.warnings).toEqual([])
    expect(e.status).toBe(x.status)
    expect(e.failures).toEqual(x.failures)
  })

  it('Baseline → reference raises the fatigue safety factor (prediction fixture)', () => {
    const base = run(worksheetFixture('baseline')).analysis
    const ref = run(worksheetFixture('reference')).analysis
    const r = FATIGUE_PRIMARY_METRIC.read(ref)! / FATIGUE_PRIMARY_METRIC.read(base)!
    expectRel(r, 1.40168491090465 / 0.622303118562314, 'ratio')
    expect(classifyRatio(r)).toBe('increase')
  })

  it('the bundled Baseline and reference are the worksheet rows', () => {
    expect(ch.initialDesign).toEqual(worksheetFixture('baseline').design)
    expect(ch.referenceDesign).toEqual(worksheetFixture('reference').design)
  })
})
