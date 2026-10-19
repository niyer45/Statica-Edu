import { deepFreeze } from '../../challenge/deepFreeze'
import { COLUMN_MODEL_REF, type ColumnChallenge } from '../../challenge/column/types'
import { columnInnerDiameterM, columnOuterDiameterM, type ColumnDesign } from '../../geometry/column/design'
import { PhysicsInvariantError } from '../analyze'
import { checkColumnApplicability } from './applicability'
import { COLUMN_ASSUMPTIONS, COLUMN_UNSUPPORTED_EFFECTS, EFFECTIVE_LENGTH_FACTORS } from './constants'
import { annulusArea, annulusSecondMoment, columnMass, eulerCriticalLoad, radiusOfGyration, transitionSlenderness } from './formulas'
import type { ColumnAnalysis, ColumnAnalysisBase } from './types'

// Euler column analysis entry point (task 68, model `eulerColumnBuckling` v1; MM-03, MM-10). Pure
// and deterministic: reads only the typed design and challenge, never UI state, clocks or
// randomness, and never mutates its inputs. Length, load, E, ρ and σ_y come from the challenge;
// the section from the design.
//
// Model (formulas.ts, constants.ts):
//   A = π(D² − d²)/4, I = π(D⁴ − d⁴)/64, r = √(I/A), KL with K from the support;
//   P_cr = π²EI/(KL)², λ = KL/r, λ_c = √(2π²E/σ_y), σ_E = P_cr/A, σ = P/A, m = ρAL.

export const COLUMN_MODEL_ID = COLUMN_MODEL_REF.id
export const COLUMN_MODEL_VERSION = COLUMN_MODEL_REF.version

/**
 * Thrown when a computed column value is non-finite or not strictly positive (MM-10). It extends
 * the beam's PhysicsInvariantError so the shared reducer handling (a notice, no appended result)
 * applies unchanged.
 */
export class ColumnInvariantError extends PhysicsInvariantError {
  constructor(field: string, value: number) {
    super(field, value)
    this.name = 'ColumnInvariantError'
  }
}

/** Numeric fields checked in this order (inputs before derived values); the first offending one is reported. */
const NUMERIC_FIELDS = [
  'outerDiameterM',
  'areaM2',
  'secondMomentM4',
  'radiusOfGyrationM',
  'effectiveLengthM',
  'slenderness',
  'transitionSlenderness',
  'criticalLoadN',
  'bucklingSafetyFactor',
  'eulerStressPa',
  'axialStressPa',
  'massKg',
  'criticalLoadPerMassNPerKg',
  'diameterToWall',
] as const satisfies readonly (keyof ColumnAnalysisBase)[]

/**
 * Analyzes a column design under the challenge load.
 *
 * Precondition: `validateColumnDesign(d, ch)` returns `[]` and the challenge passed the loader;
 * callers validate first. When the precondition holds every numeric field is finite and > 0.
 * Otherwise a `ColumnInvariantError` naming the first offending field is thrown.
 *
 * The returned analysis is deep-frozen and names `eulerColumnBuckling` v1. `applicable` is true iff
 * `notApplicableReasons` is empty, regardless of `warnings`.
 */
export function analyzeColumn(d: ColumnDesign, ch: ColumnChallenge): ColumnAnalysis {
  const E = ch.material.elasticModulusPa
  const P = ch.load.forceN
  const D = columnOuterDiameterM(d.section)
  const di = columnInnerDiameterM(d.section)
  const wall = d.section.kind === 'solid' ? D / 2 : d.section.wallThicknessM
  const areaM2 = annulusArea(D, di)
  const secondMomentM4 = annulusSecondMoment(D, di)
  const radiusOfGyrationM = radiusOfGyration(secondMomentM4, areaM2)
  const effectiveLengthM = EFFECTIVE_LENGTH_FACTORS[ch.support] * d.lengthM
  const criticalLoadN = eulerCriticalLoad(E, secondMomentM4, effectiveLengthM)
  const massKg = columnMass(ch.material.densityKgM3, areaM2, d.lengthM)

  const base: ColumnAnalysisBase = {
    modelId: COLUMN_MODEL_ID,
    modelVersion: COLUMN_MODEL_VERSION,
    unsupportedEffects: COLUMN_UNSUPPORTED_EFFECTS,
    assumptions: COLUMN_ASSUMPTIONS,
    outerDiameterM: D,
    areaM2,
    secondMomentM4,
    radiusOfGyrationM,
    effectiveLengthM,
    slenderness: effectiveLengthM / radiusOfGyrationM,
    transitionSlenderness: transitionSlenderness(E, ch.material.yieldStressPa),
    criticalLoadN,
    bucklingSafetyFactor: criticalLoadN / P,
    eulerStressPa: criticalLoadN / areaM2,
    axialStressPa: P / areaM2,
    massKg,
    criticalLoadPerMassNPerKg: criticalLoadN / massKg,
    diameterToWall: D / wall,
  }

  for (const field of NUMERIC_FIELDS) {
    const v = base[field]
    if (!Number.isFinite(v) || v <= 0) throw new ColumnInvariantError(field, v)
  }

  const { warnings, notApplicable } = checkColumnApplicability(base, ch)

  return deepFreeze({
    ...base,
    applicable: notApplicable.length === 0,
    warnings,
    notApplicableReasons: notApplicable,
  })
}
