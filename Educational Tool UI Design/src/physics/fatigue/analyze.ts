import { deepFreeze } from '../../challenge/deepFreeze'
import { FATIGUE_MODEL_REF, type FatigueChallenge } from '../../challenge/fatigue/types'
import { shoulderHeightM, type FatigueDesign } from '../../geometry/fatigue/design'
import { PhysicsInvariantError } from '../analyze'
import { checkFatigueApplicability } from './applicability'
import { FATIGUE_ASSUMPTIONS, FATIGUE_UNSUPPORTED_EFFECTS, LOAD_FACTOR_BENDING, SURFACE_FINISHES, TEMPERATURE_FACTOR_ROOM } from './constants'
import {
  basquinConstants,
  cyclesAtStress,
  equivalentReversedStress,
  fatigueFraction,
  fatigueNotchFactor,
  fatigueStrengthAt,
  firstCycleYieldSafetyFactor,
  goodmanSafetyFactor,
  nominalBendingStress,
  nonRotatingEquivalentDiameter,
  notchSensitivity,
  shoulderFilletKt,
  sizeFactor,
  steppedSpindleMass,
  surfaceFactor,
  unmodifiedEnduranceLimit,
} from './formulas'
import type { FatigueAnalysis, FatigueAnalysisBase, FatigueLifeRegime } from './types'

// Stepped-spindle fatigue analysis entry point (task 70, model `steppedShaftFatigue` v1; MM-03,
// MM-10). Pure and deterministic: reads only the typed design and challenge, never mutates them.
//
//   Kt (Roark fit) → q (Neuber) → Kf; σa = Kf 32 M_a/(πd³), σm = Kf 32 M_m/(πd³);
//   Se = ka kb kc kd ke · 0.5 Sut; Basquin line (10³, f Sut)–(10⁶, Se); S_t = S_f(N_target);
//   n_f = 1/(σa/S_t + σm/Sut); n_y = Sy/(σa + σm); life from σ_rev = σa/(1 − σm/Sut).

export const FATIGUE_MODEL_ID = FATIGUE_MODEL_REF.id
export const FATIGUE_MODEL_VERSION = FATIGUE_MODEL_REF.version

/** Thrown when a computed value breaks its sign/finiteness invariant (MM-10); a reducer notice, no result. */
export class FatigueInvariantError extends PhysicsInvariantError {
  constructor(field: string, value: number) {
    super(field, value)
    this.name = 'FatigueInvariantError'
  }
}

/** Fields that must be finite and > 0, in check order. */
const POSITIVE_FIELDS = [
  'shoulderHeightM',
  'shoulderFaceM',
  'stressConcentrationKt',
  'notchSensitivityQ',
  'fatigueNotchFactorKf',
  'meanMomentNm',
  'alternatingMomentNm',
  'nominalMeanStressPa',
  'nominalAlternatingStressPa',
  'meanStressPa',
  'alternatingStressPa',
  'surfaceFactorKa',
  'sizeFactorKb',
  'equivalentDiameterM',
  'unmodifiedEnduranceLimitPa',
  'enduranceLimitPa',
  'fatigueFraction',
  'strengthAt1e3CyclesPa',
  'basquinCoefficientPa',
  'strengthAtTargetLifePa',
  'fatigueSafetyFactor',
  'yieldSafetyFactor',
  'massKg',
] as const satisfies readonly (keyof FatigueAnalysisBase)[]

/**
 * Analyzes a spindle design under the challenge load.
 *
 * Precondition: `validateFatigueDesign(d, ch)` returns `[]` (so r < (D − d)/2 and every value is
 * in range) and the challenge passed the loader. Otherwise a `FatigueInvariantError` naming the
 * first offending field may be thrown. The result is deep-frozen; `applicable` is true iff
 * `notApplicableReasons` is empty.
 */
