import type { Orientation, BeamDesign } from '../geometry/sections'
import type { SectionKind } from '../challenge/types'
import type { Analysis } from '../physics/types'

// Evaluation domain types (design "Component: evaluation/" and "Component: state/").
// TestResult, Prediction, and PredictionOutcome live here so evaluation/ never imports
// state/ (Req 1.5); state/ re-exports them.

/** The seven constraints, always reported in this order (Req 11.1). */
export type ConstraintId =
  | 'deflection'
  | 'stress'
  | 'mass'
  | 'envelopeWidth'
  | 'envelopeHeight'
  | 'featureGeometry'
  | 'applicability'

export type ConstraintUnit = 'm' | 'Pa' | 'kg' | 'bool'

/**
 * One constraint check.
 *
 * Numeric constraints (unit m / Pa / kg): `value` and `limit` in SI, `passed` iff
 * `withinLimit(value, limit)`, `utilization = value / limit` (may be non-finite when the
 * inputs are; never clamped).
 *
 * Boolean constraints (unit 'bool': featureGeometry, applicability): `value` is 1 when the
 * condition holds and 0 otherwise, `limit` is always 1, `passed` iff `value === 1`, and
 * `utilization = value / limit` (so 1 for a pass, 0 for a failure). For bool constraints
 * utilization is a pass indicator, not a margin; UIs should not show it as a percentage.
 */
export interface ConstraintResult {
  id: ConstraintId
  label: string
  value: number
  limit: number
  unit: ConstraintUnit
  passed: boolean
  utilization: number
}

export type EvaluationStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

/** Unclamped efficiency indicators (Req 12.5): massUsage > 1 or margins < 0 mean a limit was exceeded. */
export interface Efficiency {
  massUsage: number
  deflectionMargin: number
  stressMargin: number
}

/**
 * A grounded explanation fact (Req 13.1, 13.2). Every `basis` value is finite and copied
 * from an Analysis / constraint result (or a ratio of two such values). Every number in
 * `text` is a `basis` value formatted with `formatBasis` (see explain.ts).
 */
export interface ExplanationFact {
  id: string
  text: string
  basis: Record<string, number>
}

export interface Evaluation {
  status: EvaluationStatus
  accepted: boolean
  constraints: ConstraintResult[]
  failures: ConstraintId[]
  efficiency: Efficiency
  facts: ExplanationFact[]
}

export type PredictionDirection = 'increase' | 'decrease' | 'same'

export interface Prediction {
  iteration: number
  direction: PredictionDirection
  explanation?: string
  createdAt: string
}

export interface PredictionOutcome {
  predicted: PredictionDirection
  actual: PredictionDirection
  /** next tip deflection / previous tip deflection. */
  ratio: number
  matched: boolean
}

export interface TestResult {
  id: string
  /** 0 = baseline. */
  iteration: number
  /** Display label, e.g. "Baseline" for iteration 0 (Req 15.1). */
  label?: string
  designSnapshot: Readonly<BeamDesign>
  analysis: Readonly<Analysis>
  evaluation: Readonly<Evaluation>
  accepted: boolean
  failures: ConstraintId[]
  prediction?: Prediction
  predictionOutcome?: PredictionOutcome
  timestamp: string
}

/** Signed change of one metric between two Test_Results. */
export interface MetricDelta {
  prev: number
  next: number
  /** next − prev. */
  delta: number
  /** next / prev. */
  ratio: number
}

export type ComparedMetric =
  | 'areaM2'
  | 'bendingInertiaM4'
  | 'massKg'
  | 'tipDeflectionM'
  | 'nominalMaxStressPa'

/** A constraint whose pass state differs between the two compared results. */
export interface ConstraintChange {
  id: ConstraintId
  label: string
  prevPassed: boolean
  nextPassed: boolean
}

export interface SectionState {
  kind: SectionKind
  orientationDeg: Orientation
}

/** Output of `compareResults(prev, next)` (implemented in task 10.7). */
export interface ComparisonDelta {
  prevId: string
  nextId: string
  metrics: Record<ComparedMetric, MetricDelta>
  /** Only constraints whose pass state changed, in the fixed constraint order. */
  constraintChanges: ConstraintChange[]
  section: { prev: SectionState; next: SectionState; changed: boolean }
  status: { prev: EvaluationStatus; next: EvaluationStatus }
}
