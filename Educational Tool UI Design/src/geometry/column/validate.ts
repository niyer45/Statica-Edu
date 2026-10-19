import type { ColumnChallenge, ColumnSectionLimits } from '../../challenge/column/types'
import { GEOM_TOL } from '../sections'
import { COLUMN_SECTION_KINDS, type ColumnDesign, type ColumnSection, type ColumnSectionKind } from './design'

// Column geometry validator (task 68; CBK-05, MM-09). Pure: never mutates or throws. Total over
// untrusted input: a missing or non-number dimension counts as NON_FINITE, and a missing or
// unknown section kind counts as SECTION_NOT_ALLOWED (param 'kind'). Codes reuse the shared
// GeometryError vocabulary; UNKNOWN_PARAM is produced by edits only.
//
// Error order (deterministic):
//   validateColumnSection
//     1. Per parameter, in this order, at most one of NON_FINITE | NON_POSITIVE | BELOW_MIN | ABOVE_MAX:
//        solid: diameterM
//        tube:  outerDiameterM, wallThicknessM
//   validateColumnDesign
//     2. SECTION_NOT_ALLOWED (alone, replacing step 1) or the validateColumnSection errors
//     3. LOCKED_FIELD_CHANGED for lengthM, then materialId
//
// There is no coupled rule between the tube's outer diameter and wall: the loader guarantees that
// the smallest outer diameter exceeds twice the largest wall (TUBE_BORE_CLOSED), so every in-range
// tube has a bore. Range bounds use GEOM_TOL. The control grid (`stepM`) is not enforced: the
// clamp/strict rules accept any in-range value, as for the other models. Locked fields compare with
// strict equality against the challenge's initialDesign; forceN and support are challenge
// constants, not design fields, so no design can change them.

export type ColumnErrorCode =
  | 'NON_FINITE'
  | 'NON_POSITIVE'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'SECTION_NOT_ALLOWED'
  | 'UNKNOWN_PARAM'
  | 'LOCKED_FIELD_CHANGED'

/** Every code the column validator and edits can produce (persistence error table). */
export const COLUMN_ERROR_CODES: readonly [ColumnErrorCode, ...ColumnErrorCode[]] = Object.freeze([
  'NON_FINITE',
  'NON_POSITIVE',
  'BELOW_MIN',
  'ABOVE_MAX',
  'SECTION_NOT_ALLOWED',
  'UNKNOWN_PARAM',
  'LOCKED_FIELD_CHANGED',
] as const) as unknown as readonly [ColumnErrorCode, ...ColumnErrorCode[]]

/** A typed, student-facing design error, shaped like the shared GeometryError. */
export interface ColumnDesignError {
  code: ColumnErrorCode
  param?: string
  message: string
}

/** The dimensions of each section kind, in control and validation order. */
export const COLUMN_SECTION_PARAMS = {
  solid: ['diameterM'],
  tube: ['outerDiameterM', 'wallThicknessM'],
} as const satisfies Record<ColumnSectionKind, readonly string[]>

export type ColumnSectionParam = (typeof COLUMN_SECTION_PARAMS)[ColumnSectionKind][number]

export const COLUMN_PARAM_LABELS: Readonly<Record<ColumnSectionParam, string>> = Object.freeze({
  diameterM: 'Diameter',
  outerDiameterM: 'Outer diameter',
  wallThicknessM: 'Wall thickness',
})

/** Metres → plain millimetre text for messages ("30 mm", "2.5 mm"). Local: domain code does not import units/. */
function mm(m: number): string {
  const v = Number((m * 1e3).toFixed(4))
  return `${Object.is(v, -0) ? 0 : v} mm`
}

