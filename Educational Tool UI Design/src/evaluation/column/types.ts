import type { ColumnDesign } from '../../geometry/column/design'
import type { ColumnAnalysis } from '../../physics/column/types'
import type { EvaluationStatus, ExplanationFact } from '../types'

// Column evaluation types (task 68; CBK-07, MM-11, MM-12). The beam evaluation types are frozen
// (D-39) and unchanged; these follow the shared evaluation envelope (status, accepted, ordered
// constraints, failures, margins under `efficiency`, grounded facts) with column ids.

/** The four constraints, always reported in this order. */
export type ColumnConstraintId = 'buckling' | 'axialStress' | 'mass' | 'applicability'

/** SI units of column constraints (MM-12 units plus newtons for the buckling load). */
export type ColumnConstraintUnit = 'N' | 'Pa' | 'kg' | 'bool'

/**
 * One constraint check. `sense` says how value and limit compare:
 *   max  passes iff `withinLimit(value, limit)` (value ≤ limit), utilization = value / limit;
 *   min  passes iff `withinLimit(limit, value)` (value ≥ limit), utilization = limit / value.
 * Utilization is therefore always demand over capacity: > 1 means the check fails. The bool
 * applicability constraint has value 1 or 0, limit 1, sense max, utilization = value.
 */
export interface ColumnConstraintResult {
  id: ColumnConstraintId
  label: string
  value: number
  limit: number
  unit: ColumnConstraintUnit
  sense: 'max' | 'min'
  passed: boolean
  utilization: number
}

/** Unclamped margins: massUsage > 1 or a negative margin means a limit was exceeded. */
export interface ColumnEfficiency {
  massUsage: number
  /** 1 − (required load) / P_cr. */
  bucklingMargin: number
  stressMargin: number
}

export interface ColumnEvaluation {
  status: EvaluationStatus
  accepted: boolean
  constraints: ColumnConstraintResult[]
  failures: ColumnConstraintId[]
  efficiency: ColumnEfficiency
  facts: ExplanationFact[]
}

/** The stored parts of a tested column result that comparison facts read (any TestResult-like value). */
export interface ColumnComparable {
  designSnapshot: Readonly<ColumnDesign>
  analysis: Readonly<ColumnAnalysis>
  evaluation: Readonly<ColumnEvaluation>
}
