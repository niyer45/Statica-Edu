import type { TorsionChallenge, TorsionSectionDefaults, TorsionSectionLimits } from '../../challenge/torsion/types'
import type { Result } from '../../challenge/types'
import { GEOM_TOL, type GeometryError } from '../sections'
import type { TorsionDesign, TorsionSection, TorsionSectionKind } from './design'
import { validateTorsionDesign, validateTorsionSection } from './validate'

// Torsion shaft edit operations (task 47.2; TSH-04, MM-09). Pure: inputs are never mutated; a
// changed section or design is always a new object. Semantics mirror the beam's clamp.ts and
// convert.ts for circle and tube:
//
// Permissible ranges (clamp mode):
//   circle D ∈ [minD, maxD]
//   tube   D ∈ [max(minD, 2·minWall), maxD]   (d may shrink to 0, so D/2 must still be a full wall)
//   tube   d ∈ [0, max(0, D − 2·minWall)]
// Coupled shrink: changing a tube's D keeps d unless the validator would reject the pair, in
// which case d shrinks to max(0, D − 2·minWall). Degenerate ranges (lower > upper, only for
// inconsistent limits) collapse to the current value.
// Unsupported inputs: a non-finite value or a parameter outside the kind's parameters makes
// clampTorsionParam return the input section unchanged (same object); trySetTorsionParam rejects
// an unknown parameter with SECTION_NOT_ALLOWED naming it.
//
// Section switching (convertTorsionSection): circle ↔ tube keeps the outer diameter, clamped to
// the target's range. A new tube uses the configured default wall (TSH-04: 4 mm); if that wall
// does not fit, the largest permissible wall D/2 (d = 0) is used. Same kind returns `from`.
//
// applyTorsionEdit is the design-level entry point (MM-09): it either returns a new design that
// passes validateTorsionDesign or the errors for the candidate, so callers keep their draft
// unchanged on failure. Locked fields (lengthM, materialId) are not editable through any edit.

export const TORSION_SECTION_PARAMS = {
  circle: ['diameterM'],
  tube: ['outerDiameterM', 'innerDiameterM'],
} as const satisfies Record<TorsionSectionKind, readonly string[]>

export type TorsionSectionParam = (typeof TORSION_SECTION_PARAMS)[TorsionSectionKind][number]

function isParamOf(kind: TorsionSectionKind, param: string): param is TorsionSectionParam {
  return (TORSION_SECTION_PARAMS[kind] as readonly string[]).includes(param)
}

function bounds(minM: number, maxM: number, current: number): { minM: number; maxM: number } {
  return minM > maxM ? { minM: current, maxM: current } : { minM, maxM }
}

/** The range clampTorsionParam clamps `param` into for section `s`, or null for an unknown param. */
export function torsionPermissibleRange(
  s: TorsionSection,
  param: string,
  limits: TorsionSectionLimits,
): { minM: number; maxM: number } | null {
  if (!isParamOf(s.kind, param)) return null
  if (s.kind === 'circle') return bounds(limits.circle.diameterM.minM, limits.circle.diameterM.maxM, s.diameterM)
  const L = limits.tube
  if (param === 'outerDiameterM') {
    return bounds(Math.max(L.outerDiameterM.minM, 2 * L.minWallM), L.outerDiameterM.maxM, s.outerDiameterM)
  }
  return bounds(0, Math.max(0, s.outerDiameterM - 2 * L.minWallM), s.innerDiameterM)
}

/**
 * Clamp-mode set: sets `param` to `valueM` clamped into its permissible range and shrinks the
 * tube bore only when needed to stay valid. For a valid input the result is valid. Non-finite
 * value or unknown param → returns `s` unchanged.
 */
export function clampTorsionParam(
  s: TorsionSection,
  param: string,
  valueM: number,
  limits: TorsionSectionLimits,
): TorsionSection {
  if (!Number.isFinite(valueM)) return s
  const r = torsionPermissibleRange(s, param, limits)
  if (r === null) return s
  // `+ 0` normalizes −0 to 0.
  const v = Math.min(r.maxM, Math.max(r.minM, valueM)) + 0
  if (s.kind === 'circle') return { kind: 'circle', diameterM: v }
  if (param === 'innerDiameterM') return { ...s, innerDiameterM: v }
  const minWall = limits.tube.minWallM
  const d = s.innerDiameterM
  // Same test as the validator's INNER_NOT_LESS_THAN_OUTER / WALL_TOO_THIN rules.
  const keep = d < v && (v - d) / 2 >= minWall - GEOM_TOL
  return { kind: 'tube', outerDiameterM: v, innerDiameterM: keep ? d : Math.max(0, v - 2 * minWall) }
}