export function analyzeFatigue(d: FatigueDesign, ch: FatigueChallenge): FatigueAnalysis {
  const sut = ch.material.ultimateStrengthPa
  const dn = d.neckDiameterM
  const finish = SURFACE_FINISHES[d.surfaceFinish]
  const h = shoulderHeightM(d)

  const kt = shoulderFilletKt(d.collarDiameterM, dn, d.filletRadiusM)
  const q = notchSensitivity(sut, d.filletRadiusM)
  const kf = fatigueNotchFactor(kt, q)
  const meanMomentNm = ch.load.meanForceN * ch.load.armM
  const alternatingMomentNm = ch.load.alternatingForceN * ch.load.armM
  const nominalMeanStressPa = nominalBendingStress(meanMomentNm, dn)
  const nominalAlternatingStressPa = nominalBendingStress(alternatingMomentNm, dn)
  const meanStressPa = kf * nominalMeanStressPa
  const alternatingStressPa = kf * nominalAlternatingStressPa

  const surfaceFactorKa = surfaceFactor(finish.aMpa, finish.b, sut)
  const equivalentDiameterM = nonRotatingEquivalentDiameter(dn)
  const sizeFactorKb = sizeFactor(equivalentDiameterM)
  const unmodifiedEnduranceLimitPa = unmodifiedEnduranceLimit(sut)
  const enduranceLimitPa = surfaceFactorKa * sizeFactorKb * LOAD_FACTOR_BENDING * TEMPERATURE_FACTOR_ROOM * ch.reliability.factor * unmodifiedEnduranceLimitPa

  const f = fatigueFraction(sut)
  const strengthAt1e3CyclesPa = f * sut
  const { coefficientPa, exponent } = basquinConstants(strengthAt1e3CyclesPa, enduranceLimitPa)
  const strengthAtTargetLifePa = fatigueStrengthAt(coefficientPa, exponent, ch.targetLifeCycles)

  let lifeRegime: FatigueLifeRegime = 'lowCycle'
  const life: { equivalentReversedStressPa?: number; predictedLifeCycles?: number } = {}
  if (meanStressPa < sut) {
    const reversed = equivalentReversedStress(alternatingStressPa, meanStressPa, sut)
    life.equivalentReversedStressPa = reversed
    if (reversed <= enduranceLimitPa) lifeRegime = 'infinite'
    else if (reversed <= strengthAt1e3CyclesPa) {
      lifeRegime = 'finite'
      life.predictedLifeCycles = cyclesAtStress(coefficientPa, exponent, reversed)
    }
  }

  const base: FatigueAnalysisBase = {
    modelId: FATIGUE_MODEL_ID,
    modelVersion: FATIGUE_MODEL_VERSION,
    unsupportedEffects: FATIGUE_UNSUPPORTED_EFFECTS,
    assumptions: FATIGUE_ASSUMPTIONS,
    shoulderHeightM: h,
    shoulderFaceM: h - d.filletRadiusM,
    stressConcentrationKt: kt,
    notchSensitivityQ: q,
    fatigueNotchFactorKf: kf,
    meanMomentNm,
    alternatingMomentNm,
    nominalMeanStressPa,
    nominalAlternatingStressPa,
    meanStressPa,
    alternatingStressPa,
    surfaceFactorKa,
    sizeFactorKb,
    equivalentDiameterM,
    unmodifiedEnduranceLimitPa,
    enduranceLimitPa,
    fatigueFraction: f,
    strengthAt1e3CyclesPa,
    basquinCoefficientPa: coefficientPa,
    basquinExponent: exponent,
    strengthAtTargetLifePa,
    fatigueSafetyFactor: goodmanSafetyFactor(alternatingStressPa, meanStressPa, strengthAtTargetLifePa, sut),
    yieldSafetyFactor: firstCycleYieldSafetyFactor(ch.material.yieldStrengthPa, alternatingStressPa, meanStressPa),
    ...life,
    lifeRegime,
    massKg: steppedSpindleMass(ch.material.densityKgM3, d.collarDiameterM, ch.geometry.collarLengthM, dn, ch.geometry.neckLengthM),
  }

  for (const field of POSITIVE_FIELDS) {
    const v = base[field]
    if (!Number.isFinite(v) || v <= 0) throw new FatigueInvariantError(field, v)
  }
  if (!Number.isFinite(base.basquinExponent) || base.basquinExponent >= 0) throw new FatigueInvariantError('basquinExponent', base.basquinExponent)
  for (const field of ['equivalentReversedStressPa', 'predictedLifeCycles'] as const) {
    const v = base[field]
    if (v !== undefined && (!Number.isFinite(v) || v <= 0)) throw new FatigueInvariantError(field, v)
  }

  const { warnings, notApplicable } = checkFatigueApplicability(d, base, ch)
  return deepFreeze({ ...base, applicable: notApplicable.length === 0, warnings, notApplicableReasons: notApplicable })
}
