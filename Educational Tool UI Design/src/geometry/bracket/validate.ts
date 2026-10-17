import type { BracketChallenge, BracketDesignLimits } from '../../challenge/bracket/types'
import { GEOM_TOL } from '../sections'
import { BRACKET_PARAMS, type BracketDesign, type BracketParam } from './design'

// Stepped-bar bracket geometry validator (task 46.2; MBR-05, MBR-17, MM-09). Pure: never mutates
// or throws. Total over untrusted input: a missing or non-number dimension counts as NON_FINITE.
// Codes reuse the beam/torsion GeometryError vocabulary where the meaning is the same; the bracket
// adds ARM_DEEPER_THAN_ROOT (design.md `armDeeperThanRoot`) and UNKNOWN_PARAM (edits only). The
// design.md names map as: rootDepthOutOfRange / armDepthOutOfRange / stepLocationOutOfRange /
// filletRadiusOutOfRange → BELOW_MIN | ABOVE_MAX with that `param`; nonFinite → NON_FINITE;
// lockedField → LOCKED_FIELD_CHANGED.
//
// Error order (deterministic):
//   1. Per parameter, in BRACKET_PARAMS order (rootDepthM, armDepthM, stepLocationM,
//      filletRadiusM), at most one of NON_FINITE | NON_POSITIVE | BELOW_MIN | ABOVE_MAX
//   2. ARM_DEEPER_THAN_ROOT when d > D (only when both are finite and positive)
//   3. LOCKED_FIELD_CHANGED for materialId
//
// Tolerances: range bounds use GEOM_TOL, as for the other models; d > D is exact, so d = D (as
// stored values) is the valid uniform bar (MBR-12). The control grid (`stepM`) is not enforced:
// the existing clamp/strict rules accept any in-range value, and the bracket keeps them.

export type BracketErrorCode =
  | 'NON_FINITE'
  | 'NON_POSITIVE'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'ARM_DEEPER_THAN_ROOT'
  | 'UNKNOWN_PARAM'
  | 'LOCKED_FIELD_CHANGED'

/** Every code the bracket validator and edits can produce (persistence error table). */
export const BRACKET_ERROR_CODES: readonly [BracketErrorCode, ...BracketErrorCode[]] = Object.freeze([
  'NON_FINITE',
  'NON_POSITIVE',
  'BELOW_MIN',
  'ABOVE_MAX',
  'ARM_DEEPER_THAN_ROOT',
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
  rootDepthM: 'Root depth',
  armDepthM: 'Arm depth',
  stepLocationM: 'Step location',
  filletRadiusM: 'Fillet radius',
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

/** Validates the four dimensions and d ≤ D (steps 1–2 of the header order). */
export function validateBracketDimensions(d: BracketDesign, limits: BracketDesignLimits): BracketDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors: BracketDesignError[] = []
  /** Parameters that passed NON_FINITE / NON_POSITIVE (finite positive numbers, usable by d ≤ D). */
  const ok = new Map<BracketParam, number>()
  for (const param of BRACKET_PARAMS) {
    const value = design[param]
    const err = checkParam(param, value, limits)
    if (err) errors.push(err)
    if (!err || err.code === 'BELOW_MIN' || err.code === 'ABOVE_MAX') ok.set(param, value as number)
  }
  const D = ok.get('rootDepthM')
  const dArm = ok.get('armDepthM')
  if (D !== undefined && dArm !== undefined && dArm > D) {
    errors.push({
      code: 'ARM_DEEPER_THAN_ROOT',
      param: 'armDepthM',
      message: `Arm depth must not exceed the root depth (arm ${mm(dArm)}, root ${mm(D)}). Equal depths make a uniform bar.`,
    })
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
