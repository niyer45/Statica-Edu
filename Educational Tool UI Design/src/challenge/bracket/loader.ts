import type { ZodIssue } from 'zod'
import { validateBracketDimensions } from '../../geometry/bracket/validate'
import { deepFreeze } from '../deepFreeze'
import type { ParamRange, Result, SchemaIssue } from '../types'
import { bracketChallengeSchema } from './schema'
import { BRACKET_LOCKED_FIELDS, type BracketChallenge } from './types'

// Mounting Bracket I challenge loader (task 55 L-bracket; MM-02). Same pipeline as the beam and
// torsion loaders, which are unchanged:
// 1. Strings are parsed with JSON.parse; a parse failure is a single JSON_PARSE issue.
// 2. The zod schema runs; every zod issue is reported (unknown keys: one issue per key). A
//    missing or different model identity fails here, never falling back to another model.
// 3. Only if the structure is valid, the cross-field rules run; every violation is reported
//    with its own stable rule id.
// 4. On success the parsed config (a fresh object, not the input) is deep-frozen.

/** Bracket cross-field rule ids. Stable: tests and error pages refer to them. */
export const BRACKET_CROSS_FIELD_RULES = {
  /** A ParamRange has minM > maxM. */
  RANGE_MIN_GT_MAX: 'RANGE_MIN_GT_MAX',
  /**
   * The bolt row could sit in or below the bend: the shortest flange minus the bolt edge distance
   * does not clear the largest outer bend radius (r_i,max + t_max), so the bolt lever arm about
   * the heel would not be positive for every design in range.
   */
  BOLT_ROW_IN_BEND: 'BOLT_ROW_IN_BEND',
  /** The thinnest width is below the thickest thickness, so bending would not be about the thin axis. */
  WIDTH_BELOW_THICKNESS: 'WIDTH_BELOW_THICKNESS',
  /** A design's materialId differs from material.id. */
  DESIGN_MATERIAL_MISMATCH: 'DESIGN_MATERIAL_MISMATCH',
  /** A design fails the bracket dimension validator for the configured limits. */
  DESIGN_INVALID: 'DESIGN_INVALID',
  /** lockedFields omits one of loadOffsetM, materialId, forceN, bolts, support. */
  LOCKED_FIELD_MISSING: 'LOCKED_FIELD_MISSING',
} as const

/** Absolute tolerance (m) for config comparisons, matching the beam loader. */
const TOL = 1e-9

/** Validates unknown JSON (string or value) into a deep-frozen BracketChallenge. Never throws. */
export function loadBracketChallenge(json: unknown): Result<BracketChallenge, SchemaIssue[]> {
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

    const parsed = bracketChallengeSchema.safeParse(data)
    if (!parsed.success) return fail(parsed.error.issues.flatMap(fromZodIssue))

    const challenge: BracketChallenge = parsed.data
    const issues = bracketCrossFieldIssues(challenge)
    if (issues.length > 0) return fail(issues)

    return { ok: true, value: deepFreeze(challenge) as BracketChallenge }
  } catch (e) {
    // Defensive: hostile inputs (e.g. throwing getters or proxies) must not crash the app.
    const detail = e instanceof Error ? e.message : String(e)
    return fail([{ path: '', rule: 'UNEXPECTED', message: `Challenge could not be validated: ${detail}` }])
  }
}

function fail(issues: SchemaIssue[]): Result<BracketChallenge, SchemaIssue[]> {
  return { ok: false, error: issues }
}

/** Maps one zod issue to schema issues; `unrecognized_keys` yields one issue per undefined key. */
function fromZodIssue(issue: ZodIssue): SchemaIssue[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      path: [...issue.path, key].join('.'),
      rule: issue.code,
      message: `Unknown key "${key}" is not defined by the bracket challenge schema.`,
    }))
  }
  return [{ path: issue.path.join('.'), rule: issue.code, message: issue.message }]
}

/** Bracket cross-field rules, in a fixed order. Runs on structurally valid data only. */
export function bracketCrossFieldIssues(ch: BracketChallenge): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (path: string, rule: string, message: string) => issues.push({ path, rule, message })
  const R = BRACKET_CROSS_FIELD_RULES
  const lim = ch.designLimits

  const ranges: [string, ParamRange][] = [
    ['designLimits.thicknessM', lim.thicknessM],
    ['designLimits.widthM', lim.widthM],
    ['designLimits.flangeHeightM', lim.flangeHeightM],
    ['designLimits.innerRadiusM', lim.innerRadiusM],
  ]
  for (const [path, r] of ranges) {
    if (r.minM > r.maxM + TOL) {
      add(path, R.RANGE_MIN_GT_MAX, `Range minimum ${r.minM} m is greater than maximum ${r.maxM} m.`)
    }
  }

  const worstLeverM = lim.flangeHeightM.minM - ch.bolts.edgeDistanceM - (lim.innerRadiusM.maxM + lim.thicknessM.maxM)
  if (!(worstLeverM > TOL)) {
    add('designLimits.flangeHeightM', R.BOLT_ROW_IN_BEND,
      `The shortest flange (${lim.flangeHeightM.minM} m) minus the bolt edge distance (${ch.bolts.edgeDistanceM} m) must clear the largest outer bend radius (${lim.innerRadiusM.maxM + lim.thicknessM.maxM} m).`)
  }

  if (lim.widthM.minM < lim.thicknessM.maxM - TOL) {
    add('designLimits.widthM', R.WIDTH_BELOW_THICKNESS,
      `Width minimum ${lim.widthM.minM} m must be at least the thickness maximum ${lim.thicknessM.maxM} m.`)
  }

  const designs = [['initialDesign', ch.initialDesign], ['referenceDesign', ch.referenceDesign]] as const
  for (const [name, d] of designs) {
    if (d === undefined) continue
    if (d.materialId !== ch.material.id) {
      add(`${name}.materialId`, R.DESIGN_MATERIAL_MISMATCH,
        `Design material "${d.materialId}" differs from the challenge material "${ch.material.id}".`)
    }
    for (const e of validateBracketDimensions(d, lim)) {
      add(`${name}.${e.param}`, R.DESIGN_INVALID, e.message)
    }
  }

  for (const field of BRACKET_LOCKED_FIELDS) {
    if (!ch.lockedFields.includes(field)) {
      add('lockedFields', R.LOCKED_FIELD_MISSING, `Locked field "${field}" is missing; it is fixed for this model.`)
    }
  }

  return issues
}
