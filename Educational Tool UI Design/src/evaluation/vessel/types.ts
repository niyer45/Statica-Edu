import type { VesselDesign } from '../../geometry/vessel/design'
import type { VesselAnalysis } from '../../physics/vessel/types'
import type { EvaluationStatus, ExplanationFact } from '../types'

// Pressure vessel evaluation types (task 69; MM-11, MM-12). The beam evaluation types are frozen
// (D-39) and unchanged; these follow the shared evaluation envelope (status, accepted, ordered
// constraints, failures, margins under `efficiency`, grounded facts) with vessel ids.

/** The seven constraints, always reported in this order (PVS-07). */
export type VesselConstraintId =
  | 'hoopStress'
  | 'longitudinalStress'
  | 'headStress'
  | 'volume'
  | 'overallLength'
  | 'mass'
  | 'applicability'

/** SI units of vessel constraints (MM-12 units plus cubic metres for the volume). */
export type VesselConstraintUnit = 'Pa' | 'm3' | 'm' | 'kg' | 'bool'

/**
 * One constraint check. `bound: 'max'` checks pass iff `withinLimit(value, limit)` and report
 * `utilization = value / limit`; the volume is a `bound: 'min'` check that passes iff
 * `withinLimit(limit, value)` and reports `utilization = limit / value`, so utilization ≤ 1 means
 * pass for every check (unclamped). The bool applicability constraint has value 1 or 0, limit 1,
 * utilization = value.
 */
export interface VesselConstraintResult {
  id: VesselConstraintId
  label: string
  value: number
  limit: number
  unit: VesselConstraintUnit
  bound: 'max' | 'min'
  passed: boolean
  utilization: number
}

/** Unclamped margins: massUsage > 1 or a negative margin means a limit was missed. */
export interface VesselEfficiency {
  massUsage: number
  /** 1 − σ_h / σ_a. */
  hoopMargin: number
  /** 1 − σ_head / σ_a. */
  headMargin: number
  /** V / V_min − 1. */
  volumeMargin: number
}

export interface VesselEvaluation {
  status: EvaluationStatus
  accepted: boolean
  constraints: VesselConstraintResult[]
  failures: VesselConstraintId[]
  efficiency: VesselEfficiency
  facts: ExplanationFact[]
}

/** The stored parts of a tested vessel result that comparison facts read (any TestResult-like value). */
export interface VesselComparable {
  designSnapshot: Readonly<VesselDesign>
  analysis: Readonly<VesselAnalysis>
  evaluation: Readonly<VesselEvaluation>
}
