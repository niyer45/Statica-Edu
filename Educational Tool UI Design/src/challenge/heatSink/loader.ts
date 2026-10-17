import type { ZodIssue } from 'zod'
import { validateFinArray } from '../../geometry/heatSink/validate'
import { deepFreeze } from '../deepFreeze'
import type { ParamRange, Result, SchemaIssue } from '../types'
import { heatSinkChallengeSchema } from './schema'
import { HEAT_SINK_LOCKED_FIELDS, type HeatSinkChallenge } from './types'

// Heat Sink I challenge loader (task 48.2; HSK-01–HSK-09, MM-02). Same pipeline as the beam and
// torsion loaders, which are unchanged:
// 1. Strings are parsed with JSON.parse; a parse failure is a single JSON_PARSE issue.
// 2. The zod schema runs; every zod issue is reported (unknown keys: one issue per key). A
//    missing or different model identity fails here, never falling back to another model.
// 3. Only if the structure is valid, the cross-field rules run; every violation is reported
//    with its own stable rule id.
// 4. On success the parsed config (a fresh object, not the input) is deep-frozen.

/** Heat sink cross-field rule ids. Stable: tests and error pages refer to them. */
export const HEAT_SINK_CROSS_FIELD_RULES = {
  /** A range has its minimum above its maximum. */
  RANGE_MIN_GT_MAX: 'RANGE_MIN_GT_MAX',
  /** A length range's maximum is not on the grid min + k·step, so it could never be selected. */
  RANGE_MAX_OFF_STEP: 'RANGE_MAX_OFF_STEP',
  /** The fin-count minimum is below 2; the gap is undefined for one fin (HSK-04). */
  FIN_COUNT_MIN: 'FIN_COUNT_MIN',
  /** The base temperature limit is not above the ambient temperature, so no design can meet it. */
  TEMPERATURE_LIMIT_NOT_ABOVE_AMBIENT: 'TEMPERATURE_LIMIT_NOT_ABOVE_AMBIENT',
  /** Profile samples are not strictly increasing from 0 (fin root) to 1 (fin tip). */
  PROFILE_SAMPLES_INVALID: 'PROFILE_SAMPLES_INVALID',
  /** A design's materialId differs from material.id. */
  DESIGN_MATERIAL_MISMATCH: 'DESIGN_MATERIAL_MISMATCH',
  /** A design's fins fail the heat sink geometry validator for the configured limits. */
  DESIGN_INVALID: 'DESIGN_INVALID',
  /** lockedFields omits one of base, materialId, heatLoadW, ambientTemperatureK, convection (HSK-03). */
  LOCKED_FIELD_MISSING: 'LOCKED_FIELD_MISSING',
} as const

/** Absolute tolerance (m) for config comparisons, matching the beam and torsion loaders. */
const TOL = 1e-9

/** Validates unknown JSON (string or value) into a deep-frozen HeatSinkChallenge. Never throws. */
export function loadHeatSinkChallenge(json: unknown): Result<HeatSinkChallenge, SchemaIssue[]> {
  try {
    let data: unknown = json
    if (typeof json === 'string') {
      try {
        data = JSON.parse(json)
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        return fail([{ path: '', rule: 'JSON_PARSE', message: `Input is not valid JSON: ${detail}` }])
      }
    }

    const parsed = heatSinkChallengeSchema.safeParse(data)
    if (!parsed.success) return fail(parsed.error.issues.flatMap(fromZodIssue))

    const challenge: HeatSinkChallenge = parsed.data
    const issues = heatSinkCrossFieldIssues(challenge)
    if (issues.length > 0) return fail(issues)

    return { ok: true, value: deepFreeze(challenge) as HeatSinkChallenge }
  } catch (e) {
    // Defensive: hostile inputs (e.g. throwing getters or proxies) must not crash the app.
    const detail = e instanceof Error ? e.message : String(e)
    return fail([{ path: '', rule: 'UNEXPECTED', message: `Challenge could not be validated: ${detail}` }])
  }
}

