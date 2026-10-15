// Inclusive limit comparison with relative tolerance (design D-09).
// Lives in physics/ so the applicability checker can use it without importing
// evaluation/ (Req 1.7). evaluation/ re-exports these symbols.

/** Relative tolerance for all hard-limit and threshold comparisons. */
export const REL_TOL = 1e-9

/**
 * True iff `value` is within `limit`, inclusive, allowing a relative slack of
 * `relTol`. Non-finite inputs never pass (Req 11.4).
 *
 * Limits in this app are always positive, where this equals the design's
 * `value <= limit * (1 + relTol)`. The slack is computed from `|limit|` so the
 * tolerance loosens the limit (never tightens it) for any sign of `limit`.
 *
 * Postconditions: monotone in `value`; `withinLimit(lim, lim)` is true for any
 * finite `lim`.
 */
export function withinLimit(value: number, limit: number, relTol: number = REL_TOL): boolean {
  return (
    Number.isFinite(value) &&
    Number.isFinite(limit) &&
    value <= limit + Math.abs(limit) * relTol
  )
}