function describe(v: unknown): string {
  if (typeof v === 'number') return Number.isFinite(v) ? mm(v) : String(v)
  if (v === undefined) return 'missing'
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return typeof v
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function isColumnKind(kind: unknown): kind is ColumnSectionKind {
  return typeof kind === 'string' && (COLUMN_SECTION_KINDS as readonly string[]).includes(kind)
}

/** The configured range of a section parameter. */
export function columnParamRange(kind: ColumnSectionKind, param: ColumnSectionParam, limits: ColumnSectionLimits): { minM: number; maxM: number } {
  if (kind === 'solid') return limits.solid.diameterM
  return param === 'wallThicknessM' ? limits.tube.wallThicknessM : limits.tube.outerDiameterM
}

/** Per-parameter check. Returns the single error for the parameter, or null. */
function checkParam(param: ColumnSectionParam, value: unknown, range: { minM: number; maxM: number }): ColumnDesignError | null {
  const label = COLUMN_PARAM_LABELS[param]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { code: 'NON_FINITE', param, message: `${label} must be a finite number (got ${describe(value)}).` }
  }
  if (value <= 0) {
    return { code: 'NON_POSITIVE', param, message: `${label} must be greater than zero (got ${mm(value)}).` }
  }
  if (value < range.minM - GEOM_TOL) {
    return { code: 'BELOW_MIN', param, message: `${label} must be at least ${mm(range.minM)} (got ${mm(value)}).` }
  }
  if (value > range.maxM + GEOM_TOL) {
    return { code: 'ABOVE_MAX', param, message: `${label} must be at most ${mm(range.maxM)} (got ${mm(value)}).` }
  }
  return null
}

function sectionNotAllowed(kind: unknown, allowed: readonly ColumnSectionKind[] = COLUMN_SECTION_KINDS): ColumnDesignError {
  const list = allowed.join(', ')
  return {
    code: 'SECTION_NOT_ALLOWED',
    param: 'kind',
    message: isColumnKind(kind)
      ? `Section type "${kind}" is not allowed in this challenge (allowed: ${list}).`
      : `Section type ${describe(kind)} is not available for a column (allowed: ${list}).`,
  }
}

/** Validates a column section's dimensions against the configured limits. See the header for rule order. */
export function validateColumnSection(s: ColumnSection, limits: ColumnSectionLimits): ColumnDesignError[] {
  const raw: unknown = s
  if (!isRecord(raw)) return [sectionNotAllowed(undefined)]
  const kind = raw.kind
  if (!isColumnKind(kind)) return [sectionNotAllowed(kind)]
  const errors: ColumnDesignError[] = []
  for (const param of COLUMN_SECTION_PARAMS[kind] as readonly ColumnSectionParam[]) {
    const err = checkParam(param, raw[param], columnParamRange(kind, param, limits))
    if (err) errors.push(err)
  }
  return errors
}

const LOCKED_DESIGN_FIELDS = ['lengthM', 'materialId'] as const
const LOCKED_LABELS: Readonly<Record<(typeof LOCKED_DESIGN_FIELDS)[number], string>> = {
  lengthM: 'Column length',
  materialId: 'Material',
}

/** The challenge fields validateColumnDesign reads. */
export type ColumnValidationContext = Pick<ColumnChallenge, 'initialDesign' | 'allowedSections' | 'sectionLimits'>

/** Validates a full column design against a challenge. See the header for rule order. */
export function validateColumnDesign(d: ColumnDesign, ch: ColumnValidationContext): ColumnDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors: ColumnDesignError[] = []
  const section = design.section
  const kind = isRecord(section) ? section.kind : undefined
  if (isColumnKind(kind) && ch.allowedSections.includes(kind)) {
    errors.push(...validateColumnSection(section as ColumnSection, ch.sectionLimits))
  } else {
    errors.push(sectionNotAllowed(kind, ch.allowedSections))
  }
  for (const field of LOCKED_DESIGN_FIELDS) {
    const expected = ch.initialDesign[field]
    const actual = design[field]
    if (actual !== expected) {
      errors.push({
        code: 'LOCKED_FIELD_CHANGED',
        param: field,
        message: `${LOCKED_LABELS[field]} is fixed by the challenge and cannot be changed (expected ${describe(expected)}, got ${describe(actual)}).`,
      })
    }
  }
  return errors
}
