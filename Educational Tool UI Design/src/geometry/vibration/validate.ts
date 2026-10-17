import type { StiffnessLimits, VibrationChallenge, VibrationLockedField } from '../../challenge/vibration/types'
import type { VibrationDesign } from './design'

// Vibration isolator design validator (task 50.2; VIB-04, VIB-13 invalid input, MM-09). Pure:
// never mutates or throws. Total over untrusted input: a missing or non-number stiffness counts
// as NON_FINITE, and a missing, non-string or unlisted material id counts as
// MATERIAL_NOT_ALLOWED. Errors have the beam GeometryError shape ({ code, param?, message });
// the code set reuses the shared range and locked-field codes and adds MATERIAL_NOT_ALLOWED,
// because a material is not a section kind.
//
// Error order (deterministic, the shared validator order):
//   1. stiffnessNPerM: at most one of NON_FINITE | NON_POSITIVE | BELOW_MIN | ABOVE_MAX
//   2. materialId:     MATERIAL_NOT_ALLOWED
//   3. LOCKED_FIELD_CHANGED for massKg, operatingBandHz, amplitudeM, linearStrokeM, in that order
//
// Tolerances: range bounds are inclusive with a relative slack of STIFFNESS_REL_TOL (the stiffness
// analogue of the beam's absolute GEOM_TOL in metres); the 0.5 kN/m step is input granularity,
// not a validity rule (VIB-04). Locked fields are challenge constants, not design fields: an
// untrusted design object that carries one of them with a value different from the challenge's
// is rejected, so no design can change mass, band, amplitude or stroke.

/** Codes a vibration design error can carry. */
export type VibrationDesignErrorCode =
  | 'NON_FINITE'
  | 'NON_POSITIVE'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'MATERIAL_NOT_ALLOWED'
  | 'LOCKED_FIELD_CHANGED'

/** Every code, in validator order (persistence error tables use it). */
export const VIBRATION_DESIGN_ERROR_CODES = Object.freeze([
  'NON_FINITE',
  'NON_POSITIVE',
  'BELOW_MIN',
  'ABOVE_MAX',
  'MATERIAL_NOT_ALLOWED',
  'LOCKED_FIELD_CHANGED',
] as const) satisfies readonly VibrationDesignErrorCode[]

/** A typed, student-facing design error with the shared GeometryError shape. */
export interface VibrationDesignError {
  code: VibrationDesignErrorCode
  param?: string
  message: string
}

/** Relative slack on the stiffness range bounds. */
export const STIFFNESS_REL_TOL = 1e-9

/** N/m → plain kN/m text for messages ("85 kN/m", "61.2916 kN/m"). Local: domain code does not import units/. */
function kNPerM(n: number): string {
  const v = Number((n / 1e3).toFixed(4))
  return `${Object.is(v, -0) ? 0 : v} kN/m`
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

/** The stiffness check. Returns the single error for the parameter, or null. */
export function checkStiffness(value: unknown, limits: StiffnessLimits): VibrationDesignError | null {
  const param = 'stiffnessNPerM'
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { code: 'NON_FINITE', param, message: `Stiffness must be a finite number (got ${describe(value)}).` }
  }
  if (value <= 0) {
    return { code: 'NON_POSITIVE', param, message: `Stiffness must be greater than zero (got ${kNPerM(value)}).` }
  }
  if (value < limits.minNPerM * (1 - STIFFNESS_REL_TOL)) {
    return { code: 'BELOW_MIN', param, message: `Stiffness must be at least ${kNPerM(limits.minNPerM)} (got ${kNPerM(value)}).` }
  }
  if (value > limits.maxNPerM * (1 + STIFFNESS_REL_TOL)) {
    return { code: 'ABOVE_MAX', param, message: `Stiffness must be at most ${kNPerM(limits.maxNPerM)} (got ${kNPerM(value)}).` }
  }
  return null
}

const LOCKED_LABELS: Readonly<Record<VibrationLockedField, string>> = {
  massKg: 'Component mass',
  operatingBandHz: 'Operating band',
  amplitudeM: 'Base vibration amplitude',
  linearStrokeM: 'Mount stroke',
}

/** The challenge fields validateVibrationDesign reads. */
export type VibrationValidationContext = Pick<VibrationChallenge, 'stiffnessLimits' | 'materials' | 'component' | 'excitation' | 'mount'>

/** The challenge value of each locked field, in VIBRATION_LOCKED_FIELDS order. */
function lockedValues(ch: VibrationValidationContext): readonly [VibrationLockedField, unknown][] {
  return [
    ['massKg', ch.component.massKg],
    ['operatingBandHz', ch.excitation.operatingBandHz],
    ['amplitudeM', ch.excitation.amplitudeM],
    ['linearStrokeM', ch.mount.linearStrokeM],
  ]
}

/** JSON-value equality for locked-field comparison (numbers by Object.is, band objects key by key). */
function sameValue(a: unknown, b: unknown): boolean {
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(b)
    return Object.keys(a).length === keys.length && keys.every((k) => sameValue(a[k], b[k]))
  }
  return Object.is(a, b)
}

/** Validates a full isolator design against a challenge. See the header for rule order. */
export function validateVibrationDesign(d: VibrationDesign, ch: VibrationValidationContext): VibrationDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors: VibrationDesignError[] = []

  const stiffness = checkStiffness(design.stiffnessNPerM, ch.stiffnessLimits)
  if (stiffness) errors.push(stiffness)

  const materialId = design.materialId
  if (typeof materialId !== 'string' || !ch.materials.some((m) => m.id === materialId)) {
    const list = ch.materials.map((m) => m.id).join(', ')
    errors.push({
      code: 'MATERIAL_NOT_ALLOWED',
      param: 'materialId',
      message: `Material ${describe(materialId)} is not available in this challenge (allowed: ${list}).`,
    })
  }

  for (const [field, expected] of lockedValues(ch)) {
    if (!Object.prototype.hasOwnProperty.call(design, field)) continue
    const actual = design[field]
    if (!sameValue(actual, expected)) {
      errors.push({
        code: 'LOCKED_FIELD_CHANGED',
        param: field,
        message: `${LOCKED_LABELS[field]} is fixed by the challenge and cannot be changed (expected ${describe(expected)}, got ${describe(actual)}).`,
      })
    }
  }
  return errors
}
