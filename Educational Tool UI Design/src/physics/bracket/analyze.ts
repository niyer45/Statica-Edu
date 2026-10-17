import { deepFreeze } from '../../challenge/deepFreeze'
import { BRACKET_MODEL_REF, type BracketChallenge } from '../../challenge/bracket/types'
import { isUniformBar, type BracketDesign } from '../../geometry/bracket/design'
import { PhysicsInvariantError } from '../analyze'
import { checkBracketApplicability } from './applicability'
import {
  bendingMoment,
  nominalBendingStress,
  rectSecondMoment,
  steppedBarMass,
  steppedTipDeflection,
  uniformBarMass,
  uniformTipDeflection,
} from './bar'
import { BRACKET_ASSUMPTIONS, BRACKET_UNSUPPORTED_EFFECTS } from './constants'
import { shoulderFilletKt, shoulderRatios } from './kt'
import type { BracketAnalysis, BracketAnalysisBase } from './types'

// Stepped-bar bracket analysis entry point (task 46.2; MBR-07, MBR-11–MBR-15, MM-03, MM-10).
// Pure and deterministic: reads only the typed design and challenge, never UI state, clocks or
// randomness, and never mutates its inputs. Length, thickness, force, E and ρ come from the
// challenge; D, d, a and r from the design.
//
// Rules (MBR-11–MBR-13):
//   - Kt applies only to the step nominal stress, never to the root stress or the deflection.
//   - σ_peak = max(σ_root, σ_step); the location is `step` only if σ_step > σ_root (ties → root).
//   - Uniform bar (d = D as stored values): no step terms at all; peak = root stress at the root;
//     δ and m use the prismatic formulas, so a and r have no effect on any output.
//   - Kt fit undefined: Kt, the step peak, the peak stress and its location are omitted, status
//     `ktFitUndefined`; the root stress, step nominal stress, deflection and mass are kept, and
//     the KT_FIT_* screens make the design not applicable.

export const BRACKET_MODEL_ID = BRACKET_MODEL_REF.id
export const BRACKET_MODEL_VERSION = BRACKET_MODEL_REF.version

/**
 * Thrown when a computed bracket value is non-finite or not strictly positive (MM-10). It extends
 * the beam's PhysicsInvariantError so the shared reducer handling (a notice, no appended result)
 * applies unchanged.
 */
export class BracketInvariantError extends PhysicsInvariantError {
  constructor(field: string, value: number) {
    super(field, value)
    this.name = 'BracketInvariantError'
  }
}

/** Numeric fields checked in this order when present; the first offending one is reported. */
const NUMERIC_FIELDS = [
  'rootMomentNm',
  'rootStressPa',
  'tipDeflectionM',
  'massKg',
  'envelopeDepthM',
  'stepMomentNm',
  'stepNominalStressPa',
  'heightToRadiusRatio',
  'stepRatio',
  'ktStep',
  'stepPeakStressPa',
  'peakStressPa',
] as const satisfies readonly (keyof BracketAnalysisBase)[]

/** Step-dependent fields: omitted keys for a uniform bar or an undefined Kt fit. */
type StepFields = Pick<
  BracketAnalysisBase,
  'stepMomentNm' | 'stepNominalStressPa' | 'heightToRadiusRatio' | 'stepRatio' | 'ktBranch' | 'ktStep' | 'stepPeakStressPa' | 'peakStressPa' | 'peakLocation'
>

/**
 * Analyzes a bracket design under the challenge tip force.
 *
 * Precondition: `validateBracketDesign(d, ch)` returns `[]`; callers validate first (invalid input
 * is rejected before analysis). When the precondition holds every present numeric field is finite
 * and > 0. Otherwise a `BracketInvariantError` naming the first offending field is thrown.
 *
 * The returned analysis is deep-frozen and names `steppedBarBracket` v1. `applicable` is true iff
 * `notApplicableReasons` is empty, regardless of `warnings`.
 */
export function analyzeBracket(d: BracketDesign, ch: BracketChallenge): BracketAnalysis {
  const F = ch.load.forceN
  const L = ch.lengthM
  const b = ch.thicknessM
  const E = ch.material.elasticModulusPa
  const rho = ch.material.densityKgM3
  const D = d.rootDepthM
  const dArm = d.armDepthM
  const a = d.stepLocationM
  const uniform = isUniformBar(d)

  const rootMomentNm = bendingMoment(F, L, 0)
  const rootStressPa = nominalBendingStress(rootMomentNm, b, D)
  const I_D = rectSecondMoment(b, D)

  let step: StepFields
  let tipDeflectionM: number
  let massKg: number
  let defined = true
  if (uniform) {
    tipDeflectionM = uniformTipDeflection(F, E, L, I_D)
    massKg = uniformBarMass(rho, b, D, L)
    step = { peakStressPa: rootStressPa, peakLocation: 'root' }
  } else {
    tipDeflectionM = steppedTipDeflection(F, E, L, a, I_D, rectSecondMoment(b, dArm))
    massKg = steppedBarMass(rho, b, D, dArm, a, L)
    const stepMomentNm = bendingMoment(F, L, a)
    const stepNominalStressPa = nominalBendingStress(stepMomentNm, b, dArm)
    const ratios = shoulderRatios(D, dArm, d.filletRadiusM)
    const geometry = { stepMomentNm, stepNominalStressPa, heightToRadiusRatio: ratios.heightToRadiusRatio, stepRatio: ratios.stepRatio }
    const kt = shoulderFilletKt(ratios)
    if (kt === undefined) {
      defined = false
      step = geometry
    } else {
      const stepPeakStressPa = kt.kt * stepNominalStressPa
      const atStep = stepPeakStressPa > rootStressPa
      step = {
        ...geometry,
        ktBranch: kt.branch,
        ktStep: kt.kt,
        stepPeakStressPa,
        peakStressPa: atStep ? stepPeakStressPa : rootStressPa,
        peakLocation: atStep ? 'step' : 'root',
      }
    }
  }

  const base: BracketAnalysisBase = {
    modelId: BRACKET_MODEL_ID,
    modelVersion: BRACKET_MODEL_VERSION,
    status: defined ? 'solved' : 'ktFitUndefined',
    unsupportedEffects: BRACKET_UNSUPPORTED_EFFECTS,
    assumptions: BRACKET_ASSUMPTIONS,
    rootMomentNm,
    rootStressPa,
    tipDeflectionM,
    massKg,
    envelopeDepthM: D,
    ...step,
  }

  for (const field of NUMERIC_FIELDS) {
    const v = base[field]
    if (v !== undefined && (!Number.isFinite(v) || v <= 0)) throw new BracketInvariantError(field, v)
  }

  const { warnings, notApplicable } = checkBracketApplicability(d, base, ch)

  return deepFreeze({
    ...base,
    applicable: notApplicable.length === 0,
    warnings,
    notApplicableReasons: notApplicable,
  })
}
