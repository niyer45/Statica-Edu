import type { BracketDesign } from '../../geometry/bracket/design'
import type { BracketAnalysis } from '../../physics/bracket/types'
import type { EvaluationStatus, ExplanationFact } from '../types'

// Bracket evaluation types (task 46.2; MBR-08, MM-11, MM-12). The beam evaluation types are
// frozen (D-39) and unchanged; these follow the shared evaluation envelope (status, accepted,
// ordered constraints, failures, margins under `efficiency`, grounded facts) with bracket ids.

/** The five constraints, always reported in this order (MBR-08). */
export type BracketConstraintId = 'peakStress' | 'tipDeflection' | 'mass' | 'envelopeDepth' | 'applicability'

/** SI units of bracket constraints (existing MM-12 units). */
export type BracketConstraintUnit = 'Pa' | 'm' | 'kg' | 'bool'

/**
 * One constraint check, with the same semantics as the beam ConstraintResult: numeric
 * constraints pass iff `withinLimit(value, limit)` and report `utilization = value / limit`
 * (unclamped); the bool applicability constraint has value 1 or 0, limit 1, utilization = value.
 * When the peak stress is undefined (Kt fit undefined, MBR-13), `peakStress` omits `value` and
 * `utilization` and does not pass (MBR-08).
 */
export interface BracketConstraintResult {
  id: BracketConstraintId
  label: string
  value?: number
  limit: number
  unit: BracketConstraintUnit
  passed: boolean
  utilization?: number
}

/**
 * Unclamped margins (MBR-08): massUsage > 1 or a negative margin means a limit was exceeded.
 * `stressMargin` is omitted when the peak stress is undefined.
 */
export interface BracketEfficiency {
  massUsage: number
  stressMargin?: number
  deflectionMargin: number
}

export interface BracketEvaluation {
  status: EvaluationStatus
  accepted: boolean
  constraints: BracketConstraintResult[]
  failures: BracketConstraintId[]
  efficiency: BracketEfficiency
  facts: ExplanationFact[]
}

/** The stored parts of a tested bracket result that comparison facts read (any TestResult-like value). */
export interface BracketComparable {
  designSnapshot: Readonly<BracketDesign>
  analysis: Readonly<BracketAnalysis>
  evaluation: Readonly<BracketEvaluation>
}
