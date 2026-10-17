import type { VibrationModelId } from '../../challenge/vibration/types'
import type { VibrationApplicabilityCode } from './constants'

// Vibration analysis result types (task 50.2; VIB-06, MM-03, MM-10). Independent of the beam
// `Analysis`, whose shape is frozen (D-39). Like torsion, a vibration analysis stores
// `modelVersion`. Every frequency is in Hz, every length in m and every ratio dimensionless.

/** One applicability finding, shaped like the beam's ApplicabilityIssue with vibration codes. */
export interface VibrationApplicabilityIssue {
  code: VibrationApplicabilityCode
  /** Student-facing text naming the unmodeled effect and comparing value with threshold. */
  message: string
  /** Computed metric value (dimensionless ratio). */
  value: number
  /** The exceeded threshold: the warning threshold for warnings, the not-applicable one otherwise. */
  threshold: number
}

export interface VibrationAnalysis {
  modelId: VibrationModelId
  modelVersion: 1
  /** True iff `notApplicableReasons` is empty, independent of `warnings`. */
  applicable: boolean
  /** Applicable but approaching model limits. */
  warnings: readonly VibrationApplicabilityIssue[]
  notApplicableReasons: readonly VibrationApplicabilityIssue[]
  /** Effects never modeled, always listed (VIB-12). */
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  /** k, N/m (copied from the design so displays and facts read stored values only). */
  stiffnessNPerM: number
  /** f_n = √(k/m)/2π, Hz. */
  naturalFrequencyHz: number
  /** ζ of the chosen material. */
  dampingRatio: number
  /** c = 2ζ√(k m), N·s/m (display-only). */
  dampingCoefficientNsPerM: number
  /** r_min = f_min/f_n. */
  frequencyRatioAtBandMin: number
  /** r_max = f_max/f_n. */
  frequencyRatioAtBandMax: number
  /** TR at clamp(f_n·r_p, f_min, f_max): the exact in-band maximum. */
  worstInBandTransmissibility: number
  /** Frequency of the in-band maximum, Hz. */
  worstInBandFrequencyHz: number
  /**
   * Isolation efficiency 1 − TR_worst at the worst in-band frequency (the UI shows it ×100 %).
   * Present only when TR_worst < 1; absent (never a placeholder) when the band is amplified (MM-10).
   */
  isolationEfficiency?: number
  /** TR at clamp(f_n·r_p, runUpFromHz, f_max): the peak over the whole excitation range. */
  peakTransmissibility: number
  /** Frequency of the transmissibility peak, Hz. */
  peakTransmissibilityFrequencyHz: number
  /** δ_st = m g/k, m. */
  staticDeflectionM: number
  /** Peak relative displacement amplitude Z = Y·Z/Y over the excitation range, m. */
  peakRelativeDisplacementM: number
  /** Frequency of the relative-displacement peak, Hz. */
  peakRelativeDisplacementFrequencyHz: number
  /** (δ_st + Z_peak)/linear stroke (the SPRING_STROKE metric). */
  strokeRatio: number
}

/** Analysis fields computed before the applicability check. */
export type VibrationAnalysisBase = Omit<VibrationAnalysis, 'applicable' | 'warnings' | 'notApplicableReasons'>

/** The subset of VibrationAnalysisBase the applicability checker reads. */
export type VibrationApplicabilityInput = Pick<VibrationAnalysisBase, 'strokeRatio' | 'dampingRatio'>
