import type { BracketChallenge, BracketDesignLimits } from '../../challenge/bracket/types'
import { GEOM_TOL } from '../sections'
import { BRACKET_PARAMS, type BracketDesign, type BracketParam } from './design'

// L-bracket geometry validator (task 55; MM-09). Pure: never mutates or throws. Total over
// untrusted input: a missing or non-number dimension counts as NON_FINITE. Codes reuse the
// beam/torsion GeometryError vocabulary; UNKNOWN_PARAM is produced by edits only.
//
// Error order (deterministic):
//   1. Per parameter, in BRACKET_PARAMS order (thicknessM, widthM, flangeHeightM, innerRadiusM),
//      at most one of NON_FINITE | NON_POSITIVE | BELOW_MIN | ABOVE_MAX
//   2. LOCKED_FIELD_CHANGED for materialId
//
// There is no coupled rule between parameters: the loader guarantees that every in-range design
// keeps the bolt row above the bend (BOLT_ROW_IN_BEND) and bends about the thin axis
// (WIDTH_BELOW_THICKNESS). Tolerances: range bounds use GEOM_TOL, as for the other models. The
// control grid (`stepM`) is not enforced: the existing clamp/strict rules accept any in-range
// value.

export type BracketErrorCode =
  | 'NON_FINITE'
  | 'NON_POSITIVE'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'UNKNOWN_PARAM'
  | 'LOCKED_FIELD_CHANGED'

/** Every code the bracket validator and edits can produce (persistence error table). */
export const BRACKET_ERROR_CODES: readonly [BracketErrorCode, ...BracketErrorCode[]] = Object.freeze([
  'NON_FINITE',
  'NON_POSITIVE',
  'BELOW_MIN',
  'ABOVE_MAX',
  'UNKNOWN_PARAM',
  'LOCKED_FIELD_CHANGED',
] as const) as unknown as readonly [BracketErrorCode, ...BracketErrorCode[]]

/** A typed, student-facing design error, shaped like the shared GeometryError. */
export interface BracketDesignError {
  code: BracketErrorCode
  param?: string
  message: string
}

export const BRACKET_PARAM_LABELS: Readonly<Record<BracketParam, string>> = Object.freeze({
  thicknessM: 'Thickness',
  widthM: 'Width',
  flangeHeightM: 'Flange height',
  innerRadiusM: 'Inner bend radius',
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

/** Per-parameter check. Returns the single error for the parameter, or null. */
function checkParam(param: BracketParam, value: unknown, limits: BracketDesignLimits): BracketDesignError | null {
  const label = BRACKET_PARAM_LABELS[param]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { code: 'NON_FINITE', param, message: `${label} must be a finite number (got ${describe(value)}).` }
  }
  if (value <= 0) {
    return { code: 'NON_POSITIVE', param, message: `${label} must be greater than zero (got ${mm(value)}).` }
  }
  const r = limits[param]
  if (value < r.minM - GEOM_TOL) {
    return { code: 'BELOW_MIN', param, message: `${label} must be at least ${mm(r.minM)} (got ${mm(value)}).` }
  }
  if (value > r.maxM + GEOM_TOL) {
    return { code: 'ABOVE_MAX', param, message: `${label} must be at most ${mm(r.maxM)} (got ${mm(value)}).` }
  }
  return null
}

/** The challenge fields validateBracketDesign reads. */
export type BracketValidationContext = Pick<BracketChallenge, 'initialDesign' | 'designLimits'>

/** Validates the four dimensions (step 1 of the header order). */
export function validateBracketDimensions(d: BracketDesign, limits: BracketDesignLimits): BracketDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors: BracketDesignError[] = []
  for (const param of BRACKET_PARAMS) {
    const err = checkParam(param, design[param], limits)
    if (err) errors.push(err)
  }
  return errors
}

/** Validates a full bracket design against a challenge. See the header for rule order. */
export function validateBracketDesign(d: BracketDesign, ch: BracketValidationContext): BracketDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors = validateBracketDimensions(d, ch.designLimits)
  const expected = ch.initialDesign.materialId
  const actual = design.materialId
  if (actual !== expected) {
    errors.push({
      code: 'LOCKED_FIELD_CHANGED',
      param: 'materialId',
      message: `Material is fixed by the challenge and cannot be changed (expected ${describe(expected)}, got ${describe(actual)}).`,
    })
  }
  return errors
}
