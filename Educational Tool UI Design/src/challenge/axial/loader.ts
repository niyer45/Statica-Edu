import type { ZodIssue } from 'zod'
import { checkDiameter } from '../../geometry/axial/validate'
import { deepFreeze } from '../deepFreeze'
import type { Result, SchemaIssue } from '../types'
import { axialChallengeSchema } from './schema'
import { AXIAL_LOCKED_FIELDS, type AxialChallenge } from './types'

// Stress and Strain I challenge loader (task 72; SSR-01–SSR-11, MM-02). Same pipeline as the
// other loaders, which are unchanged:
// 1. Strings are parsed with JSON.parse; a parse failure is a single JSON_PARSE issue.
// 2. The zod schema runs; every zod issue is reported (unknown keys: one issue per key). A
//    missing or different model identity fails here, never falling back to another model.
// 3. Only if the structure is valid, the cross-field rules run; every violation is reported
//    with its own stable rule id.
// 4. On success the parsed config (a fresh object, not the input) is deep-frozen.

/** Cross-field rule ids. Stable: tests and error pages refer to them. */
export const AXIAL_CROSS_FIELD_RULES = {
  /** diameterLimits has minM > maxM. */
  RANGE_MIN_GT_MAX: 'RANGE_MIN_GT_MAX',
  /** Two materials share an id. */
  MATERIAL_ID_DUPLICATE: 'MATERIAL_ID_DUPLICATE',
  /** A material short name contains a digit; explanation facts quote it, so it must not add numbers. */
  MATERIAL_SHORT_NAME_HAS_DIGIT: 'MATERIAL_SHORT_NAME_HAS_DIGIT',
  /** A design names a material that is not listed. */
  DESIGN_MATERIAL_NOT_LISTED: 'DESIGN_MATERIAL_NOT_LISTED',
  /** A design's diameter fails the range check. */
  DESIGN_INVALID: 'DESIGN_INVALID',
  /** lockedFields omits one of lengthM, forceN, designFactor, support (SSR-03). */
  LOCKED_FIELD_MISSING: 'LOCKED_FIELD_MISSING',
  /**
   * The rod is shorter than ROD_MIN_SLENDERNESS times the largest diameter, so Saint-Venant end
   * effects near the pins would no longer be confined to a short length (SSR-11).
   */
  ROD_TOO_SHORT: 'ROD_TOO_SHORT',
} as const

/** Minimum length / largest diameter (SSR-11). */
export const ROD_MIN_SLENDERNESS = 10

/** Validates unknown JSON (string or value) into a deep-frozen AxialChallenge. Never throws. */
export function loadAxialChallenge(json: unknown): Result<AxialChallenge, SchemaIssue[]> {
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

    const parsed = axialChallengeSchema.safeParse(data)
    if (!parsed.success) return fail(parsed.error.issues.flatMap(fromZodIssue))

    const challenge: AxialChallenge = parsed.data
    const issues = axialCrossFieldIssues(challenge)
    if (issues.length > 0) return fail(issues)

    return { ok: true, value: deepFreeze(challenge) as AxialChallenge }
  } catch (e) {
    // Defensive: hostile inputs (e.g. throwing getters or proxies) must not crash the app.
    const detail = e instanceof Error ? e.message : String(e)
    return fail([{ path: '', rule: 'UNEXPECTED', message: `Challenge could not be validated: ${detail}` }])
  }
}

function fail(issues: SchemaIssue[]): Result<AxialChallenge, SchemaIssue[]> {
  return { ok: false, error: issues }
}

/** Maps one zod issue to schema issues; `unrecognized_keys` yields one issue per undefined key. */
function fromZodIssue(issue: ZodIssue): SchemaIssue[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      path: [...issue.path, key].join('.'),
      rule: issue.code,
      message: `Unknown key "${key}" is not defined by the stress and strain challenge schema.`,
    }))
  }
  return [{ path: issue.path.join('.'), rule: issue.code, message: issue.message }]
}

/** Cross-field rules, in a fixed order. Runs on structurally valid data only. */
export function axialCrossFieldIssues(ch: AxialChallenge): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (path: string, rule: string, message: string) => issues.push({ path, rule, message })
  const R = AXIAL_CROSS_FIELD_RULES
  const r = ch.diameterLimits

  if (r.minM > r.maxM) {
    add('diameterLimits', R.RANGE_MIN_GT_MAX, `Range minimum ${r.minM} m is greater than maximum ${r.maxM} m.`)
  }

  const seen = new Set<string>()
  ch.materials.forEach((m, i) => {
    if (seen.has(m.id)) add(`materials.${i}.id`, R.MATERIAL_ID_DUPLICATE, `Material id "${m.id}" is listed more than once.`)
    seen.add(m.id)
    if (/\d/.test(m.shortName)) {
      add(`materials.${i}.shortName`, R.MATERIAL_SHORT_NAME_HAS_DIGIT,
        `Material short name "${m.shortName}" must not contain digits; explanation facts quote it and may only show stored numbers.`)
    }
  })

  const designs = [['initialDesign', ch.initialDesign], ['referenceDesign', ch.referenceDesign]] as const
  for (const [name, d] of designs) {
    if (d === undefined) continue
    if (!ch.materials.some((m) => m.id === d.materialId)) {
      add(`${name}.materialId`, R.DESIGN_MATERIAL_NOT_LISTED, `Design material "${d.materialId}" is not in materials.`)
    }
    const e = checkDiameter(d.diameterM, r)
    if (e) add(`${name}.diameterM`, R.DESIGN_INVALID, e.message)
  }

  for (const field of AXIAL_LOCKED_FIELDS) {
    if (!ch.lockedFields.includes(field)) {
      add('lockedFields', R.LOCKED_FIELD_MISSING, `Locked field "${field}" is missing; it is fixed for this model.`)
    }
  }

  if (ch.lengthM < ROD_MIN_SLENDERNESS * r.maxM) {
    add('lengthM', R.ROD_TOO_SHORT,
      `Rod length ${ch.lengthM} m must be at least ${ROD_MIN_SLENDERNESS} times the largest diameter (${r.maxM} m).`)
  }

  return issues
}
