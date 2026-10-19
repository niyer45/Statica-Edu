import type { ZodIssue } from 'zod'
import { validateColumnSection } from '../../geometry/column/validate'
import { deepFreeze } from '../deepFreeze'
import type { ParamRange, Result, SchemaIssue } from '../types'
import { columnChallengeSchema } from './schema'
import { COLUMN_LOCKED_FIELDS, type ColumnChallenge } from './types'

// Column Buckling I challenge loader (task 68; CBK-01–CBK-07, MM-02). Same pipeline as the other
// model loaders, which are unchanged:
// 1. Strings are parsed with JSON.parse; a parse failure is a single JSON_PARSE issue.
// 2. The zod schema runs; every zod issue is reported (unknown keys: one issue per key). A
//    missing or different model identity fails here, never falling back to another model.
// 3. Only if the structure is valid, the cross-field rules run; every violation is reported with
//    its own stable rule id.
// 4. On success the parsed config (a fresh object, not the input) is deep-frozen.

/** Column cross-field rule ids. Stable: tests and error pages refer to them. */
export const COLUMN_CROSS_FIELD_RULES = {
  /** A ParamRange has minM > maxM. */
  RANGE_MIN_GT_MAX: 'RANGE_MIN_GT_MAX',
  /** The smallest tube outer diameter does not exceed twice the largest wall, so a tube could have no bore. */
  TUBE_BORE_CLOSED: 'TUBE_BORE_CLOSED',
  /** The default tube wall lies outside the wall range. */
  DEFAULT_OUT_OF_RANGE: 'DEFAULT_OUT_OF_RANGE',
  /** A design's lengthM differs from the challenge lengthM. */
  DESIGN_LENGTH_MISMATCH: 'DESIGN_LENGTH_MISMATCH',
  /** A design's materialId differs from material.id. */
  DESIGN_MATERIAL_MISMATCH: 'DESIGN_MATERIAL_MISMATCH',
  /** A design uses a section kind outside allowedSections. */
  DESIGN_SECTION_NOT_ALLOWED: 'DESIGN_SECTION_NOT_ALLOWED',
  /** A design's section fails the column geometry validator for the configured limits. */
  DESIGN_INVALID: 'DESIGN_INVALID',
  /** lockedFields omits one of lengthM, materialId, forceN, support (CBK-04). */
  LOCKED_FIELD_MISSING: 'LOCKED_FIELD_MISSING',
} as const

/** Absolute tolerance (m) for config comparisons, matching the other loaders. */
const TOL = 1e-9

/** Validates unknown JSON (string or value) into a deep-frozen ColumnChallenge. Never throws. */
export function loadColumnChallenge(json: unknown): Result<ColumnChallenge, SchemaIssue[]> {
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

    const parsed = columnChallengeSchema.safeParse(data)
    if (!parsed.success) return fail(parsed.error.issues.flatMap(fromZodIssue))

    const challenge: ColumnChallenge = parsed.data
    const issues = columnCrossFieldIssues(challenge)
    if (issues.length > 0) return fail(issues)

    return { ok: true, value: deepFreeze(challenge) as ColumnChallenge }
  } catch (e) {
    // Defensive: hostile inputs (e.g. throwing getters or proxies) must not crash the app.
    const detail = e instanceof Error ? e.message : String(e)
    return fail([{ path: '', rule: 'UNEXPECTED', message: `Challenge could not be validated: ${detail}` }])
  }
}

function fail(issues: SchemaIssue[]): Result<ColumnChallenge, SchemaIssue[]> {
  return { ok: false, error: issues }
}

/** Maps one zod issue to schema issues; `unrecognized_keys` yields one issue per undefined key. */
function fromZodIssue(issue: ZodIssue): SchemaIssue[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      path: [...issue.path, key].join('.'),
      rule: issue.code,
      message: `Unknown key "${key}" is not defined by the column challenge schema.`,
    }))
  }
  return [{ path: issue.path.join('.'), rule: issue.code, message: issue.message }]
}

/** Column cross-field rules, in a fixed order. Runs on structurally valid data only. */
export function columnCrossFieldIssues(ch: ColumnChallenge): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (path: string, rule: string, message: string) => issues.push({ path, rule, message })
  const R = COLUMN_CROSS_FIELD_RULES
  const lim = ch.sectionLimits

  const ranges: [string, ParamRange][] = [
    ['sectionLimits.solid.diameterM', lim.solid.diameterM],
    ['sectionLimits.tube.outerDiameterM', lim.tube.outerDiameterM],
    ['sectionLimits.tube.wallThicknessM', lim.tube.wallThicknessM],
  ]
  for (const [path, r] of ranges) {
    if (r.minM > r.maxM + TOL) {
      add(path, R.RANGE_MIN_GT_MAX, `Range minimum ${r.minM} m is greater than maximum ${r.maxM} m.`)
    }
  }

  if (!(lim.tube.outerDiameterM.minM > 2 * lim.tube.wallThicknessM.maxM + TOL)) {
    add('sectionLimits.tube', R.TUBE_BORE_CLOSED,
      `The smallest tube outer diameter (${lim.tube.outerDiameterM.minM} m) must exceed twice the largest wall (${lim.tube.wallThicknessM.maxM} m).`)
  }

  const wall = ch.sectionDefaults.tubeWallM
  const w = lim.tube.wallThicknessM
  if (wall < w.minM - TOL || wall > w.maxM + TOL) {
    add('sectionDefaults.tubeWallM', R.DEFAULT_OUT_OF_RANGE, `Default ${wall} m is outside the wall range [${w.minM}, ${w.maxM}] m.`)
  }

  const designs = [['initialDesign', ch.initialDesign], ['referenceDesign', ch.referenceDesign]] as const
  for (const [name, d] of designs) {
    if (d === undefined) continue
    if (d.lengthM !== ch.lengthM) {
      add(`${name}.lengthM`, R.DESIGN_LENGTH_MISMATCH, `Design length ${d.lengthM} m differs from the challenge length ${ch.lengthM} m.`)
    }
    if (d.materialId !== ch.material.id) {
      add(`${name}.materialId`, R.DESIGN_MATERIAL_MISMATCH,
        `Design material "${d.materialId}" differs from the challenge material "${ch.material.id}".`)
    }
    if (!ch.allowedSections.includes(d.section.kind)) {
      add(`${name}.section.kind`, R.DESIGN_SECTION_NOT_ALLOWED, `Design section "${d.section.kind}" is not in allowedSections.`)
    }
    for (const e of validateColumnSection(d.section, lim)) {
      add(`${name}.section.${e.param}`, R.DESIGN_INVALID, e.message)
    }
  }

  for (const field of COLUMN_LOCKED_FIELDS) {
    if (!ch.lockedFields.includes(field)) {
      add('lockedFields', R.LOCKED_FIELD_MISSING, `Locked field "${field}" is missing; it is fixed for this model.`)
    }
  }

  return issues
}