/**
 * Strict-mode set: replaces only `param` (no coupling). Succeeds iff the candidate validates;
 * otherwise fails with every validator error for the candidate.
 */
export function trySetTorsionParam(
  s: TorsionSection,
  param: string,
  valueM: number,
  limits: TorsionSectionLimits,
): Result<TorsionSection, GeometryError[]> {
  if (!isParamOf(s.kind, param)) return unknownParam(s, param)
  const candidate = { ...s, [param]: valueM } as TorsionSection
  const errors = validateTorsionSection(candidate, limits)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}

function unknownParam(s: TorsionSection, param: string): { ok: false; error: GeometryError[] } {
  return {
    ok: false,
    error: [{ code: 'SECTION_NOT_ALLOWED', param, message: `"${param}" is not a dimension of a ${s.kind} shaft section.` }],
  }
}

function clampTo(v: number, lo: number, hi: number): number {
  // `+ 0` normalizes −0 to 0. If lo > hi (inconsistent limits) the upper bound wins.
  return Math.min(hi, Math.max(lo, v)) + 0
}

/** Converts `from` to kind `to`, preserving the clamped outer diameter (see header). */
export function convertTorsionSection(
  from: TorsionSection,
  to: TorsionSectionKind,
  limits: TorsionSectionLimits,
  defaults: TorsionSectionDefaults,
): TorsionSection {
  if (to === from.kind) return from
  if (to === 'circle') {
    const r = limits.circle.diameterM
    return { kind: 'circle', diameterM: clampTo((from as Extract<TorsionSection, { kind: 'tube' }>).outerDiameterM, r.minM, r.maxM) }
  }
  const L = limits.tube
  const size = (from as Extract<TorsionSection, { kind: 'circle' }>).diameterM
  const D = clampTo(size, Math.max(L.outerDiameterM.minM, 2 * L.minWallM), L.outerDiameterM.maxM)
  const w = defaults.tubeWallM
  const wall = w >= L.minWallM - GEOM_TOL && w <= D / 2 + GEOM_TOL ? w : D / 2
  return { kind: 'tube', outerDiameterM: D, innerDiameterM: Math.max(0, D - 2 * wall) + 0 }
}

/** Design-level edits available to the student. There is no orientation edit (axisymmetric). */
export type TorsionEdit =
  | { type: 'setSection'; kind: TorsionSectionKind }
  | { type: 'setParam'; param: string; valueM: number; mode: 'clamp' | 'strict' }

/** The challenge fields applyTorsionEdit reads. */
export type TorsionEditContext = Pick<
  TorsionChallenge,
  'initialDesign' | 'allowedSections' | 'sectionLimits' | 'sectionDefaults'
>

/**
 * Applies one edit to `draft`. Returns a new valid design, or every validator error for the
 * candidate (the caller keeps `draft`). A disallowed section kind reports SECTION_NOT_ALLOWED
 * for the requested kind; an unknown parameter reports SECTION_NOT_ALLOWED naming it.
 */
export function applyTorsionEdit(
  draft: TorsionDesign,
  edit: TorsionEdit,
  ch: TorsionEditContext,
): Result<TorsionDesign, GeometryError[]> {
  let section: TorsionSection
  if (edit.type === 'setSection') {
    section = ch.allowedSections.includes(edit.kind)
      ? convertTorsionSection(draft.section, edit.kind, ch.sectionLimits, ch.sectionDefaults)
      : ({ ...draft.section, kind: edit.kind } as TorsionSection)
  } else if (edit.mode === 'strict') {
    const r = trySetTorsionParam(draft.section, edit.param, edit.valueM, ch.sectionLimits)
    if (!r.ok) return r
    section = r.value
  } else {
    if (!isParamOf(draft.section.kind, edit.param)) return unknownParam(draft.section, edit.param)
    section = clampTorsionParam(draft.section, edit.param, edit.valueM, ch.sectionLimits)
  }
  const candidate: TorsionDesign = { ...draft, section }
  const errors = validateTorsionDesign(candidate, ch)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}
