import type { ZodIssue } from 'zod'
import { validateFatigueDesign } from '../../geometry/fatigue/validate'
import {
  ENDURANCE_CYCLES,
  ENDURANCE_RATIO_MAX_SUT_MPA,
  FATIGUE_FRACTION_SUT_RANGE_KPSI,
  KT_FIT_LIMITS,
  LOW_CYCLE_LIMIT_CYCLES,
  MPA_PER_KPSI,
  NEUBER_SUT_RANGE_MPA,
  NONROTATING_EQUIVALENT_DIAMETER_RATIO,
  RELIABILITY_FACTORS,
  SIZE_FACTOR_SMALL,
} from '../../physics/fatigue/constants'
import { deepFreeze } from '../deepFreeze'
import type { ParamRange, Result, SchemaIssue } from '../types'
import { fatigueChallengeSchema } from './schema'
import { FATIGUE_LOCKED_FIELDS, type FatigueChallenge } from './types'

// Fatigue Analysis I challenge loader (task 70; FAT-13, MM-02). Same pipeline as the other model
// loaders: JSON.parse for strings, the strict zod schema (a missing or different model identity
// fails here), then cross-field rules with stable rule ids, then a deep-frozen fresh copy.
// The cross-field rules guarantee that every configured value stays inside the ranges of the
// correlations the model uses, so the analysis never extrapolates a fit for a valid design.

export const FATIGUE_CROSS_FIELD_RULES = {
  RANGE_MIN_GT_MAX: 'RANGE_MIN_GT_MAX',
  /** Sut outside the Neuber-constant fit (340–1700 MPa). */
  NEUBER_RANGE: 'NEUBER_RANGE',
  /** Sut outside the f fit (70–200 kpsi) or above 1400 MPa (Se′ = 0.5 Sut). */
  ENDURANCE_RANGE: 'ENDURANCE_RANGE',
  /** Yield strength not below the ultimate strength. */
  YIELD_ABOVE_ULTIMATE: 'YIELD_ABOVE_ULTIMATE',
  /** The equivalent diameter 0.370 d leaves the size-factor range (2.79–51 mm) for some neck diameter. */
  SIZE_FACTOR_RANGE: 'SIZE_FACTOR_RANGE',
  /** r/d or D/d could exceed the stress-concentration chart range for some in-range design. */
  KT_CHART_RANGE: 'KT_CHART_RANGE',
  /** Target life outside 10³–10⁶ cycles, the S-N line's range. */
  TARGET_LIFE_RANGE: 'TARGET_LIFE_RANGE',
  /** Reliability factor is not Shigley's factor for the stated percent. */
  RELIABILITY_FACTOR: 'RELIABILITY_FACTOR',
  /** The load arm is not on the neck (arm ≥ neck length). */
  LOAD_OFF_NECK: 'LOAD_OFF_NECK',
  /** A design's materialId differs from material.id, or the design fails the validator. */
  DESIGN_MATERIAL_MISMATCH: 'DESIGN_MATERIAL_MISMATCH',
  DESIGN_INVALID: 'DESIGN_INVALID',
  /** allowedFinishes lists a finish twice. */
  DUPLICATE_FINISH: 'DUPLICATE_FINISH',
  LOCKED_FIELD_MISSING: 'LOCKED_FIELD_MISSING',
} as const

const TOL = 1e-9

/** Validates unknown JSON (string or value) into a deep-frozen FatigueChallenge. Never throws. */
export function loadFatigueChallenge(json: unknown): Result<FatigueChallenge, SchemaIssue[]> {
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
    const parsed = fatigueChallengeSchema.safeParse(data)
    if (!parsed.success) return fail(parsed.error.issues.flatMap(fromZodIssue))
    const challenge: FatigueChallenge = parsed.data
    const issues = fatigueCrossFieldIssues(challenge)
    if (issues.length > 0) return fail(issues)
    return { ok: true, value: deepFreeze(challenge) as FatigueChallenge }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return fail([{ path: '', rule: 'UNEXPECTED', message: `Challenge could not be validated: ${detail}` }])
  }
}

function fail(issues: SchemaIssue[]): Result<FatigueChallenge, SchemaIssue[]> {
  return { ok: false, error: issues }
}

function fromZodIssue(issue: ZodIssue): SchemaIssue[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      path: [...issue.path, key].join('.'),
      rule: issue.code,
      message: `Unknown key "${key}" is not defined by the fatigue challenge schema.`,
    }))
  }
  return [{ path: issue.path.join('.'), rule: issue.code, message: issue.message }]
}

