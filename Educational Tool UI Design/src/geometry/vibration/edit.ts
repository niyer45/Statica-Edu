import type { StiffnessLimits, VibrationChallenge } from '../../challenge/vibration/types'
import type { Result } from '../../challenge/types'
import type { VibrationDesign } from './design'
import { validateVibrationDesign, type VibrationDesignError } from './validate'

// Vibration isolator edit operations (task 50.2; VIB-04, MM-09). Pure: inputs are never mutated;
// a changed design is always a new object. Semantics mirror the beam and torsion clamp/strict
// edits:
//
//   setStiffness, clamp mode:  k is clamped into [minNPerM, maxNPerM]. A non-finite value leaves
//                              k unchanged (the edit is a no-op that still returns a new design).
//   setStiffness, strict mode: k is replaced as given; the edit fails with every validator error
//                              for the candidate when it does not validate.
//   setMaterial:               the material id is replaced; an unlisted id fails with
//                              MATERIAL_NOT_ALLOWED. Stiffness and material are independent.
//
// applyVibrationEdit either returns a new design that passes validateVibrationDesign or the
// errors for the candidate, so callers keep their draft unchanged on failure. Locked fields
// (mass, band, amplitude, stroke) are challenge constants and no edit can reach them.

/** Design-level edits available to the student. */
export type VibrationEdit =
  | { type: 'setStiffness'; valueNPerM: number; mode: 'clamp' | 'strict' }
  | { type: 'setMaterial'; materialId: string }

/** Clamp-mode stiffness: `valueNPerM` clamped into the configured range; non-finite → `current`. */
export function clampStiffness(current: number, valueNPerM: number, limits: StiffnessLimits): number {
  if (!Number.isFinite(valueNPerM)) return current
  // If minNPerM > maxNPerM (inconsistent limits, rejected by the loader) the upper bound wins.
  return Math.min(limits.maxNPerM, Math.max(limits.minNPerM, valueNPerM))
}

/** The challenge fields applyVibrationEdit reads. */
export type VibrationEditContext = Pick<VibrationChallenge, 'stiffnessLimits' | 'materials' | 'component' | 'excitation' | 'mount'>

/**
 * Applies one edit to `draft`. Returns a new valid design, or every validator error for the
 * candidate (the caller keeps `draft`).
 */
export function applyVibrationEdit(
  draft: VibrationDesign,
  edit: VibrationEdit,
  ch: VibrationEditContext,
): Result<VibrationDesign, VibrationDesignError[]> {
  const candidate: VibrationDesign =
    edit.type === 'setMaterial'
      ? { id: draft.id, stiffnessNPerM: draft.stiffnessNPerM, materialId: edit.materialId }
      : {
          id: draft.id,
          stiffnessNPerM: edit.mode === 'clamp' ? clampStiffness(draft.stiffnessNPerM, edit.valueNPerM, ch.stiffnessLimits) : edit.valueNPerM,
          materialId: draft.materialId,
        }
  const errors = validateVibrationDesign(candidate, ch)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}
