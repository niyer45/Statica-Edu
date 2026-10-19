import type { ZodIssue } from 'zod'
import { validateVesselDimensions } from '../../geometry/vessel/validate'
import { deepFreeze } from '../deepFreeze'
import type { ParamRange, Result, SchemaIssue } from '../types'
import { vesselChallengeSchema } from './schema'
import { VESSEL_LOCKED_FIELDS, type VesselChallenge } from './types'

// Pressure Vessel I challenge loader (task 69; PVS-01–PVS-07, MM-02). Same pipeline as the
// other model loaders, which are unchanged:
// 1. Strings are parsed with JSON.parse; a parse failure is a single JSON_PARSE issue.
// 2. The zod schema runs; every zod issue is reported (unknown keys: one issue per key). A
//    missing or different model identity fails here, never falling back to another model.
// 3. Only if the structure is valid, the cross-field rules run; every violation is reported
//    with its own stable rule id.
// 4. On success the parsed config (a fresh object, not the input) is deep-frozen.

/** Vessel cross-field rule ids. Stable: tests and error pages refer to them. */
export const VESSEL_CROSS_FIELD_RULES = {
  /** A ParamRange has minM > maxM. */
  RANGE_MIN_GT_MAX: 'RANGE_MIN_GT_MAX',
  /** The design factor is below 1, so the allowable would exceed yield. */
  DESIGN_FACTOR_BELOW_ONE: 'DESIGN_FACTOR_BELOW_ONE',
  /** A design's materialId differs from material.id. */
  DESIGN_MATERIAL_MISMATCH: 'DESIGN_MATERIAL_MISMATCH',
  /** A design fails the vessel dimension validator for the configured limits. */
  DESIGN_INVALID: 'DESIGN_INVALID',
  /** lockedFields omits one of materialId, pressurePa, designFactor, heads. */
  LOCKED_FIELD_MISSING: 'LOCKED_FIELD_MISSING',
} as const

/** Absolute tolerance (m) for config comparisons, matching the beam loader. */
const TOL = 1e-9

/** Validates unknown JSON (string or value) into a deep-frozen VesselChallenge. Never throws. */
export function loadVesselChallenge(json: unknown): Result<VesselChallenge, SchemaIssue[]> {
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

    const parsed = vesselChallengeSchema.safeParse(data)
    if (!parsed.success) return fail(parsed.error.issues.flatMap(fromZodIssue))

    const challenge: VesselChallenge = parsed.data
    const issues = vesselCrossFieldIssues(challenge)
    if (issues.length > 0) return fail(issues)

    return { ok: true, value: deepFreeze(challenge) as VesselChallenge }
  } catch (e) {
    // Defensive: hostile inputs (e.g. throwing getters or proxies) must not crash the app.
    const detail = e instanceof Error ? e.message : String(e)
    return fail([{ path: '', rule: 'UNEXPECTED', message: `Challenge could not be validated: ${detail}` }])
  }
}

function fail(issues: SchemaIssue[]): Result<VesselChallenge, SchemaIssue[]> {
  return { ok: false, error: issues }
}

/** Maps one zod issue to schema issues; `unrecognized_keys` yields one issue per undefined key. */
function fromZodIssue(issue: ZodIssue): SchemaIssue[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      path: [...issue.path, key].join('.'),
      rule: issue.code,
      message: `Unknown key "${key}" is not defined by the pressure vessel challenge schema.`,
    }))
  }
  return [{ path: issue.path.join('.'), rule: issue.code, message: issue.message }]
}

/** Vessel cross-field rules, in a fixed order. Runs on structurally valid data only. */
export function vesselCrossFieldIssues(ch: VesselChallenge): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (path: string, rule: string, message: string) => issues.push({ path, rule, message })
  const R = VESSEL_CROSS_FIELD_RULES
  const lim = ch.designLimits

  const ranges: [string, ParamRange][] = [
    ['designLimits.innerDiameterM', lim.innerDiameterM],
    ['designLimits.shellLengthM', lim.shellLengthM],
    ['designLimits.shellThicknessM', lim.shellThicknessM],
    ['designLimits.headThicknessM', lim.headThicknessM],
  ]
  for (const [path, r] of ranges) {
    if (r.minM > r.maxM + TOL) {
      add(path, R.RANGE_MIN_GT_MAX, `Range minimum ${r.minM} m is greater than maximum ${r.maxM} m.`)
    }
  }

  if (ch.designFactor < 1) {
    add('designFactor', R.DESIGN_FACTOR_BELOW_ONE, `Design factor ${ch.designFactor} must be at least 1.`)
  }

  const designs = [['initialDesign', ch.initialDesign], ['referenceDesign', ch.referenceDesign]] as const
  for (const [name, d] of designs) {
    if (d === undefined) continue
    if (d.materialId !== ch.material.id) {
      add(`${name}.materialId`, R.DESIGN_MATERIAL_MISMATCH,
        `Design material "${d.materialId}" differs from the challenge material "${ch.material.id}".`)
    }
    for (const e of validateVesselDimensions(d, lim)) {
      add(`${name}.${e.param}`, R.DESIGN_INVALID, e.message)
    }
  }

  for (const field of VESSEL_LOCKED_FIELDS) {
    if (!ch.lockedFields.includes(field)) {
      add('lockedFields', R.LOCKED_FIELD_MISSING, `Locked field "${field}" is missing; it is fixed for this model.`)
    }
  }

  return issues
}
