import type { ZodIssue } from 'zod'
import { FRAME_SUPPORT_JOINT_IDS } from '../../geometry/bracedFrame/template'
import { validateBracedFrameDesign } from '../../geometry/bracedFrame/validate'
import { deepFreeze } from '../deepFreeze'
import type { Result, SchemaIssue } from '../types'
import { bracedFrameChallengeSchema } from './schema'
import { BRACED_FRAME_LOCKED_FIELDS, type BracedFrameChallenge } from './types'

// Braced Frame I challenge loader (task 49.2; BFR-01–BFR-09, BFR-15, MM-02). Same pipeline as
// the beam and torsion loaders, which are unchanged:
// 1. Strings are parsed with JSON.parse; a parse failure is a single JSON_PARSE issue.
// 2. The zod schema runs; every zod issue is reported (unknown keys: one issue per key). A
//    missing or different model identity, an unknown template, a non-positive dimension or a
//    non-finite number fails here, never falling back to another model.
// 3. Only if the structure is valid, the cross-field rules run; every violation is reported
//    with its own stable rule id. Invalid configs are therefore rejected before any analysis.
// 4. On success the parsed config (a fresh object, not the input) is deep-frozen.

/** Braced-frame cross-field rule ids. Stable: tests and error pages refer to them. */
export const BRACED_FRAME_CROSS_FIELD_RULES = {
  /** Two catalog sections share an id. */
  SECTION_DUPLICATE_ID: 'SECTION_DUPLICATE_ID',
  /** A section's wall t is not less than half its outer diameter D (no bore). */
  SECTION_WALL_TOO_THICK: 'SECTION_WALL_TOO_THICK',
  /** A load is applied at a pinned support joint, where the support would absorb it. */
  LOAD_ON_SUPPORT: 'LOAD_ON_SUPPORT',
  /** Two loads name the same joint. */
  LOAD_DUPLICATE_JOINT: 'LOAD_DUPLICATE_JOINT',
  /** Every load component is zero, so no response is defined. */
  LOADS_ALL_ZERO: 'LOADS_ALL_ZERO',
  /** A design's materialId differs from material.id. */
  DESIGN_MATERIAL_MISMATCH: 'DESIGN_MATERIAL_MISMATCH',
  /** A design fails the braced-frame validator (e.g. a section outside the catalog). */
  DESIGN_INVALID: 'DESIGN_INVALID',
  /** lockedFields omits one of frame, supports, loads, materialId, fixedMembers (BFR-03). */
  LOCKED_FIELD_MISSING: 'LOCKED_FIELD_MISSING',
} as const

/** Validates unknown JSON (string or value) into a deep-frozen BracedFrameChallenge. Never throws. */
export function loadBracedFrameChallenge(json: unknown): Result<BracedFrameChallenge, SchemaIssue[]> {
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

    const parsed = bracedFrameChallengeSchema.safeParse(data)
    if (!parsed.success) return fail(parsed.error.issues.flatMap(fromZodIssue))

    const challenge: BracedFrameChallenge = parsed.data
    const issues = bracedFrameCrossFieldIssues(challenge)
    if (issues.length > 0) return fail(issues)

    return { ok: true, value: deepFreeze(challenge) as BracedFrameChallenge }
  } catch (e) {
    // Defensive: hostile inputs (e.g. throwing getters or proxies) must not crash the app.
    const detail = e instanceof Error ? e.message : String(e)
    return fail([{ path: '', rule: 'UNEXPECTED', message: `Challenge could not be validated: ${detail}` }])
  }
}

function fail(issues: SchemaIssue[]): Result<BracedFrameChallenge, SchemaIssue[]> {
  return { ok: false, error: issues }
}

/** Maps one zod issue to schema issues; `unrecognized_keys` yields one issue per undefined key. */
function fromZodIssue(issue: ZodIssue): SchemaIssue[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      path: [...issue.path, key].join('.'),
      rule: issue.code,
      message: `Unknown key "${key}" is not defined by the braced-frame challenge schema.`,
    }))
  }
  return [{ path: issue.path.join('.'), rule: issue.code, message: issue.message }]
}

/** Braced-frame cross-field rules, in a fixed order. Runs on structurally valid data only. */
export function bracedFrameCrossFieldIssues(ch: BracedFrameChallenge): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (path: string, rule: string, message: string) => issues.push({ path, rule, message })
  const R = BRACED_FRAME_CROSS_FIELD_RULES

  const seenSections = new Set<string>()
  ch.sections.forEach((s, i) => {
    if (seenSections.has(s.id)) add(`sections.${i}.id`, R.SECTION_DUPLICATE_ID, `Section id "${s.id}" is used more than once.`)
    seenSections.add(s.id)
    if (s.wallM >= s.outerDiameterM / 2) {
      add(`sections.${i}.wallM`, R.SECTION_WALL_TOO_THICK,
        `Section "${s.id}" wall ${s.wallM} m must be less than half its outer diameter (${s.outerDiameterM} m).`)
    }
  })

  const seenJoints = new Set<string>()
  ch.loads.forEach((load, i) => {
    if ((FRAME_SUPPORT_JOINT_IDS as readonly string[]).includes(load.jointId)) {
      add(`loads.${i}.jointId`, R.LOAD_ON_SUPPORT, `Load at support joint ${load.jointId} would be absorbed by the support.`)
    }
    if (seenJoints.has(load.jointId)) add(`loads.${i}.jointId`, R.LOAD_DUPLICATE_JOINT, `Joint ${load.jointId} is loaded more than once.`)
    seenJoints.add(load.jointId)
  })
  if (ch.loads.every((l) => l.fxN === 0 && l.fyN === 0)) add('loads', R.LOADS_ALL_ZERO, 'At least one load component must be non-zero.')

  const designs = [['initialDesign', ch.initialDesign], ['referenceDesign', ch.referenceDesign]] as const
  for (const [name, d] of designs) {
    if (d === undefined) continue
    if (d.materialId !== ch.material.id) {
      add(`${name}.materialId`, R.DESIGN_MATERIAL_MISMATCH,
        `Design material "${d.materialId}" differs from the challenge material "${ch.material.id}".`)
    }
    // Locked-field changes are reported above; the validator's own copy would repeat them.
    for (const e of validateBracedFrameDesign(d, { initialDesign: d, sections: ch.sections })) {
      add(`${name}.members.${e.param ?? ''}`, R.DESIGN_INVALID, e.message)
    }
  }

  for (const field of BRACED_FRAME_LOCKED_FIELDS) {
    if (!ch.lockedFields.includes(field)) {
      add('lockedFields', R.LOCKED_FIELD_MISSING, `Locked field "${field}" is missing; it is fixed for this model.`)
    }
  }

  return issues
}
