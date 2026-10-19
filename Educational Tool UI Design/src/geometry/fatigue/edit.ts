import type { FatigueChallenge, FatigueDesignLimits } from '../../challenge/fatigue/types'
import type { Result } from '../../challenge/types'
import { FATIGUE_PARAMS, type FatigueDesign, type FatigueParam } from './design'
import { validateFatigueDesign, type FatigueDesignError } from './validate'

// Stepped-spindle edit operations (task 70; MM-09). Pure: inputs are never mutated; a changed
// design is always a new object.
//   setParam clamp   the value is clamped into the dimension's configured range; a non-finite
//                    value leaves it unchanged.
//   setParam strict  only the dimension is replaced.
//   setFinish        replaces the surface finish.
// Either way the candidate must validate, including the coupled rule that the fillet fits inside
// the step; otherwise every validator error is returned and the caller keeps the draft.

export type FatigueEdit =
  | { type: 'setParam'; param: string; valueM: number; mode: 'clamp' | 'strict' }
  | { type: 'setFinish'; finish: string }

export function isFatigueParam(param: string): param is FatigueParam {
  return (FATIGUE_PARAMS as readonly string[]).includes(param)
}

/** The range clamp mode clamps `param` into, or null for an unknown parameter. */
export function fatiguePermissibleRange(param: string, limits: FatigueDesignLimits): { minM: number; maxM: number } | null {
  if (!isFatigueParam(param)) return null
  const r = limits[param]
  return r.minM > r.maxM ? { minM: r.maxM, maxM: r.maxM } : { minM: r.minM, maxM: r.maxM }
}

/** Clamp-mode set of one dimension. Non-finite value or unknown param → `d` unchanged (same object). */
export function clampFatigueParam(d: FatigueDesign, param: string, valueM: number, limits: FatigueDesignLimits): FatigueDesign {
  if (!Number.isFinite(valueM)) return d
  const r = fatiguePermissibleRange(param, limits)
  if (r === null) return d
  return { ...d, [param]: Math.min(r.maxM, Math.max(r.minM, valueM)) + 0 }
}

/** The challenge fields applyFatigueEdit reads. */
export type FatigueEditContext = Pick<FatigueChallenge, 'initialDesign' | 'designLimits' | 'allowedFinishes'>

/** Applies one edit. Returns a new valid design, or every validator error for the candidate. */
export function applyFatigueEdit(draft: FatigueDesign, edit: FatigueEdit, ch: FatigueEditContext): Result<FatigueDesign, FatigueDesignError[]> {
  let candidate: FatigueDesign
  if (edit.type === 'setFinish') {
    candidate = { ...draft, surfaceFinish: edit.finish as FatigueDesign['surfaceFinish'] }
  } else {
    if (!isFatigueParam(edit.param)) {
      return { ok: false, error: [{ code: 'UNKNOWN_PARAM', param: edit.param, message: `"${edit.param}" is not an adjustable dimension of the spindle.` }] }
    }
    candidate = edit.mode === 'strict' ? { ...draft, [edit.param]: edit.valueM } : { ...clampFatigueParam(draft, edit.param, edit.valueM, ch.designLimits) }
  }
  const errors = validateFatigueDesign(candidate, ch)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}
