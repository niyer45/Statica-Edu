import { deepFreeze } from '../../challenge/deepFreeze'
import { TORSION_MODEL_REF, type TorsionChallenge } from '../../challenge/torsion/types'
import type { TorsionDesign } from '../../geometry/torsion/design'
import { PhysicsInvariantError } from '../analyze'
import { checkTorsionApplicability } from './applicability'
import { TORSION_ASSUMPTIONS, TORSION_UNSUPPORTED_EFFECTS } from './constants'
import { maxShearStress, shaftSectionProperties, torsionalStiffness, twistAngle } from './shaft'
import type { TorsionAnalysis, TorsionAnalysisBase } from './types'

// Torsion shaft analysis entry point (task 47.2; TSH-06, TSH-10–TSH-13, MM-03, MM-10).
// Pure and deterministic: reads only the typed design and challenge, never mesh/UI state,
// clocks, or randomness, and never mutates its inputs. Length comes from the design (a locked
// field equal to the challenge length); torque, shear modulus and density from the challenge.

export const TORSION_MODEL_ID = TORSION_MODEL_REF.id
export const TORSION_MODEL_VERSION = TORSION_MODEL_REF.version

/**
 * Thrown when a computed torsion value is non-finite or not strictly positive (MM-10). It extends
 * the beam's PhysicsInvariantError so existing reducer handling (a notice, no appended result)
 * applies unchanged once the model is registered.
 */
export class TorsionInvariantError extends PhysicsInvariantError {
  constructor(field: string, value: number) {
    super(field, value)
    this.name = 'TorsionInvariantError'
  }
}

/** Numeric fields checked in this order; the first offending one is reported. */
const NUMERIC_FIELDS = [
  'areaM2',
  'polarMomentM4',
  'outerDiameterM',
  'massKg',
  'twistRad',
  'maxShearStressPa',
  'torsionalStiffnessNmPerRad',
] as const satisfies readonly (keyof TorsionAnalysisBase)[]

/**
 * Analyzes a shaft design under the challenge torque.
 *
 * Precondition: `validateTorsionDesign(d, ch)` returns `[]`; callers validate first (invalid input
 * is rejected before analysis). When the precondition holds every numeric field is finite and
 * > 0. Otherwise a `TorsionInvariantError` naming the first offending field is thrown.
 *
 * The returned analysis is deep-frozen and names `circularShaftTorsion` v1. `applicable` is true
 * iff `notApplicableReasons` is empty, regardless of `warnings`.
 */
export function analyzeShaft(d: TorsionDesign, ch: TorsionChallenge): TorsionAnalysis {
  const T = ch.torqueNm
  const L = d.lengthM
  const G = ch.material.shearModulusPa
  const rho = ch.material.densityKgM3
  const p = shaftSectionProperties(d.section)
  const J = p.polarMomentM4

  const base: TorsionAnalysisBase = {
    modelId: TORSION_MODEL_ID,
    modelVersion: TORSION_MODEL_VERSION,
    unsupportedEffects: TORSION_UNSUPPORTED_EFFECTS,
    assumptions: TORSION_ASSUMPTIONS,
    areaM2: p.areaM2,
    polarMomentM4: J,
    outerDiameterM: p.outerDiameterM,
    massKg: rho * p.areaM2 * L,
    twistRad: twistAngle(T, L, G, J),
    maxShearStressPa: maxShearStress(T, p.outerDiameterM, J),
    torsionalStiffnessNmPerRad: torsionalStiffness(G, J, L),
  }

  for (const field of NUMERIC_FIELDS) {
    const v = base[field]
    if (!Number.isFinite(v) || v <= 0) throw new TorsionInvariantError(field, v)
  }

  const { warnings, notApplicable } = checkTorsionApplicability(d, base, ch)

  return deepFreeze({
    ...base,
    applicable: notApplicable.length === 0,
    warnings,
    notApplicableReasons: notApplicable,
  })
}