/** Fatigue cross-field rules, in a fixed order. Runs on structurally valid data only. */
export function fatigueCrossFieldIssues(ch: FatigueChallenge): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (path: string, rule: string, message: string) => issues.push({ path, rule, message })
  const R = FATIGUE_CROSS_FIELD_RULES
  const lim = ch.designLimits
  const sutMpa = ch.material.ultimateStrengthPa / 1e6

  const ranges: [string, ParamRange][] = [
    ['designLimits.neckDiameterM', lim.neckDiameterM],
    ['designLimits.collarDiameterM', lim.collarDiameterM],
    ['designLimits.filletRadiusM', lim.filletRadiusM],
  ]
  for (const [path, r] of ranges) {
    if (r.minM > r.maxM + TOL) add(path, R.RANGE_MIN_GT_MAX, `Range minimum ${r.minM} m is greater than maximum ${r.maxM} m.`)
  }

  if (sutMpa < NEUBER_SUT_RANGE_MPA.min || sutMpa > NEUBER_SUT_RANGE_MPA.max) {
    add('material.ultimateStrengthPa', R.NEUBER_RANGE, `Ultimate strength ${sutMpa} MPa is outside the notch-sensitivity fit (${NEUBER_SUT_RANGE_MPA.min}–${NEUBER_SUT_RANGE_MPA.max} MPa).`)
  }
  const sutKpsi = sutMpa / MPA_PER_KPSI
  if (sutKpsi < FATIGUE_FRACTION_SUT_RANGE_KPSI.min || sutKpsi > FATIGUE_FRACTION_SUT_RANGE_KPSI.max || sutMpa > ENDURANCE_RATIO_MAX_SUT_MPA) {
    add('material.ultimateStrengthPa', R.ENDURANCE_RANGE, `Ultimate strength ${sutMpa} MPa is outside the S-N estimates' range (${FATIGUE_FRACTION_SUT_RANGE_KPSI.min}–${FATIGUE_FRACTION_SUT_RANGE_KPSI.max} kpsi, at most ${ENDURANCE_RATIO_MAX_SUT_MPA} MPa).`)
  }
  if (!(ch.material.yieldStrengthPa < ch.material.ultimateStrengthPa)) {
    add('material.yieldStrengthPa', R.YIELD_ABOVE_ULTIMATE, 'Yield strength must be below the ultimate strength.')
  }

  const deMin = NONROTATING_EQUIVALENT_DIAMETER_RATIO * lim.neckDiameterM.minM * 1e3
  const deMax = NONROTATING_EQUIVALENT_DIAMETER_RATIO * lim.neckDiameterM.maxM * 1e3
  if (deMin < SIZE_FACTOR_SMALL.minMm || deMax > SIZE_FACTOR_SMALL.maxMm) {
    add('designLimits.neckDiameterM', R.SIZE_FACTOR_RANGE, `Equivalent diameters ${deMin}–${deMax} mm leave the size-factor range (${SIZE_FACTOR_SMALL.minMm}–${SIZE_FACTOR_SMALL.maxMm} mm).`)
  }
  if (lim.filletRadiusM.maxM / lim.neckDiameterM.minM > KT_FIT_LIMITS.maxFilletToNeck + TOL || lim.collarDiameterM.maxM / lim.neckDiameterM.minM > KT_FIT_LIMITS.maxCollarToNeck + TOL) {
    add('designLimits', R.KT_CHART_RANGE, `The ranges allow r/d above ${KT_FIT_LIMITS.maxFilletToNeck} or D/d above ${KT_FIT_LIMITS.maxCollarToNeck}, outside the stress-concentration chart.`)
  }
  if (ch.targetLifeCycles < LOW_CYCLE_LIMIT_CYCLES || ch.targetLifeCycles > ENDURANCE_CYCLES) {
    add('targetLifeCycles', R.TARGET_LIFE_RANGE, `Target life ${ch.targetLifeCycles} cycles is outside ${LOW_CYCLE_LIMIT_CYCLES}–${ENDURANCE_CYCLES} cycles.`)
  }
  const expectedKe = RELIABILITY_FACTORS[String(ch.reliability.percent)]
  if (expectedKe === undefined || expectedKe !== ch.reliability.factor) {
    add('reliability.factor', R.RELIABILITY_FACTOR, `Reliability factor ${ch.reliability.factor} does not match the tabulated factor for ${ch.reliability.percent} % reliability.`)
  }
  if (!(ch.load.armM < ch.geometry.neckLengthM)) {
    add('load.armM', R.LOAD_OFF_NECK, `The load arm ${ch.load.armM} m must be shorter than the neck length ${ch.geometry.neckLengthM} m.`)
  }
  if (new Set(ch.allowedFinishes).size !== ch.allowedFinishes.length) {
    add('allowedFinishes', R.DUPLICATE_FINISH, 'Each surface finish may be listed once.')
  }

  const designs = [['initialDesign', ch.initialDesign], ['referenceDesign', ch.referenceDesign]] as const
  for (const [name, d] of designs) {
    if (d === undefined) continue
    if (d.materialId !== ch.material.id) {
      add(`${name}.materialId`, R.DESIGN_MATERIAL_MISMATCH, `Design material "${d.materialId}" differs from the challenge material "${ch.material.id}".`)
    }
    for (const e of validateFatigueDesign(d, { ...ch, initialDesign: { ...d, materialId: ch.material.id } })) {
      if (e.code === 'LOCKED_FIELD_CHANGED') continue
      add(`${name}.${e.param ?? ''}`, R.DESIGN_INVALID, e.message)
    }
  }

  for (const field of FATIGUE_LOCKED_FIELDS) {
    if (!ch.lockedFields.includes(field)) add('lockedFields', R.LOCKED_FIELD_MISSING, `Locked field "${field}" is missing; it is fixed for this model.`)
  }
  return issues
}
