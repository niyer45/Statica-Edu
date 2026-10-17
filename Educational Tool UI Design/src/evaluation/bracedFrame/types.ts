import type { BracedFrameDesign } from '../../geometry/bracedFrame/design'
import type { BracedFrameAnalysis } from '../../physics/bracedFrame/types'
import type { EvaluationStatus, ExplanationFact } from '../types'

// Braced frame evaluation types (task 49.2; BFR-07, MM-11, MM-12). The beam evaluation types are
// frozen (D-39) and unchanged; these follow the shared evaluation envelope (status, accepted,
// ordered constraints, failures, margins under `efficiency`, grounded facts) with frame ids.

/** The constraints in reporting order (BFR-07). roofDrift and utilization exist only when solved. */
export type BracedFrameConstraintId = 'stability' | 'roofDrift' | 'utilization' | 'mass' | 'applicability'

/** SI units of frame constraints; `ratio` is one of the MM-12 unit extensions. */
export type BracedFrameConstraintUnit = 'bool' | 'm' | 'ratio' | 'kg'

/**
 * One constraint check, with the same semantics as the beam ConstraintResult: numeric
 * constraints pass iff `withinLimit(value, limit)` and report `utilization = value / limit`
 * (unclamped); bool constraints have value 1 or 0, limit 1, utilization = value.
 */
export interface BracedFrameConstraintResult {
  id: BracedFrameConstraintId
  label: string
  value: number
  limit: number
  unit: BracedFrameConstraintUnit
  passed: boolean
  utilization: number
}

/**
 * Unclamped margins (BFR-07): massUsage always; driftUsage (|δ_roof| / limit) and maxUtilization
 * only for a solved frame. For a mechanism they are absent, never zero.
 */
export interface BracedFrameEfficiency {
  massUsage: number
  driftUsage?: number
  maxUtilization?: number
}

export interface BracedFrameEvaluation {
  status: EvaluationStatus
  accepted: boolean
  constraints: BracedFrameConstraintResult[]
  failures: BracedFrameConstraintId[]
  efficiency: BracedFrameEfficiency
  facts: ExplanationFact[]
}

/** The stored parts of a tested frame result that comparison facts read (any TestResult-like value). */
export interface BracedFrameComparable {
  designSnapshot: Readonly<BracedFrameDesign>
  analysis: Readonly<BracedFrameAnalysis>
  evaluation: Readonly<BracedFrameEvaluation>
}
