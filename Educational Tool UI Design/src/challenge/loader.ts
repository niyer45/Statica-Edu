import type { ZodIssue } from 'zod'
import { deepFreeze } from './deepFreeze'
import { challengeSchema } from './schema'
import type { Challenge, ParamRange, Result, SchemaIssue } from './types'

// Challenge loader (Req 3.1, 3.2, 3.4, 3.8, 3.9, 3.10).
// 1. Strings are parsed with JSON.parse; a parse failure is a single JSON_PARSE issue.
// 2. The zod schema runs; every zod issue is reported (unknown keys: one issue per key).
// 3. Only if the structure is valid, the section cross-field rules run; every violation
//    is reported with its own stable rule id.
// 4. On success the parsed Challenge (a fresh object, not the input) is deep-frozen.

/** Section cross-field rule ids. Stable: tests and the error page refer to them. */
export const CROSS_FIELD_RULES = {
  /** A ParamRange has minM > maxM. */
  RANGE_MIN_GT_MAX: 'RANGE_MIN_GT_MAX',
  /** A section default lies outside its permissible range. */
  DEFAULT_OUT_OF_RANGE: 'DEFAULT_OUT_OF_RANGE',
  /** I-section minimum flange thickness tf < 0.003 m. */
  I_FLANGE_MIN: 'I_FLANGE_MIN',
  /** I-section minimum web thickness tw < 0.003 m. */
  I_WEB_MIN: 'I_WEB_MIN',
  /** I-section minimum clear web height h − 2tf < 0.003 m. */
  I_CLEAR_WEB_MIN: 'I_CLEAR_WEB_MIN',
  /** The smallest allowed h cannot fit two minimum flanges plus the minimum clear web. */
  I_FLANGES_OVERLAP: 'I_FLANGES_OVERLAP',
  /** The minimum web thickness exceeds the smallest allowed flange width (tw ≤ b). */
  I_WEB_WIDER_THAN_FLANGE: 'I_WEB_WIDER_THAN_FLANGE',
  /** Tube minimum wall < 0.002 m. */
  TUBE_WALL_MIN: 'TUBE_WALL_MIN',
  /** Tube minimum wall is not less than half the smallest allowed outer diameter. */
  TUBE_WALL_TOO_THICK: 'TUBE_WALL_TOO_THICK',
} as const

/** Absolute floors from Req 3.9, metres. */
export const I_SECTION_MIN_THICKNESS_M = 0.003
export const I_SECTION_MIN_CLEAR_WEB_M = 0.003
export const TUBE_MIN_WALL_M = 0.002

/** Absolute tolerance (m) for config comparisons, so values like 0.1 − 2·0.003 compare cleanly. */
const TOL = 1e-9

/** Validates unknown JSON (string or value) into a deep-frozen Challenge. Never throws. */
export function loadChallenge(json: unknown): Result<Challenge, SchemaIssue[]> {
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

    const parsed = challengeSchema.safeParse(data)
    if (!parsed.success) return fail(parsed.error.issues.flatMap(fromZodIssue))

    const challenge: Challenge = parsed.data
    const issues = crossFieldIssues(challenge)
    if (issues.length > 0) return fail(issues)

    return { ok: true, value: deepFreeze(challenge) as Challenge }
  } catch (e) {
    // Defensive: hostile inputs (e.g. throwing getters or proxies) must not crash the app.
    const detail = e instanceof Error ? e.message : String(e)
    return fail([{ path: '', rule: 'UNEXPECTED', message: `Challenge could not be validated: ${detail}` }])
  }
}

function fail(issues: SchemaIssue[]): Result<Challenge, SchemaIssue[]> {
  return { ok: false, error: issues }
}

const joinPath = (path: readonly (string | number)[]): string => path.join('.')

/** Maps one zod issue to schema issues; `unrecognized_keys` yields one issue per undefined key. */
function fromZodIssue(issue: ZodIssue): SchemaIssue[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      path: joinPath([...issue.path, key]),
      rule: issue.code,
      message: `Unknown key "${key}" is not defined by the challenge schema.`,
    }))
  }
  return [{ path: joinPath(issue.path), rule: issue.code, message: issue.message }]
}

