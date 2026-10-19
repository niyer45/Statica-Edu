import type { FatigueChallenge, FatigueDesignLimits } from '../../challenge/fatigue/types'
import { GEOM_TOL } from '../sections'
import { FATIGUE_PARAMS, SURFACE_FINISH_IDS, type FatigueDesign, type FatigueParam } from './design'

// Stepped-spindle design validator (task 70; FAT-05, MM-09). Pure: never mutates or throws. Total
// over untrusted input: a missing or non-number dimension counts as NON_FINITE.
//
// Error order (deterministic):
//   1. Per dimension, in FATIGUE_PARAMS order, at most one of NON_FINITE | NON_POSITIVE |
//      BELOW_MIN | ABOVE_MAX
//   2. FILLET_EXCEEDS_STEP when every dimension passed step 1 and r is not smaller than the
//      shoulder height (D − d)/2 by more than GEOM_TOL (the fillet must fit inside the step)
//   3. FINISH_NOT_ALLOWED for a finish outside the challenge's allowed list
//   4. LOCKED_FIELD_CHANGED for materialId
// The control grid (`stepM`) is not enforced: any in-range value is accepted, as for the other models.

export type FatigueErrorCode =
  | 'NON_FINITE'
  | 'NON_POSITIVE'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'FILLET_EXCEEDS_STEP'
  | 'FINISH_NOT_ALLOWED'
  | 'UNKNOWN_PARAM'
  | 'LOCKED_FIELD_CHANGED'

/** Every code the fatigue validator and edits can produce (persistence error table). */
export const FATIGUE_ERROR_CODES: readonly [FatigueErrorCode, ...FatigueErrorCode[]] = Object.freeze([
  'NON_FINITE',
  'NON_POSITIVE',
  'BELOW_MIN',
  'ABOVE_MAX',
  'FILLET_EXCEEDS_STEP',
  'FINISH_NOT_ALLOWED',
  'UNKNOWN_PARAM',
  'LOCKED_FIELD_CHANGED',
] as const) as unknown as readonly [FatigueErrorCode, ...FatigueErrorCode[]]

export interface FatigueDesignError {
  code: FatigueErrorCode
  param?: string
  message: string
}

export const FATIGUE_PARAM_LABELS: Readonly<Record<FatigueParam | 'surfaceFinish', string>> = Object.freeze({
  neckDiameterM: 'Neck diameter',
  collarDiameterM: 'Collar diameter',
  filletRadiusM: 'Fillet radius',
  surfaceFinish: 'Surface finish',
})

/** Metres → plain millimetre text for messages. Local: domain code does not import units/. */
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

function checkParam(param: FatigueParam, value: unknown, limits: FatigueDesignLimits): FatigueDesignError | null {
  const label = FATIGUE_PARAM_LABELS[param]
  if (typeof value !== 'number' || !Number.isFinite(value)) return { code: 'NON_FINITE', param, message: `${label} must be a finite number (got ${describe(value)}).` }
  if (value <= 0) return { code: 'NON_POSITIVE', param, message: `${label} must be greater than zero (got ${mm(value)}).` }
  const r = limits[param]
  if (value < r.minM - GEOM_TOL) return { code: 'BELOW_MIN', param, message: `${label} must be at least ${mm(r.minM)} (got ${mm(value)}).` }
  if (value > r.maxM + GEOM_TOL) return { code: 'ABOVE_MAX', param, message: `${label} must be at most ${mm(r.maxM)} (got ${mm(value)}).` }
  return null
}

/** The challenge fields validateFatigueDesign reads. */
export type FatigueValidationContext = Pick<FatigueChallenge, 'initialDesign' | 'designLimits' | 'allowedFinishes'>

/** Steps 1–2: the three dimensions and the fillet-fits-the-step rule. */
export function validateFatigueDimensions(d: FatigueDesign, limits: FatigueDesignLimits): FatigueDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors: FatigueDesignError[] = []
  for (const param of FATIGUE_PARAMS) {
    const err = checkParam(param, design[param], limits)
    if (err) errors.push(err)
  }
  if (errors.length === 0) {
    const h = ((design.collarDiameterM as number) - (design.neckDiameterM as number)) / 2
    const r = design.filletRadiusM as number
    if (!(r < h - GEOM_TOL)) {
      errors.push({
        code: 'FILLET_EXCEEDS_STEP',
        param: 'filletRadiusM',
        message: `The fillet radius (${mm(r)}) must be smaller than the shoulder height, half the difference between the collar and neck diameters (${mm(Math.max(h, 0))}).`,
      })
    }
  }
  return errors
}

/** Validates a full spindle design against a challenge. See the header for rule order. */
export function validateFatigueDesign(d: FatigueDesign, ch: FatigueValidationContext): FatigueDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors = validateFatigueDimensions(d, ch.designLimits)
  const finish = design.surfaceFinish
  if (!(SURFACE_FINISH_IDS as readonly unknown[]).includes(finish) || !(ch.allowedFinishes as readonly unknown[]).includes(finish)) {
    errors.push({ code: 'FINISH_NOT_ALLOWED', param: 'surfaceFinish', message: `Surface finish ${describe(finish)} is not one of the finishes offered by this challenge.` })
  }
  const expected = ch.initialDesign.materialId
  if (design.materialId !== expected) {
    errors.push({
      code: 'LOCKED_FIELD_CHANGED',
      param: 'materialId',
      message: `Material is fixed by the challenge and cannot be changed (expected ${describe(expected)}, got ${describe(design.materialId)}).`,
    })
  }
  return errors
}
