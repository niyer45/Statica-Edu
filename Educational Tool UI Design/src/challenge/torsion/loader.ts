import type { ZodIssue } from 'zod'
import { validateTorsionSection } from '../../geometry/torsion/validate'
import { deepFreeze } from '../deepFreeze'
import type { ParamRange, Result, SchemaIssue } from '../types'
import { torsionChallengeSchema } from './schema'
import { TORSION_LOCKED_FIELDS, type TorsionChallenge } from './types'

// Torsion Shaft I challenge loader (task 47.2; TSH-01–TSH-07, MM-02). Same pipeline as the
// beam loader (challenge/loader.ts), which is unchanged:
// 1. Strings are parsed with JSON.parse; a parse failure is a single JSON_PARSE issue.
// 2. The zod schema runs; every zod issue is reported (unknown keys: one issue per key). A
//    missing or different model identity fails here, never falling back to another model.
// 3. Only if the structure is valid, the cross-field rules run; every violation is reported
//    with its own stable rule id.
// 4. On success the parsed config (a fresh object, not the input) is deep-frozen.

/** Torsion cross-field rule ids. Stable: tests and error pages refer to them. */
export const TORSION_CROSS_FIELD_RULES = {
  /** A ParamRange has minM > maxM. */
  RANGE_MIN_GT_MAX: 'RANGE_MIN_GT_MAX',
  /** Tube minimum wall < 0.002 m (TSH-04). */
  TUBE_WALL_MIN: 'TUBE_WALL_MIN',
  /** Tube minimum wall is not less than half the smallest allowed outer diameter. */
  TUBE_WALL_TOO_THICK: 'TUBE_WALL_TOO_THICK',
  /** The default tube wall lies outside [minWall, maxD/2). */
  DEFAULT_OUT_OF_RANGE: 'DEFAULT_OUT_OF_RANGE',
  /** A design's lengthM differs from the challenge lengthM. */
  DESIGN_LENGTH_MISMATCH: 'DESIGN_LENGTH_MISMATCH',
  /** A design's materialId differs from material.id. */
  DESIGN_MATERIAL_MISMATCH: 'DESIGN_MATERIAL_MISMATCH',
  /** A design uses a section kind outside allowedSections. */
  DESIGN_SECTION_NOT_ALLOWED: 'DESIGN_SECTION_NOT_ALLOWED',
  /** A design's section fails the torsion geometry validator for the configured limits. */
  DESIGN_INVALID: 'DESIGN_INVALID',
  /** lockedFields omits one of lengthM, materialId, torqueNm, support (TSH-03). */
  LOCKED_FIELD_MISSING: 'LOCKED_FIELD_MISSING',
} as const

/** Absolute tube wall floor from TSH-04, metres. */
export const TORSION_TUBE_MIN_WALL_M = 0.002

/** Absolute tolerance (m) for config comparisons, matching the beam loader. */
const TOL = 1e-9

/** Validates unknown JSON (string or value) into a deep-frozen TorsionChallenge. Never throws. */
export function loadTorsionChallenge(json: unknown): Result<TorsionChallenge, SchemaIssue[]> {
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

    const parsed = torsionChallengeSchema.safeParse(data)
    if (!parsed.success) return fail(parsed.error.issues.flatMap(fromZodIssue))

    const challenge: TorsionChallenge = parsed.data
    const issues = torsionCrossFieldIssues(challenge)
    if (issues.length > 0) return fail(issues)

    return { ok: true, value: deepFreeze(challenge) as TorsionChallenge }
  } catch (e) {
    // Defensive: hostile inputs (e.g. throwing getters or proxies) must not crash the app.
    const detail = e instanceof Error ? e.message : String(e)
    return fail([{ path: '', rule: 'UNEXPECTED', message: `Challenge could not be validated: ${detail}` }])
  }
}

function fail(issues: SchemaIssue[]): Result<TorsionChallenge, SchemaIssue[]> {
  return { ok: false, error: issues }
}

/** Maps one zod issue to schema issues; `unrecognized_keys` yields one issue per undefined key. */
function fromZodIssue(issue: ZodIssue): SchemaIssue[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      path: [...issue.path, key].join('.'),
      rule: issue.code,
      message: `Unknown key "${key}" is not defined by the torsion challenge schema.`,
    }))
  }
  return [{ path: issue.path.join('.'), rule: issue.code, message: issue.message }]
}

/** Torsion cross-field rules, in a fixed order. Runs on structurally valid data only. */
export function torsionCrossFieldIssues(ch: TorsionChallenge): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (path: string, rule: string, message: string) => issues.push({ path, rule, message })
  const R = TORSION_CROSS_FIELD_RULES
  const lim = ch.sectionLimits
  const tube = lim.tube

  const ranges: [string, ParamRange][] = [
    ['sectionLimits.circle.diameterM', lim.circle.diameterM],
    ['sectionLimits.tube.outerDiameterM', tube.outerDiameterM],
  ]
  for (const [path, r] of ranges) {
    if (r.minM > r.maxM + TOL) {
      add(path, R.RANGE_MIN_GT_MAX, `Range minimum ${r.minM} m is greater than maximum ${r.maxM} m.`)
    }
  }

  if (tube.minWallM < TORSION_TUBE_MIN_WALL_M - TOL) {
    add('sectionLimits.tube.minWallM', R.TUBE_WALL_MIN,
      `Tube minimum wall ${tube.minWallM} m is below ${TORSION_TUBE_MIN_WALL_M} m.`)
  }
  if (tube.minWallM >= tube.outerDiameterM.minM / 2 - TOL) {
    add('sectionLimits.tube.minWallM', R.TUBE_WALL_TOO_THICK,
      `Tube minimum wall ${tube.minWallM} m must be less than half the minimum outer diameter (${tube.outerDiameterM.minM} m).`)
  }

  const wall = ch.sectionDefaults.tubeWallM
  const maxWall = tube.outerDiameterM.maxM / 2
  if (wall < tube.minWallM - TOL || wall >= maxWall - TOL) {
    add('sectionDefaults.tubeWallM', R.DEFAULT_OUT_OF_RANGE,
      `Default ${wall} m is outside its permissible range [${tube.minWallM}, ${maxWall}) m.`)
  }

  const designs = [['initialDesign', ch.initialDesign], ['referenceDesign', ch.referenceDesign]] as const
  for (const [name, d] of designs) {
    if (d === undefined) continue
    if (d.lengthM !== ch.lengthM) {
      add(`${name}.lengthM`, R.DESIGN_LENGTH_MISMATCH,
        `Design length ${d.lengthM} m differs from the challenge length ${ch.lengthM} m.`)
    }
    if (d.materialId !== ch.material.id) {
      add(`${name}.materialId`, R.DESIGN_MATERIAL_MISMATCH,
        `Design material "${d.materialId}" differs from the challenge material "${ch.material.id}".`)
    }
    if (!ch.allowedSections.includes(d.section.kind)) {
      add(`${name}.section.kind`, R.DESIGN_SECTION_NOT_ALLOWED,
        `Design section "${d.section.kind}" is not in allowedSections.`)
    }
    for (const e of validateTorsionSection(d.section, lim)) {
      add(`${name}.section.${e.param}`, R.DESIGN_INVALID, e.message)
    }
  }

  for (const field of TORSION_LOCKED_FIELDS) {
    if (!ch.lockedFields.includes(field)) {
      add('lockedFields', R.LOCKED_FIELD_MISSING, `Locked field "${field}" is missing; it is fixed for this model.`)
    }
  }

  return issues
}
