import { REL_TOL } from '../tolerance'

// Inclusive lower-bound comparison for heat sink constraints (task 48.2; HSK-07). The spec adds
// `withinLowerLimit` as a shared helper; physics/tolerance.ts is left unchanged, so it lives here
// with the heat sink evaluation until it is promoted. It mirrors the shared withinLimit exactly:
// same REL_TOL, slack taken from |limit| so the tolerance loosens (never tightens) the limit, and
// non-finite inputs never pass. physics/heatSink/applicability.ts screens the fin gap with the
// identical comparison expressed as withinLimit(−value, −limit) (tolerance.p8.test.ts).

/**
 * True iff `value` is at or above `limit`, inclusive, allowing a relative slack of `relTol`:
 * `value ≥ limit − |limit|·relTol`. Non-finite inputs never pass.
 *
 * Postconditions: monotone in `value`; `withinLowerLimit(lim, lim)` is true for any finite `lim`.
 */
export function withinLowerLimit(value: number, limit: number, relTol: number = REL_TOL): boolean {
  return (
    Number.isFinite(value) &&
    Number.isFinite(limit) &&
    value >= limit - Math.abs(limit) * relTol
  )
}
