import type { AxialChallenge } from '../../challenge/axial/types'
import type { ParamRange, Result } from '../../challenge/types'
import type { AxialDesign } from './design'
import { validateAxialDesign, type AxialDesignError, type AxialValidationContext } from './validate'

// Hanger-rod edit operations (task 72; SSR-04, MM-09). Pure: inputs are never mutated; a changed
// design is always a new object. Semantics mirror the other models' clamp/strict edits:
//
//   setDiameter, clamp mode:  d is clamped into [minM, maxM]. A non-finite value leaves d
//                             unchanged (the edit still returns a new, valid design).
//   setDiameter, strict mode: d is replaced as given; the edit fails with every validator error
//                             for the candidate when it does not validate.
//   setMaterial:              the material id is replaced; an unlisted id fails with
//                             MATERIAL_NOT_ALLOWED. Diameter and material are independent.
//
// applyAxialEdit either returns a new design that passes validateAxialDesign or the errors for the
// candidate, so callers keep their draft unchanged on failure. Locked fields (length, load, factor,
// support) are challenge constants and no edit can reach them.

/** Design-level edits available to the student. */
export type AxialEdit =
  | { type: 'setDiameter'; valueM: number; mode: 'clamp' | 'strict' }
  | { type: 'setMaterial'; materialId: string }

/** Clamp-mode diameter: `valueM` clamped into the configured range; non-finite → `current`. */
export function clampDiameter(current: number, valueM: number, range: Pick<ParamRange, 'minM' | 'maxM'>): number {
  if (!Number.isFinite(valueM)) return current
  // If minM > maxM (inconsistent limits, rejected by the loader) the upper bound wins. `+ 0` normalizes −0.
  return Math.min(range.maxM, Math.max(range.minM, valueM)) + 0
}

/** The challenge fields applyAxialEdit reads. */
export type AxialEditContext = AxialValidationContext & Pick<AxialChallenge, 'diameterLimits'>

/**
 * Applies one edit to `draft`. Returns a new valid design, or every validator error for the
 * candidate (the caller keeps `draft`).
 */
export function applyAxialEdit(draft: AxialDesign, edit: AxialEdit, ch: AxialEditContext): Result<AxialDesign, AxialDesignError[]> {
  const candidate: AxialDesign =
    edit.type === 'setMaterial'
      ? { id: draft.id, diameterM: draft.diameterM, materialId: edit.materialId }
      : {
          id: draft.id,
          diameterM: edit.mode === 'clamp' ? clampDiameter(draft.diameterM, edit.valueM, ch.diameterLimits) : edit.valueM,
          materialId: draft.materialId,
        }
  const errors = validateAxialDesign(candidate, ch)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}
