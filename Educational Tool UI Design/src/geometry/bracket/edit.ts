import type { BracketChallenge, BracketDesignLimits } from '../../challenge/bracket/types'
import type { Result } from '../../challenge/types'
import { BRACKET_PARAMS, type BracketDesign, type BracketParam } from './design'
import { validateBracketDesign, type BracketDesignError } from './validate'

// L-bracket edit operations (task 55; MM-09). Pure: inputs are never mutated; a changed design is
// always a new object. The existing clamp/strict semantics apply per parameter:
//   clamp   the value is clamped into the parameter's configured range [minM, maxM]; a
//           non-finite value leaves the parameter unchanged (as clampParam/clampTorsionParam do).
//   strict  only the parameter is replaced; it succeeds iff the candidate validates.
// The parameters are independent (the loader guarantees every in-range combination is a
// buildable bracket), so a clamp edit of a known parameter with a finite value always succeeds.
// The locked materialId is not editable through any edit.

/** Design-level edits available to the student. */
export type BracketEdit = { type: 'setParam'; param: string; valueM: number; mode: 'clamp' | 'strict' }

export function isBracketParam(param: string): param is BracketParam {
  return (BRACKET_PARAMS as readonly string[]).includes(param)
}

/** The range clamp mode clamps `param` into, or null for an unknown parameter. */
export function bracketPermissibleRange(param: string, limits: BracketDesignLimits): { minM: number; maxM: number } | null {
  if (!isBracketParam(param)) return null
  const r = limits[param]
  // Degenerate ranges (only for inconsistent limits) collapse to the upper bound.
  return r.minM > r.maxM ? { minM: r.maxM, maxM: r.maxM } : { minM: r.minM, maxM: r.maxM }
}

/**
 * Clamp-mode set of one parameter. Non-finite value or unknown param → returns `d` unchanged
 * (same object).
 */
export function clampBracketParam(d: BracketDesign, param: string, valueM: number, limits: BracketDesignLimits): BracketDesign {
  if (!Number.isFinite(valueM)) return d
  const r = bracketPermissibleRange(param, limits)
  if (r === null) return d
  // `+ 0` normalizes −0 to 0.
  return { ...d, [param]: Math.min(r.maxM, Math.max(r.minM, valueM)) + 0 }
}

function unknownParam(param: string): { ok: false; error: BracketDesignError[] } {
  return {
    ok: false,
    error: [{ code: 'UNKNOWN_PARAM', param, message: `"${param}" is not an adjustable dimension of the bracket.` }],
  }
}

/** The challenge fields applyBracketEdit reads. */
export type BracketEditContext = Pick<BracketChallenge, 'initialDesign' | 'designLimits'>

/**
 * Applies one edit to `draft`. Returns a new valid design, or every validator error for the
 * candidate (the caller keeps `draft`). An unknown parameter reports UNKNOWN_PARAM naming it.
 */
export function applyBracketEdit(
  draft: BracketDesign,
  edit: BracketEdit,
  ch: BracketEditContext,
): Result<BracketDesign, BracketDesignError[]> {
  if (!isBracketParam(edit.param)) return unknownParam(edit.param)
  const candidate: BracketDesign =
    edit.mode === 'strict'
      ? { ...draft, [edit.param]: edit.valueM }
      : { ...clampBracketParam(draft, edit.param, edit.valueM, ch.designLimits) }
  const errors = validateBracketDesign(candidate, ch)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}
