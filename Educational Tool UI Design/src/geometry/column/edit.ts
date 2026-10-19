import type { ColumnChallenge, ColumnSectionDefaults, ColumnSectionLimits } from '../../challenge/column/types'
import type { Result } from '../../challenge/types'
import type { ColumnDesign, ColumnSection, ColumnSectionKind } from './design'
import {
  COLUMN_SECTION_PARAMS,
  columnParamRange,
  validateColumnDesign,
  validateColumnSection,
  type ColumnDesignError,
  type ColumnSectionParam,
} from './validate'

// Column edit operations (task 68; CBK-05, MM-09). Pure: inputs are never mutated; a changed
// section or design is always a new object. The existing clamp/strict semantics apply:
//   clamp   the value is clamped into the parameter's configured range [minM, maxM]; a
//           non-finite value or an unknown parameter leaves the section unchanged (same object).
//   strict  only the parameter is replaced; it succeeds iff the candidate validates.
// The tube's outer diameter and wall are independent (the loader guarantees every in-range pair
// has a bore), so a clamp edit never needs to adjust another parameter.
//
// Section switching (convertColumnSection): solid ↔ tube keeps the outer diameter, clamped to the
// target's range. A new tube uses the configured default wall clamped into the wall range. Same
// kind returns `from`.

function isParamOf(kind: ColumnSectionKind, param: string): param is ColumnSectionParam {
  return (COLUMN_SECTION_PARAMS[kind] as readonly string[]).includes(param)
}

function clampTo(v: number, lo: number, hi: number): number {
  // `+ 0` normalizes −0 to 0. If lo > hi (inconsistent limits) the upper bound wins.
  return Math.min(hi, Math.max(lo, v)) + 0
}

/** The range clampColumnParam clamps `param` into for section `s`, or null for an unknown param. */
export function columnPermissibleRange(
  s: ColumnSection,
  param: string,
  limits: ColumnSectionLimits,
): { minM: number; maxM: number } | null {
  if (!isParamOf(s.kind, param)) return null
  const r = columnParamRange(s.kind, param, limits)
  // Degenerate ranges (only for inconsistent limits) collapse to the upper bound.
  return r.minM > r.maxM ? { minM: r.maxM, maxM: r.maxM } : { minM: r.minM, maxM: r.maxM }
}

/** Clamp-mode set of one parameter (see header). */
export function clampColumnParam(s: ColumnSection, param: string, valueM: number, limits: ColumnSectionLimits): ColumnSection {
  if (!Number.isFinite(valueM)) return s
  const r = columnPermissibleRange(s, param, limits)
  if (r === null) return s
  return { ...s, [param]: clampTo(valueM, r.minM, r.maxM) } as ColumnSection
}

function unknownParam(s: ColumnSection, param: string): { ok: false; error: ColumnDesignError[] } {
  const name = s.kind === 'solid' ? 'solid bar' : 'tube'
  return { ok: false, error: [{ code: 'UNKNOWN_PARAM', param, message: `"${param}" is not a dimension of a ${name}.` }] }
}

/** Strict-mode set: replaces only `param`; succeeds iff the candidate validates. */
export function trySetColumnParam(
  s: ColumnSection,
  param: string,
  valueM: number,
  limits: ColumnSectionLimits,
): Result<ColumnSection, ColumnDesignError[]> {
  if (!isParamOf(s.kind, param)) return unknownParam(s, param)
  const candidate = { ...s, [param]: valueM } as ColumnSection
  const errors = validateColumnSection(candidate, limits)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}

/** Converts `from` to kind `to`, preserving the clamped outer diameter (see header). */
export function convertColumnSection(
  from: ColumnSection,
  to: ColumnSectionKind,
  limits: ColumnSectionLimits,
  defaults: ColumnSectionDefaults,
): ColumnSection {
  if (to === from.kind) return from
  if (from.kind === 'tube') {
    const r = limits.solid.diameterM
    return { kind: 'solid', diameterM: clampTo(from.outerDiameterM, r.minM, r.maxM) }
  }
  const D = limits.tube.outerDiameterM
  const t = limits.tube.wallThicknessM
  return {
    kind: 'tube',
    outerDiameterM: clampTo(from.diameterM, D.minM, D.maxM),
    wallThicknessM: clampTo(defaults.tubeWallM, t.minM, t.maxM),
  }
}

/** Design-level edits available to the student. There is no orientation edit (round column). */
export type ColumnEdit =
  | { type: 'setSection'; kind: ColumnSectionKind }
  | { type: 'setParam'; param: string; valueM: number; mode: 'clamp' | 'strict' }

/** The challenge fields applyColumnEdit reads. */
export type ColumnEditContext = Pick<ColumnChallenge, 'initialDesign' | 'allowedSections' | 'sectionLimits' | 'sectionDefaults'>

/**
 * Applies one edit to `draft`. Returns a new valid design, or every validator error for the
 * candidate (the caller keeps `draft`). A disallowed section kind reports SECTION_NOT_ALLOWED for
 * the requested kind; an unknown parameter reports UNKNOWN_PARAM naming it.
 */
export function applyColumnEdit(
  draft: ColumnDesign,
  edit: ColumnEdit,
  ch: ColumnEditContext,
): Result<ColumnDesign, ColumnDesignError[]> {
  let section: ColumnSection
  if (edit.type === 'setSection') {
    section = ch.allowedSections.includes(edit.kind)
      ? convertColumnSection(draft.section, edit.kind, ch.sectionLimits, ch.sectionDefaults)
      : ({ ...draft.section, kind: edit.kind } as ColumnSection)
  } else if (edit.mode === 'strict') {
    const r = trySetColumnParam(draft.section, edit.param, edit.valueM, ch.sectionLimits)
    if (!r.ok) return r
    section = r.value
  } else {
    if (!isParamOf(draft.section.kind, edit.param)) return unknownParam(draft.section, edit.param)
    section = clampColumnParam(draft.section, edit.param, edit.valueM, ch.sectionLimits)
  }
  const candidate: ColumnDesign = { ...draft, section }
  const errors = validateColumnDesign(candidate, ch)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}
