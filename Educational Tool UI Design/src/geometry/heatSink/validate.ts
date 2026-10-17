import type { HeatSinkChallenge, HeatSinkDesignLimits, IntegerRange } from '../../challenge/heatSink/types'
import type { ParamRange } from '../../challenge/types'
import { GEOM_TOL } from '../sections'
import { finGap, type FinArray, type HeatSinkDesign } from './design'

// Heat sink geometry validator (task 48.2; HSK-04, HSK-13, MM-09). Pure: never mutates or throws.
// Total over untrusted input: a missing or non-number parameter counts as NON_FINITE. Errors use
// the shared error shape { code, param, message } with heat sink codes: fin count has integer
// and off-step rules that the beam vocabulary (geometry/sections.ts, unchanged) does not have.
//
// Error order (deterministic):
//   validateFinArray
//     1. Per parameter, in this order, at most one error:
//        finCount:       NON_FINITE | NOT_INTEGER | BELOW_MIN | ABOVE_MAX
//        finThicknessM:  NON_FINITE | NON_POSITIVE | BELOW_MIN | ABOVE_MAX | OFF_STEP
//        finHeightM:     NON_FINITE | NON_POSITIVE | BELOW_MIN | ABOVE_MAX | OFF_STEP
//     2. GAP_TOO_SMALL (param finGapM): s = (W − N t)/(N − 1) < minGeometricGapM. Checked only
//        when N is an integer ≥ 2 and t is finite and positive; N = 1 has no gap and is already
//        BELOW_MIN, so the division by zero never happens. Zero and negative gaps fail here.
//   validateHeatSinkDesign
//     3. the validateFinArray errors
//     4. LOCKED_FIELD_CHANGED for materialId
//
// Exclusivity: a parameter that is NON_FINITE, NON_POSITIVE or NOT_INTEGER gets exactly that one
// error and skips the gap rule. Out-of-range or off-step (finite, positive) values still feed it.
// Tolerances: range bounds, the step grid and the gap floor use GEOM_TOL (1e-9 m); integrality
// is exact. The fin-count floor is max(2, configured minimum): N = 1 is never valid.
// Locked fields compare with strict equality against the challenge's initialDesign. Base, heat
// load, ambient temperature and convection are locked too but are challenge constants, not
// design fields, so no design can change them.

export type HeatSinkGeometryErrorCode =
  | 'NON_FINITE'
  | 'NON_POSITIVE'
  | 'NOT_INTEGER'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'OFF_STEP'
  | 'GAP_TOO_SMALL'
  | 'LOCKED_FIELD_CHANGED'
  /** Produced by edits only (geometry/heatSink/edit.ts): the edited parameter does not exist. */
  | 'UNKNOWN_PARAM'

/** Every code the validator and edits can produce (persistence draft-error vocabulary, MM-18). */
export const HEAT_SINK_GEOMETRY_ERROR_CODES: readonly [HeatSinkGeometryErrorCode, ...HeatSinkGeometryErrorCode[]] = Object.freeze([
  'NON_FINITE',
  'NON_POSITIVE',
  'NOT_INTEGER',
  'BELOW_MIN',
  'ABOVE_MAX',
  'OFF_STEP',
  'GAP_TOO_SMALL',
  'LOCKED_FIELD_CHANGED',
  'UNKNOWN_PARAM',
] as const)

export interface HeatSinkGeometryError {
  code: HeatSinkGeometryErrorCode
  param?: string
  message: string
}

/** Absolute floor on the fin count: the gap is undefined for a single fin. */
export const MIN_FIN_COUNT = 2

const PARAM_LABELS: Readonly<Record<string, string>> = {
  finCount: 'Fin count',
  finThicknessM: 'Fin thickness',
  finHeightM: 'Fin height',
}

/** Metres → plain millimetre text for messages ("3 mm", "0.53 mm"). Local: domain code does not import units/. */
function mm(m: number): string {
  const v = Number((m * 1e3).toFixed(4))
  return `${Object.is(v, -0) ? 0 : v} mm`
}