/** Section cross-field rules (Req 3.9). Runs on structurally valid data only. */
export function crossFieldIssues(ch: Challenge): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (path: string, rule: string, message: string) => issues.push({ path, rule, message })
  const lim = ch.sectionLimits
  const def = ch.sectionDefaults
  const R = CROSS_FIELD_RULES

  // Each range minimum ≤ its maximum.
  const ranges: [string, ParamRange][] = [
    ['sectionLimits.circle.diameterM', lim.circle.diameterM],
    ['sectionLimits.tube.outerDiameterM', lim.tube.outerDiameterM],
    ['sectionLimits.rectangle.widthM', lim.rectangle.widthM],
    ['sectionLimits.rectangle.heightM', lim.rectangle.heightM],
    ['sectionLimits.iSection.widthM', lim.iSection.widthM],
    ['sectionLimits.iSection.heightM', lim.iSection.heightM],
  ]
  for (const [path, r] of ranges) {
    if (r.minM > r.maxM + TOL) {
      add(path, R.RANGE_MIN_GT_MAX, `Range minimum ${r.minM} m is greater than maximum ${r.maxM} m.`)
    }
  }

  // Tube: wall ≥ 0.002 and < D/2 (for the smallest allowed D, so every D admits a wall).
  const tube = lim.tube
  if (tube.minWallM < TUBE_MIN_WALL_M - TOL) {
    add('sectionLimits.tube.minWallM', R.TUBE_WALL_MIN,
      `Tube minimum wall ${tube.minWallM} m is below ${TUBE_MIN_WALL_M} m.`)
  }
  if (tube.minWallM >= tube.outerDiameterM.minM / 2 - TOL) {
    add('sectionLimits.tube.minWallM', R.TUBE_WALL_TOO_THICK,
      `Tube minimum wall ${tube.minWallM} m must be less than half the minimum outer diameter (${tube.outerDiameterM.minM} m).`)
  }

  // I-section: tf ≥ 0.003, tw ≥ 0.003, h − 2tf ≥ 0.003, tw ≤ b.
  const is = lim.iSection
  if (is.minFlangeThicknessM < I_SECTION_MIN_THICKNESS_M - TOL) {
    add('sectionLimits.iSection.minFlangeThicknessM', R.I_FLANGE_MIN,
      `I-section minimum flange thickness ${is.minFlangeThicknessM} m is below ${I_SECTION_MIN_THICKNESS_M} m.`)
  }
  if (is.minWebThicknessM < I_SECTION_MIN_THICKNESS_M - TOL) {
    add('sectionLimits.iSection.minWebThicknessM', R.I_WEB_MIN,
      `I-section minimum web thickness ${is.minWebThicknessM} m is below ${I_SECTION_MIN_THICKNESS_M} m.`)
  }
  if (is.minClearWebHeightM < I_SECTION_MIN_CLEAR_WEB_M - TOL) {
    add('sectionLimits.iSection.minClearWebHeightM', R.I_CLEAR_WEB_MIN,
      `I-section minimum clear web height ${is.minClearWebHeightM} m is below ${I_SECTION_MIN_CLEAR_WEB_M} m.`)
  }
  if (is.heightM.minM - 2 * is.minFlangeThicknessM < is.minClearWebHeightM - TOL) {
    add('sectionLimits.iSection.heightM.minM', R.I_FLANGES_OVERLAP,
      `Minimum height ${is.heightM.minM} m cannot fit two ${is.minFlangeThicknessM} m flanges and a ${is.minClearWebHeightM} m clear web.`)
  }
  if (is.minWebThicknessM > is.widthM.minM + TOL) {
    add('sectionLimits.iSection.minWebThicknessM', R.I_WEB_WIDER_THAN_FLANGE,
      `Minimum web thickness ${is.minWebThicknessM} m exceeds the minimum flange width ${is.widthM.minM} m.`)
  }

  // Each section default lies within its permissible range (evaluated at the largest
  // allowed outer dimension; smaller sections fall back to the largest permissible value).
  const defaultRanges: [string, number, number, number, boolean][] = [
    // [path, value, min, max, maxExclusive]
    ['sectionDefaults.tubeWallM', def.tubeWallM, tube.minWallM, tube.outerDiameterM.maxM / 2, true],
    ['sectionDefaults.iSectionFlangeThicknessM', def.iSectionFlangeThicknessM, is.minFlangeThicknessM,
      (is.heightM.maxM - is.minClearWebHeightM) / 2, false],
    ['sectionDefaults.iSectionWebThicknessM', def.iSectionWebThicknessM, is.minWebThicknessM,
      is.widthM.maxM, false],
  ]
  for (const [path, value, min, max, maxExclusive] of defaultRanges) {
    const belowMin = value < min - TOL
    const aboveMax = maxExclusive ? value >= max - TOL : value > max + TOL
    if (belowMin || aboveMax) {
      add(path, R.DEFAULT_OUT_OF_RANGE,
        `Default ${value} m is outside its permissible range [${min}, ${max}${maxExclusive ? ')' : ']'} m.`)
    }
  }

  return issues
}
