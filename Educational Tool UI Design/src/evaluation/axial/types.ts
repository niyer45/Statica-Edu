import type { AxialDesign } from '../../geometry/axial/design'
import type { AxialAnalysis } from '../../physics/axial/types'
import type { EvaluationStatus, ExplanationFact } from '../types'

// Stress and Strain I evaluation types (task 72; SSR-07, MM-11, MM-12). The shared evaluation
// envelope (status, accepted, ordered constraints, failures, margins under `efficiency`, grounded
// facts) with rod ids.

/** The four checks, always reported in this order (SSR-07). */
export type AxialConstraintId = 'stress' | 'elongation' | 'mass' | 'applicability'

export type AxialConstraintUnit = 'Pa' | 'm' | 'kg' | 'bool'

/**
 * One check, with the shared ConstraintResult semantics: numeric checks pass iff
 * `withinLimit(value, limit)` and report `utilization = value / limit` (unclamped); the bool
 * applicability check has value 1 or 0, limit 1, utilization = value.
 */
export interface AxialConstraintResult {
  id: AxialConstraintId
  label: string
  value: number
  limit: number
  unit: AxialConstraintUnit
  passed: boolean
  utilization: number
}

/** Unclamped margins: massUsage > 1 or a negative margin means a limit was exceeded. */
export interface AxialEfficiency {
  massUsage: number
  stressMargin: number
  elongationMargin: number
}

export interface AxialEvaluation {
  status: EvaluationStatus
  accepted: boolean
  constraints: AxialConstraintResult[]
  failures: AxialConstraintId[]
  efficiency: AxialEfficiency
  facts: ExplanationFact[]
}

/** The stored parts of a tested rod result that comparison facts read. */
export interface AxialComparable {
  designSnapshot: Readonly<AxialDesign>
  analysis: Readonly<AxialAnalysis>
  evaluation: Readonly<AxialEvaluation>
}