function describe(v: unknown, unit: 'm' | 'plain'): string {
  if (typeof v === 'number') return Number.isFinite(v) && unit === 'm' ? mm(v) : String(v)
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

/** True iff `v` lies on the grid min + k·step within GEOM_TOL. */
export function onStep(v: number, r: ParamRange): boolean {
  const k = Math.round((v - r.minM) / r.stepM)
  return Math.abs(v - (r.minM + k * r.stepM)) <= GEOM_TOL
}

function checkCount(value: unknown, r: IntegerRange): HeatSinkGeometryError | null {
  const label = PARAM_LABELS.finCount
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { code: 'NON_FINITE', param: 'finCount', message: `${label} must be a finite number (got ${describe(value, 'plain')}).` }
  }
  if (!Number.isInteger(value)) {
    return { code: 'NOT_INTEGER', param: 'finCount', message: `${label} must be a whole number (got ${value}).` }
  }
  const min = Math.max(MIN_FIN_COUNT, r.min)
  if (value < min) {
    return { code: 'BELOW_MIN', param: 'finCount', message: `${label} must be at least ${min} (got ${value}).` }
  }
  if (value > r.max) {
    return { code: 'ABOVE_MAX', param: 'finCount', message: `${label} must be at most ${r.max} (got ${value}).` }
  }
  return null
}

function checkLength(name: 'finThicknessM' | 'finHeightM', value: unknown, r: ParamRange): HeatSinkGeometryError | null {
  const label = PARAM_LABELS[name]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { code: 'NON_FINITE', param: name, message: `${label} must be a finite number (got ${describe(value, 'm')}).` }
  }
  if (value <= 0) {
    return { code: 'NON_POSITIVE', param: name, message: `${label} must be greater than zero (got ${mm(value)}).` }
  }
  if (value < r.minM - GEOM_TOL) {
    return { code: 'BELOW_MIN', param: name, message: `${label} must be at least ${mm(r.minM)} (got ${mm(value)}).` }
  }
  if (value > r.maxM + GEOM_TOL) {
    return { code: 'ABOVE_MAX', param: name, message: `${label} must be at most ${mm(r.maxM)} (got ${mm(value)}).` }
  }
  if (!onStep(value, r)) {
    return { code: 'OFF_STEP', param: name, message: `${label} must be a multiple of ${mm(r.stepM)} from ${mm(r.minM)} (got ${mm(value)}).` }
  }
  return null
}

/** Validates the fin parameters against the limits and base width. See the header for rule order. */
export function validateFinArray(fins: FinArray, limits: HeatSinkDesignLimits, baseWidthM: number): HeatSinkGeometryError[] {
  const raw: unknown = fins
  const f: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors: HeatSinkGeometryError[] = []

  const countErr = checkCount(f.finCount, limits.finCount)
  const thicknessErr = checkLength('finThicknessM', f.finThicknessM, limits.finThicknessM)
  const heightErr = checkLength('finHeightM', f.finHeightM, limits.finHeightM)
  for (const e of [countErr, thicknessErr, heightErr]) if (e) errors.push(e)

  // Gap rule inputs: an integer N ≥ 2 (in or out of range) and a finite positive t.
  const N = f.finCount
  const t = f.finThicknessM
  const countUsable = typeof N === 'number' && Number.isInteger(N) && N >= MIN_FIN_COUNT
  const thicknessUsable = !thicknessErr || !['NON_FINITE', 'NON_POSITIVE'].includes(thicknessErr.code)
  if (countUsable && thicknessUsable) {
    const s = finGap(baseWidthM, N, t as number)
    const floor = limits.minGeometricGapM
    if (s < floor - GEOM_TOL) {
      errors.push({
        code: 'GAP_TOO_SMALL',
        param: 'finGapM',
        message:
          s <= 0
            ? `Fins overlap: ${N} fins of ${mm(t as number)} do not fit across the ${mm(baseWidthM)} base. Use fewer or thinner fins.`
            : `Fins are too close together: the gap ${mm(s)} must be at least ${mm(floor)}. Use fewer or thinner fins.`,
      })
    }
  }
  return errors
}

const LOCKED_LABELS: Readonly<Record<'materialId', string>> = { materialId: 'Material' }

/** The challenge fields validateHeatSinkDesign reads. */
export type HeatSinkValidationContext = Pick<HeatSinkChallenge, 'initialDesign' | 'designLimits' | 'base'>

/** Validates a full heat sink design against a challenge. See the header for rule order. */
export function validateHeatSinkDesign(d: HeatSinkDesign, ch: HeatSinkValidationContext): HeatSinkGeometryError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors = validateFinArray(design as unknown as FinArray, ch.designLimits, ch.base.widthM)
  const expected = ch.initialDesign.materialId
  const actual = design.materialId
  if (actual !== expected) {
    errors.push({
      code: 'LOCKED_FIELD_CHANGED',
      param: 'materialId',
      message: `${LOCKED_LABELS.materialId} is fixed by the challenge and cannot be changed (expected ${describe(expected, 'plain')}, got ${describe(actual, 'plain')}).`,
    })
  }
  return errors
}
