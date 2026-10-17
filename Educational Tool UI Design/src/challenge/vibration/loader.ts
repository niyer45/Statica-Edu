import type { ZodIssue } from 'zod'
import { validateVibrationDesign } from '../../geometry/vibration/validate'
import { deepFreeze } from '../deepFreeze'
import type { Result, SchemaIssue } from '../types'
import { vibrationChallengeSchema } from './schema'
import { VIBRATION_LOCKED_FIELDS, type VibrationChallenge } from './types'

// Vibration Isolation I challenge loader (task 50.2; VIB-01–VIB-09, MM-02). Same pipeline as
// the beam and torsion loaders, which are unchanged:
// 1. Strings are parsed with JSON.parse; a parse failure is a single JSON_PARSE issue.
// 2. The zod schema runs; every zod issue is reported (unknown keys: one issue per key). A
//    missing or different model identity fails here, never falling back to another model.
// 3. Only if the structure is valid, the cross-field rules run; every violation is reported
//    with its own stable rule id.
// 4. On success the parsed config (a fresh object, not the input) is deep-frozen.

/** Vibration cross-field rule ids. Stable: tests and error pages refer to them. */
export const VIBRATION_CROSS_FIELD_RULES = {
  /** operatingBandHz.minHz is not below maxHz (design.md schema rule 0 < minHz < maxHz). */
  BAND_MIN_NOT_BELOW_MAX: 'BAND_MIN_NOT_BELOW_MAX',
  /** stiffnessLimits.minNPerM is not below maxNPerM (0 < minNPerM < maxNPerM). */
  STIFFNESS_MIN_NOT_BELOW_MAX: 'STIFFNESS_MIN_NOT_BELOW_MAX',
  /** Two materials share an id. */
  DUPLICATE_MATERIAL_ID: 'DUPLICATE_MATERIAL_ID',
  /** A material name contains a digit; explanation facts quote names, so they must not add numbers. */
  MATERIAL_NAME_HAS_DIGIT: 'MATERIAL_NAME_HAS_DIGIT',
  /** The chart range ends below the operating band maximum, so the band could not be shown. */
  CHART_BELOW_BAND: 'CHART_BELOW_BAND',
  /** A design fails the vibration design validator (stiffness range or unlisted material). */
  DESIGN_INVALID: 'DESIGN_INVALID',
  /** lockedFields omits one of massKg, operatingBandHz, amplitudeM, linearStrokeM (VIB-03). */
  LOCKED_FIELD_MISSING: 'LOCKED_FIELD_MISSING',
} as const

/** Validates unknown JSON (string or value) into a deep-frozen VibrationChallenge. Never throws. */
export function loadVibrationChallenge(json: unknown): Result<VibrationChallenge, SchemaIssue[]> {
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

    const parsed = vibrationChallengeSchema.safeParse(data)
    if (!parsed.success) return fail(parsed.error.issues.flatMap(fromZodIssue))

    const challenge: VibrationChallenge = parsed.data
    const issues = vibrationCrossFieldIssues(challenge)
    if (issues.length > 0) return fail(issues)

    return { ok: true, value: deepFreeze(challenge) as VibrationChallenge }
  } catch (e) {
    // Defensive: hostile inputs (e.g. throwing getters or proxies) must not crash the app.
    const detail = e instanceof Error ? e.message : String(e)
    return fail([{ path: '', rule: 'UNEXPECTED', message: `Challenge could not be validated: ${detail}` }])
  }
}

function fail(issues: SchemaIssue[]): Result<VibrationChallenge, SchemaIssue[]> {
  return { ok: false, error: issues }
}

/** Maps one zod issue to schema issues; `unrecognized_keys` yields one issue per undefined key. */
function fromZodIssue(issue: ZodIssue): SchemaIssue[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      path: [...issue.path, key].join('.'),
      rule: issue.code,
      message: `Unknown key "${key}" is not defined by the vibration challenge schema.`,
    }))
  }
  return [{ path: issue.path.join('.'), rule: issue.code, message: issue.message }]
}

/** Vibration cross-field rules, in a fixed order. Runs on structurally valid data only. */
export function vibrationCrossFieldIssues(ch: VibrationChallenge): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (path: string, rule: string, message: string) => issues.push({ path, rule, message })
  const R = VIBRATION_CROSS_FIELD_RULES
  const band = ch.excitation.operatingBandHz
  const k = ch.stiffnessLimits

  if (band.minHz >= band.maxHz) {
    add('excitation.operatingBandHz', R.BAND_MIN_NOT_BELOW_MAX,
      `Operating band minimum ${band.minHz} Hz must be below its maximum ${band.maxHz} Hz.`)
  }
  if (k.minNPerM >= k.maxNPerM) {
    add('stiffnessLimits', R.STIFFNESS_MIN_NOT_BELOW_MAX,
      `Stiffness minimum ${k.minNPerM} N/m must be below its maximum ${k.maxNPerM} N/m.`)
  }

  const seen = new Set<string>()
  ch.materials.forEach((m, i) => {
    if (seen.has(m.id)) add(`materials.${i}.id`, R.DUPLICATE_MATERIAL_ID, `Material id "${m.id}" is used more than once.`)
    seen.add(m.id)
    if (/\d/.test(m.name)) {
      add(`materials.${i}.name`, R.MATERIAL_NAME_HAS_DIGIT,
        `Material name "${m.name}" must not contain digits; explanation facts quote it and may only show stored numbers.`)
    }
  })

  if (ch.visualization.chartMaxHz < band.maxHz) {
    add('visualization.chartMaxHz', R.CHART_BELOW_BAND,
      `Chart range ${ch.visualization.chartMaxHz} Hz ends below the operating band maximum ${band.maxHz} Hz.`)
  }

  const designs = [['initialDesign', ch.initialDesign], ['referenceDesign', ch.referenceDesign]] as const
  for (const [name, d] of designs) {
    if (d === undefined) continue
    for (const e of validateVibrationDesign(d, ch)) {
      add(`${name}.${e.param ?? ''}`, R.DESIGN_INVALID, e.message)
    }
  }

  for (const field of VIBRATION_LOCKED_FIELDS) {
    if (!ch.lockedFields.includes(field)) {
      add('lockedFields', R.LOCKED_FIELD_MISSING, `Locked field "${field}" is missing; it is fixed for this model.`)
    }
  }

  return issues
}
