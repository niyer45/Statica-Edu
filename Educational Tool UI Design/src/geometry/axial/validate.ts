import type { AxialChallenge, AxialLockedField } from '../../challenge/axial/types'
import type { ParamRange } from '../../challenge/types'
import { GEOM_TOL } from '../sections'
import type { AxialDesign } from './design'

// Hanger-rod design validator (task 72; SSR-04, SSR-13 invalid input, MM-09). Pure: never mutates
// or throws. Total over untrusted input: a missing or non-number diameter counts as NON_FINITE,
// and a missing, non-string or unlisted material id counts as MATERIAL_NOT_ALLOWED. Errors have
// the shared GeometryError shape ({ code, param?, message }); the codes reuse the shared range and
// locked-field codes plus MATERIAL_NOT_ALLOWED, as in Vibration Isolation I.
//
// Error order (deterministic):
//   1. diameterM:  at most one of NON_FINITE | NON_POSITIVE | BELOW_MIN | ABOVE_MAX
//   2. materialId: MATERIAL_NOT_ALLOWED
//   3. LOCKED_FIELD_CHANGED for lengthM, forceN, designFactor, support, in that order
//
// Tolerances: range bounds use GEOM_TOL, as for the other models; the 0.5 mm step is input
// granularity, not a validity rule. Locked fields are challenge constants, not design fields: an
// untrusted design object that carries one of them with a value different from the challenge's
// is rejected, so no design can change the length, load, factor or support.

export type AxialDesignErrorCode =
  | 'NON_FINITE'
  | 'NON_POSITIVE'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'MATERIAL_NOT_ALLOWED'
  | 'LOCKED_FIELD_CHANGED'

/** Every code the validator can produce (persistence error table). */
export const AXIAL_ERROR_CODES: readonly [AxialDesignErrorCode, ...AxialDesignErrorCode[]] = Object.freeze([
  'NON_FINITE',
  'NON_POSITIVE',
  'BELOW_MIN',
  'ABOVE_MAX',
  'MATERIAL_NOT_ALLOWED',
  'LOCKED_FIELD_CHANGED',
] as const) as unknown as readonly [AxialDesignErrorCode, ...AxialDesignErrorCode[]]

/** A typed, student-facing design error with the shared GeometryError shape. */
export interface AxialDesignError {
  code: AxialDesignErrorCode
  param?: string
  message: string
}

export const AXIAL_PARAM_LABELS: Readonly<Record<'diameterM' | 'materialId', string>> = Object.freeze({
  diameterM: 'Diameter',
  materialId: 'Material',
})

/** Metres → plain millimetre text for messages ("13 mm", "6.5 mm"). Local: domain code does not import units/. */
function mm(m: number): string {
  const v = Number((m * 1e3).toFixed(4))
  return `${Object.is(v, -0) ? 0 : v} mm`
}

function describe(v: unknown): string {
  if (typeof v === 'number') return String(v)
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

/** The diameter check. Returns the single error for the parameter, or null. */
export function checkDiameter(value: unknown, range: Pick<ParamRange, 'minM' | 'maxM'>): AxialDesignError | null {
  const param = 'diameterM'
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { code: 'NON_FINITE', param, message: `Diameter must be a finite number (got ${describe(value)}).` }
  }
  if (value <= 0) {
    return { code: 'NON_POSITIVE', param, message: `Diameter must be greater than zero (got ${mm(value)}).` }
  }
  if (value < range.minM - GEOM_TOL) {
    return { code: 'BELOW_MIN', param, message: `Diameter must be at least ${mm(range.minM)} (got ${mm(value)}).` }
  }
  if (value > range.maxM + GEOM_TOL) {
    return { code: 'ABOVE_MAX', param, message: `Diameter must be at most ${mm(range.maxM)} (got ${mm(value)}).` }
  }
  return null
}

const LOCKED_LABELS: Readonly<Record<AxialLockedField, string>> = {
  lengthM: 'Rod length',
  forceN: 'Load',
  designFactor: 'Design factor',
  support: 'Support',
}

/** The challenge fields validateAxialDesign reads. */
export type AxialValidationContext = Pick<AxialChallenge, 'diameterLimits' | 'materials' | 'lengthM' | 'forceN' | 'designFactor' | 'support'>

/** Validates a full rod design against a challenge. See the header for rule order. */
export function validateAxialDesign(d: AxialDesign, ch: AxialValidationContext): AxialDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors: AxialDesignError[] = []

  const diameter = checkDiameter(design.diameterM, ch.diameterLimits)
  if (diameter) errors.push(diameter)

  const materialId = design.materialId
  if (typeof materialId !== 'string' || !ch.materials.some((m) => m.id === materialId)) {
    const list = ch.materials.map((m) => m.id).join(', ')
    errors.push({
      code: 'MATERIAL_NOT_ALLOWED',
      param: 'materialId',
      message: `Material ${describe(materialId)} is not available in this challenge (allowed: ${list}).`,
    })
  }

  const locked: readonly [AxialLockedField, unknown][] = [
    ['lengthM', ch.lengthM],
    ['forceN', ch.forceN],
    ['designFactor', ch.designFactor],
    ['support', ch.support],
  ]
  for (const [field, expected] of locked) {
    if (!Object.prototype.hasOwnProperty.call(design, field)) continue
    const actual = design[field]
    if (!Object.is(actual, expected)) {
      errors.push({
        code: 'LOCKED_FIELD_CHANGED',
        param: field,
        message: `${LOCKED_LABELS[field]} is fixed by the challenge and cannot be changed (expected ${describe(expected)}, got ${describe(actual)}).`,
      })
    }
  }
  return errors
}
