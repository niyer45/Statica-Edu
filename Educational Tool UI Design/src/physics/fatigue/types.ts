import type { FatigueModelId } from '../../challenge/fatigue/types'
import type { FatigueApplicabilityCode } from './constants'

// Fatigue analysis result types (task 70, model `steppedShaftFatigue` v1; MM-03, MM-10). Every
// numeric field is finite. All are > 0 except `basquinExponent` (< 0). `predictedLifeCycles` is
// present (as a key) only in the finite-life regime, so v2 saves re-analyze key-for-key (MM-18).

export interface FatigueApplicabilityIssue {
  code: FatigueApplicabilityCode
  /** Student-facing text naming the unmodeled effect and comparing value with threshold. */
  message: string
  value: number
  threshold: number
}

/**
 * Where the equivalent completely reversed stress falls on the S-N line:
 *   infinite  at or below the endurance limit (no failure predicted by the stress-life model);
 *   finite    between the endurance limit and the strength at 10³ cycles;
 *   lowCycle  above the strength at 10³ cycles (LOW_CYCLE screen, not applicable), or a mean
 *             stress at or above the ultimate strength.
 */
export type FatigueLifeRegime = 'infinite' | 'finite' | 'lowCycle'

export interface FatigueAnalysis {
  modelId: FatigueModelId
  modelVersion: 1
  /** True iff `notApplicableReasons` is empty. */
  applicable: boolean
  warnings: readonly FatigueApplicabilityIssue[]
  notApplicableReasons: readonly FatigueApplicabilityIssue[]
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  /** h = (D − d)/2, m. */
  shoulderHeightM: number
  /** Flat shoulder face h − r for the wheel hub, m (> 0 for valid designs). */
  shoulderFaceM: number
  /** Theoretical stress-concentration factor of the fillet in bending. */
  stressConcentrationKt: number
  notchSensitivityQ: number
  /** Kf = 1 + q (Kt − 1). */
  fatigueNotchFactorKf: number
  /** Bending moments at the shoulder, N·m. */
  meanMomentNm: number
  alternatingMomentNm: number
  /** Nominal neck stresses 32M/(πd³), Pa. */
  nominalMeanStressPa: number
  nominalAlternatingStressPa: number
  /** Local stresses at the fillet, Kf × nominal, Pa. */
  meanStressPa: number
  alternatingStressPa: number
  /** Marin factors and endurance limit. */
  surfaceFactorKa: number
  sizeFactorKb: number
  /** Equivalent diameter 0.370 d used for kb, m. */
  equivalentDiameterM: number
  unmodifiedEnduranceLimitPa: number
  enduranceLimitPa: number
  /** f and the strength f Sut at 10³ cycles. */
  fatigueFraction: number
  strengthAt1e3CyclesPa: number
  basquinCoefficientPa: number
  /** Negative slope of the S-N line on log-log axes. */
  basquinExponent: number
  /** Fatigue strength on the S-N line at the target life, Pa. */
  strengthAtTargetLifePa: number
  /** Modified Goodman safety factor at the target life. The checked fatigue value. */
  fatigueSafetyFactor: number
  /** Sy / (σa + σm), Kf applied. The checked yield value. */
  yieldSafetyFactor: number
  /** σa / (1 − σm/Sut), Pa; present whenever σm < Sut (always within the configured ranges). */
  equivalentReversedStressPa?: number
  lifeRegime: FatigueLifeRegime
  /** Cycles to failure on the S-N line; only in the finite-life regime. */
  predictedLifeCycles?: number
  massKg: number
}

/** Analysis fields computed before the applicability check. */
export type FatigueAnalysisBase = Omit<FatigueAnalysis, 'applicable' | 'warnings' | 'notApplicableReasons'>
