import type { BracketDesign } from '../../geometry/bracket/design'
import type { BracketAnalysis } from '../../physics/bracket/types'
import type { EvaluationStatus, ExplanationFact } from '../types'

// Bracket evaluation types (task 55 L-bracket; MM-11, MM-12). The beam evaluation types are frozen
// (D-39) and unchanged; these follow the shared evaluation envelope (status, accepted, ordered
// constraints, failures, margins under `efficiency`, grounded facts) with bracket ids.

/** The five constraints, always reported in this order. */
export type BracketConstraintId = 'bendStress' | 'deflection' | 'boltTension' | 'mass' | 'applicability'

/** SI units of bracket constraints (MM-12 units plus newtons for the bolt force). */
export type BracketConstraintUnit = 'Pa' | 'm' | 'N' | 'kg' | 'bool'

/**
 * One constraint check, with the same semantics as the beam ConstraintResult: numeric
 * constraints pass iff `withinLimit(value, limit)` and report `utilization = value / limit`
 * (unclamped); the bool applicability constraint has value 1 or 0, limit 1, utilization = value.
 */
export interface BracketConstraintResult {
  id: BracketConstraintId
  label: string
  value: number
  limit: number
  unit: BracketConstraintUnit
  passed: boolean
  utilization: number
}

/** Unclamped margins: massUsage > 1 or a negative margin means a limit was exceeded. */
export interface BracketEfficiency {
  massUsage: number
  stressMargin: number
  deflectionMargin: number
  boltMargin: number
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
