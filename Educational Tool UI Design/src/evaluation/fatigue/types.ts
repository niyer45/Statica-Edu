import type { FatigueDesign } from '../../geometry/fatigue/design'
import type { FatigueAnalysis } from '../../physics/fatigue/types'
import type { EvaluationStatus, ExplanationFact } from '../types'

// Fatigue evaluation types (task 70; FAT-09, MM-11, MM-12). The shared evaluation envelope with
// fatigue ids. Lower bounds (safety factors, shoulder face) mirror the heat sink's `bound`
// convention: upper bounds pass iff withinLimit(value, limit) with utilization value/limit; lower
// bounds pass iff withinLowerLimit(value, limit) with utilization limit/value, so utilization > 1
// means a limit was exceeded either way.

export type FatigueConstraintId = 'fatigueSafetyFactor' | 'yieldSafetyFactor' | 'mass' | 'shoulderFace' | 'applicability'

export type FatigueConstraintUnit = 'ratio' | 'kg' | 'm' | 'bool'

export interface FatigueConstraintResult {
  id: FatigueConstraintId
  label: string
  value: number
  limit: number
  unit: FatigueConstraintUnit
  bound: 'upper' | 'lower'
  passed: boolean
  utilization: number
}

/** Unclamped margins: a negative margin or massUsage > 1 means a limit was exceeded. */
export interface FatigueEfficiency {
  /** n_f / n_f,min − 1. */
  fatigueMargin: number
  /** n_y / n_y,min − 1. */
  yieldMargin: number
  massUsage: number
  /** s − s_min, m. */
  shoulderFaceMarginM: number
}

export interface FatigueEvaluation {
  status: EvaluationStatus
  accepted: boolean
  constraints: FatigueConstraintResult[]
  failures: FatigueConstraintId[]
  efficiency: FatigueEfficiency
  facts: ExplanationFact[]
}

export interface FatigueComparable {
  designSnapshot: Readonly<FatigueDesign>
  analysis: Readonly<FatigueAnalysis>
  evaluation: Readonly<FatigueEvaluation>
}
