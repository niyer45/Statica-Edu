import type { TorsionDesign } from '../../geometry/torsion/design'
import type { TorsionAnalysis } from '../../physics/torsion/types'
import type { EvaluationStatus, ExplanationFact } from '../types'

// Torsion evaluation types (task 47.2; TSH-07, MM-11, MM-12). The beam evaluation types are
// frozen (D-39) and unchanged; these follow the shared evaluation envelope (status, accepted,
// ordered constraints, failures, margins under `efficiency`, grounded facts) with torsion ids.

/** The five constraints, always reported in this order (TSH-07). */
export type TorsionConstraintId = 'twist' | 'shearStress' | 'mass' | 'outerDiameter' | 'applicability'

/** SI units of torsion constraints; `rad` is one of the MM-12 unit extensions. */
export type TorsionConstraintUnit = 'rad' | 'Pa' | 'kg' | 'm' | 'bool'

/**
 * One constraint check, with the same semantics as the beam ConstraintResult: numeric
 * constraints pass iff `withinLimit(value, limit)` and report `utilization = value / limit`
 * (unclamped); the bool applicability constraint has value 1 or 0, limit 1, utilization = value.
 */
export interface TorsionConstraintResult {
  id: TorsionConstraintId
  label: string
  value: number
  limit: number
  unit: TorsionConstraintUnit
  passed: boolean
  utilization: number
}

/** Unclamped margins (TSH-07): massUsage > 1 or a negative margin means a limit was exceeded. */
export interface TorsionEfficiency {
  massUsage: number
  twistMargin: number
  stressMargin: number
}

export interface TorsionEvaluation {
  status: EvaluationStatus
  accepted: boolean
  constraints: TorsionConstraintResult[]
  failures: TorsionConstraintId[]
  efficiency: TorsionEfficiency
  facts: ExplanationFact[]
}

/** The stored parts of a tested torsion result that comparison facts read (any TestResult-like value). */
export interface TorsionComparable {
  designSnapshot: Readonly<TorsionDesign>
  analysis: Readonly<TorsionAnalysis>
  evaluation: Readonly<TorsionEvaluation>
}
