import type { VibrationDesign } from '../../geometry/vibration/design'
import type { VibrationAnalysis } from '../../physics/vibration/types'
import type { EvaluationStatus, ExplanationFact } from '../types'

// Vibration evaluation types (task 50.2; VIB-07, MM-11, MM-12). The beam evaluation types are
// frozen (D-39) and unchanged; these follow the shared evaluation envelope (status, accepted,
// ordered constraints, failures, margins under `efficiency`, grounded facts) with vibration ids.

/** The five constraints, always reported in this order (VIB-07). */
export type VibrationConstraintId =
  | 'worstInBandTransmissibility'
  | 'staticDeflection'
  | 'peakTransmissibility'
  | 'relativeDisplacement'
  | 'applicability'

/** SI units of vibration constraints; `ratio` is one of the MM-12 unit extensions. No constraint uses Hz. */
export type VibrationConstraintUnit = 'ratio' | 'm' | 'bool'

/**
 * One constraint check, with the same semantics as the beam ConstraintResult: numeric
 * constraints pass iff `withinLimit(value, limit)` and report `utilization = value / limit`
 * (unclamped); the bool applicability constraint has value 1 or 0, limit 1, utilization = value.
 */
export interface VibrationConstraintResult {
  id: VibrationConstraintId
  label: string
  value: number
  limit: number
  unit: VibrationConstraintUnit
  passed: boolean
  utilization: number
}

/**
 * Unclamped margins (VIB-07): a negative isolationMargin or a usage above 1 means a limit was
 * exceeded.
 */
export interface VibrationEfficiency {
  /** 1 − TR_worst / limit. */
  isolationMargin: number
  /** δ_st / limit. */
  sagUsage: number
  /** Z_peak / clearance limit. */
  clearanceUsage: number
}

export interface VibrationEvaluation {
  status: EvaluationStatus
  accepted: boolean
  constraints: VibrationConstraintResult[]
  failures: VibrationConstraintId[]
  efficiency: VibrationEfficiency
  facts: ExplanationFact[]
}

/** The stored parts of a tested vibration result that comparison facts read (any TestResult-like value). */
export interface VibrationComparable {
  designSnapshot: Readonly<VibrationDesign>
  analysis: Readonly<VibrationAnalysis>
  evaluation: Readonly<VibrationEvaluation>
}
