import { deepFreeze } from '../../challenge/deepFreeze'
import { AXIAL_MODEL_REF, axialMaterial, type AxialChallenge } from '../../challenge/axial/types'
import type { AxialDesign } from '../../geometry/axial/design'
import { PhysicsInvariantError } from '../analyze'
import { checkAxialApplicability } from './applicability'
import { AXIAL_ASSUMPTIONS, AXIAL_UNSUPPORTED_EFFECTS } from './constants'
import { axialElongation, axialStiffness, axialStress, circleArea, prismMass, strainFromStress, yieldRatio } from './formulas'
import type { AxialAnalysis, AxialAnalysisBase } from './types'

// Stress and Strain I analysis entry point (task 72; SSR-06, SSR-10–SSR-13, MM-03, MM-10). Pure and
// deterministic: reads only the typed design and challenge, never UI state, clocks or randomness,
// and never mutates its inputs. Length and load come from the challenge (locked constants); E, σ_y
// and ρ from the material the design names.

export const AXIAL_MODEL_ID = AXIAL_MODEL_REF.id
export const AXIAL_MODEL_VERSION = AXIAL_MODEL_REF.version

/**
 * Thrown when the design names an unlisted material or a computed value is non-finite or not
 * strictly positive (MM-10). It extends the beam's PhysicsInvariantError so the reducer's existing
 * handling (a notice, no appended result) applies unchanged.
 */
export class AxialInvariantError extends PhysicsInvariantError {
  constructor(field: string, value: number) {
    super(field, value)
    this.name = 'AxialInvariantError'
  }
}

/** Numeric fields checked in this order; the first offending one is reported. */
const NUMERIC_FIELDS = [
  'diameterM',
  'areaM2',
  'elasticModulusPa',
  'yieldStressPa',
  'stressPa',
  'strain',
  'elongationM',
  'axialStiffnessNPerM',
  'massKg',
  'yieldRatio',
] as const satisfies readonly (keyof AxialAnalysisBase)[]

/**
 * Analyzes a rod design under the challenge load.
 *
 * Precondition: `validateAxialDesign(d, ch)` returns `[]`. When it holds, every numeric field is
 * finite and > 0; otherwise an `AxialInvariantError` naming the first offending field is thrown.
 * The returned analysis is deep-frozen and names `axialTieRod` v1. `applicable` is true iff
 * `notApplicableReasons` is empty, regardless of `warnings`.
 */
export function analyzeRod(d: AxialDesign, ch: AxialChallenge): AxialAnalysis {
  const material = axialMaterial(ch, d.materialId)
  if (material === undefined) throw new AxialInvariantError('materialId', Number.NaN)
  const P = ch.forceN
  const L = ch.lengthM
  const E = material.elasticModulusPa
  const A = circleArea(d.diameterM)
  const stressPa = axialStress(P, A)

  const base: AxialAnalysisBase = {
    modelId: AXIAL_MODEL_ID,
    modelVersion: AXIAL_MODEL_VERSION,
    unsupportedEffects: AXIAL_UNSUPPORTED_EFFECTS,
    assumptions: AXIAL_ASSUMPTIONS,
    diameterM: d.diameterM,
    areaM2: A,
    elasticModulusPa: E,
    yieldStressPa: material.yieldStressPa,
    stressPa,
    strain: strainFromStress(stressPa, E),
    elongationM: axialElongation(P, L, A, E),
    axialStiffnessNPerM: axialStiffness(E, A, L),
    massKg: prismMass(material.densityKgM3, A, L),
    yieldRatio: yieldRatio(stressPa, material.yieldStressPa),
  }

  for (const field of NUMERIC_FIELDS) {
    const v = base[field]
    if (!Number.isFinite(v) || v <= 0) throw new AxialInvariantError(field, v)
  }

  const { warnings, notApplicable } = checkAxialApplicability(base.yieldRatio)

  return deepFreeze({
    ...base,
    applicable: notApplicable.length === 0,
    warnings,
    notApplicableReasons: notApplicable,
  })
}
