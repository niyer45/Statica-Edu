import type { VesselChallenge, VesselDesignLimits } from '../../challenge/vessel/types'
import type { Result } from '../../challenge/types'
import { VESSEL_PARAMS, type VesselDesign, type VesselParam } from './design'
import { validateVesselDesign, type VesselDesignError } from './validate'

// Pressure vessel edit operations (task 69; MM-09). Pure: inputs are never mutated; a changed
// design is always a new object. The existing clamp/strict semantics apply per parameter:
//   clamp   the value is clamped into the parameter's configured range [minM, maxM]; a
//           non-finite value leaves the parameter unchanged (as the other models do).
//   strict  only the parameter is replaced; it succeeds iff the candidate validates.
// The parameters are independent, so a clamp edit of a known parameter with a finite value always
// succeeds. The locked materialId is not editable through any edit.

/** Design-level edits available to the student. */
export type VesselEdit = { type: 'setParam'; param: string; valueM: number; mode: 'clamp' | 'strict' }

export function isVesselParam(param: string): param is VesselParam {
  return (VESSEL_PARAMS as readonly string[]).includes(param)
}

/** The range clamp mode clamps `param` into, or null for an unknown parameter. */
export function vesselPermissibleRange(param: string, limits: VesselDesignLimits): { minM: number; maxM: number } | null {
  if (!isVesselParam(param)) return null
  const r = limits[param]
  // Degenerate ranges (only for inconsistent limits) collapse to the upper bound.
  return r.minM > r.maxM ? { minM: r.maxM, maxM: r.maxM } : { minM: r.minM, maxM: r.maxM }
}

/**
 * Clamp-mode set of one parameter. Non-finite value or unknown param → returns `d` unchanged
 * (same object).
 */
export function clampVesselParam(d: VesselDesign, param: string, valueM: number, limits: VesselDesignLimits): VesselDesign {
  if (!Number.isFinite(valueM)) return d
  const r = vesselPermissibleRange(param, limits)
  if (r === null) return d
  // `+ 0` normalizes −0 to 0.
  return { ...d, [param]: Math.min(r.maxM, Math.max(r.minM, valueM)) + 0 }
}

function unknownParam(param: string): { ok: false; error: VesselDesignError[] } {
  return {
    ok: false,
    error: [{ code: 'UNKNOWN_PARAM', param, message: `"${param}" is not an adjustable dimension of the vessel.` }],
  }
}

/** The challenge fields applyVesselEdit reads. */
export type VesselEditContext = Pick<VesselChallenge, 'initialDesign' | 'designLimits'>

/**
 * Applies one edit to `draft`. Returns a new valid design, or every validator error for the
 * candidate (the caller keeps `draft`). An unknown parameter reports UNKNOWN_PARAM naming it.
 */
export function applyVesselEdit(
  draft: VesselDesign,
  edit: VesselEdit,
  ch: VesselEditContext,
): Result<VesselDesign, VesselDesignError[]> {
  if (!isVesselParam(edit.param)) return unknownParam(edit.param)
  const candidate: VesselDesign =
    edit.mode === 'strict'
      ? { ...draft, [edit.param]: edit.valueM }
      : { ...clampVesselParam(draft, edit.param, edit.valueM, ch.designLimits) }
  const errors = validateVesselDesign(candidate, ch)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}
