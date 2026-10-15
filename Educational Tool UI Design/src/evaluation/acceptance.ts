import type { ConstraintId, ConstraintResult, EvaluationStatus } from './types'

// Acceptance status (Req 11.8, 12.1–12.4, 12.6, 12.10).
// Status depends only on the constraint results and `applicable`; analysis warnings
// never affect it.

/** Ids of failed constraints, in the order of `constraints` (Req 11.8). */
export function failuresOf(constraints: readonly ConstraintResult[]): ConstraintId[] {
  return constraints.filter((c) => !c.passed).map((c) => c.id)
}

/**
 * modelNotApplicable if the model does not apply, else accepted iff nothing failed.
 * Non-finite m, δ, or σ make their constraint fail, so they can never yield 'accepted' (Req 12.10).
 */
export function acceptanceStatus(applicable: boolean, failures: readonly ConstraintId[]): EvaluationStatus {
  if (applicable !== true) return 'modelNotApplicable'
  return failures.length === 0 ? 'accepted' : 'notAccepted'
}