function fail(issues: SchemaIssue[]): Result<HeatSinkChallenge, SchemaIssue[]> {
  return { ok: false, error: issues }
}

/** Maps one zod issue to schema issues; `unrecognized_keys` yields one issue per undefined key. */
function fromZodIssue(issue: ZodIssue): SchemaIssue[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      path: [...issue.path, key].join('.'),
      rule: issue.code,
      message: `Unknown key "${key}" is not defined by the heat sink challenge schema.`,
    }))
  }
  return [{ path: issue.path.join('.'), rule: issue.code, message: issue.message }]
}

/** Heat sink cross-field rules, in a fixed order. Runs on structurally valid data only. */
export function heatSinkCrossFieldIssues(ch: HeatSinkChallenge): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (path: string, rule: string, message: string) => issues.push({ path, rule, message })
  const R = HEAT_SINK_CROSS_FIELD_RULES
  const lim = ch.designLimits

  if (lim.finCount.min > lim.finCount.max) {
    add('designLimits.finCount', R.RANGE_MIN_GT_MAX, `Range minimum ${lim.finCount.min} is greater than maximum ${lim.finCount.max}.`)
  }
  const ranges: [string, ParamRange][] = [
    ['designLimits.finThicknessM', lim.finThicknessM],
    ['designLimits.finHeightM', lim.finHeightM],
  ]
  for (const [path, r] of ranges) {
    if (r.minM > r.maxM + TOL) {
      add(path, R.RANGE_MIN_GT_MAX, `Range minimum ${r.minM} m is greater than maximum ${r.maxM} m.`)
    } else {
      const k = Math.round((r.maxM - r.minM) / r.stepM)
      if (Math.abs(r.maxM - (r.minM + k * r.stepM)) > TOL) {
        add(path, R.RANGE_MAX_OFF_STEP, `Range maximum ${r.maxM} m is not a multiple of ${r.stepM} m from ${r.minM} m.`)
      }
    }
  }

  if (lim.finCount.min < 2) {
    add('designLimits.finCount.min', R.FIN_COUNT_MIN, `Fin count minimum ${lim.finCount.min} is below 2; the fin gap is undefined for one fin.`)
  }

  if (ch.constraints.maxBaseTemperatureK <= ch.ambientTemperatureK) {
    add('constraints.maxBaseTemperatureK', R.TEMPERATURE_LIMIT_NOT_ABOVE_AMBIENT,
      `Base temperature limit ${ch.constraints.maxBaseTemperatureK} K must be above the ambient temperature ${ch.ambientTemperatureK} K.`)
  }

  const samples = ch.visualization.profileSamplesXOverH
  const increasing = samples.every((x, i) => i === 0 || x > samples[i - 1])
  if (samples[0] !== 0 || samples[samples.length - 1] !== 1 || !increasing) {
    add('visualization.profileSamplesXOverH', R.PROFILE_SAMPLES_INVALID,
      'Profile samples must increase strictly from 0 (fin root) to 1 (fin tip).')
  }

  const designs = [['initialDesign', ch.initialDesign], ['referenceDesign', ch.referenceDesign]] as const
  for (const [name, d] of designs) {
    if (d === undefined) continue
    if (d.materialId !== ch.material.id) {
      add(`${name}.materialId`, R.DESIGN_MATERIAL_MISMATCH,
        `Design material "${d.materialId}" differs from the challenge material "${ch.material.id}".`)
    }
    for (const e of validateFinArray(d, lim, ch.base.widthM)) {
      add(`${name}.${e.param}`, R.DESIGN_INVALID, e.message)
    }
  }

  for (const field of HEAT_SINK_LOCKED_FIELDS) {
    if (!ch.lockedFields.includes(field)) {
      add('lockedFields', R.LOCKED_FIELD_MISSING, `Locked field "${field}" is missing; it is fixed for this model.`)
    }
  }

  return issues
}
