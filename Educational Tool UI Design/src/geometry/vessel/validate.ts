import type { VesselChallenge, VesselDesignLimits } from '../../challenge/vessel/types'
import { GEOM_TOL } from '../sections'
import { VESSEL_PARAMS, type VesselDesign, type VesselParam } from './design'

// Pressure vessel geometry validator (task 69; MM-09). Pure: never mutates or throws. Total over
// untrusted input: a missing or non-number dimension counts as NON_FINITE. Codes reuse the shared
// GeometryError vocabulary; UNKNOWN_PARAM is produced by edits only.
//
// Error order (deterministic):
//   1. Per parameter, in VESSEL_PARAMS order (innerDiameterM, shellLengthM, shellThicknessM,
//      headThicknessM), at most one of NON_FINITE | NON_POSITIVE | BELOW_MIN | ABOVE_MAX
//   2. LOCKED_FIELD_CHANGED for materialId
//
// There is no coupled rule between parameters: every in-range combination is a buildable closed
// vessel (a wall thicker than the thin-wall rule allows is an applicability finding, not a
// geometry error). Range bounds use GEOM_TOL, as for the other models. The control grid (`stepM`)
// is not enforced: the existing clamp/strict rules accept any in-range value.

export type VesselErrorCode =
  | 'NON_FINITE'
  | 'NON_POSITIVE'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'UNKNOWN_PARAM'
  | 'LOCKED_FIELD_CHANGED'

/** Every code the vessel validator and edits can produce (persistence error table). */
export const VESSEL_ERROR_CODES: readonly [VesselErrorCode, ...VesselErrorCode[]] = Object.freeze([
  'NON_FINITE',
  'NON_POSITIVE',
  'BELOW_MIN',
  'ABOVE_MAX',
  'UNKNOWN_PARAM',
  'LOCKED_FIELD_CHANGED',
] as const) as unknown as readonly [VesselErrorCode, ...VesselErrorCode[]]

/** A typed, student-facing design error, shaped like the shared GeometryError. */
export interface VesselDesignError {
  code: VesselErrorCode
  param?: string
  message: string
}

export const VESSEL_PARAM_LABELS: Readonly<Record<VesselParam, string>> = Object.freeze({
  innerDiameterM: 'Inner diameter',
  shellLengthM: 'Shell length',
  shellThicknessM: 'Shell thickness',
  headThicknessM: 'Head thickness',
})

/** Metres → plain millimetre text for messages ("240 mm", "2.5 mm"). Local: domain code does not import units/. */
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
function checkParam(param: VesselParam, value: unknown, limits: VesselDesignLimits): VesselDesignError | null {
  const label = VESSEL_PARAM_LABELS[param]
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

/** The challenge fields validateVesselDesign reads. */
export type VesselValidationContext = Pick<VesselChallenge, 'initialDesign' | 'designLimits'>

/** Validates the four dimensions (step 1 of the header order). */
export function validateVesselDimensions(d: VesselDesign, limits: VesselDesignLimits): VesselDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors: VesselDesignError[] = []
  for (const param of VESSEL_PARAMS) {
    const err = checkParam(param, design[param], limits)
    if (err) errors.push(err)
  }
  return errors
}

/** Validates a full vessel design against a challenge. See the header for rule order. */
export function validateVesselDesign(d: VesselDesign, ch: VesselValidationContext): VesselDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors = validateVesselDimensions(d, ch.designLimits)
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
