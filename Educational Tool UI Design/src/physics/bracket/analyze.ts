import { deepFreeze } from '../../challenge/deepFreeze'
import { BRACKET_MODEL_REF, type BracketChallenge } from '../../challenge/bracket/types'
import type { BracketDesign } from '../../geometry/bracket/design'
import { bracketArmLengthM } from '../../geometry/bracket/outline'
import { PhysicsInvariantError } from '../analyze'
import { checkBracketApplicability } from './applicability'
import { BRACKET_ASSUMPTIONS, BRACKET_UNSUPPORTED_EFFECTS } from './constants'
import {
  armBendingDeflection,
  bendMoment,
  bendRadiusRatio,
  boltLeverArm,
  boltTension,
  curvedBeamInnerStress,
  flangeRotationDeflection,
  lBracketMass,
  nominalBendingStress,
  plateSecondMoment,
} from './formulas'
import type { BracketAnalysis, BracketAnalysisBase } from './types'

// Bolted L-bracket analysis entry point (task 55, model `boltedLBracket` v1; MM-03, MM-10). Pure
// and deterministic: reads only the typed design and challenge, never UI state, clocks or
// randomness, and never mutates its inputs. Load offset, overhang, force, bolts, E and ρ come from
// the challenge; t, w, H and r_i from the design.
//
// Model (formulas.ts, constants.ts):
//   M = P a at the bend; σ_bend = Winkler–Bach inner-fibre stress, σ_nominal = 6M/(w t²);
//   h_b = H − e − r_o; T = M / (n h_b) per bolt;
//   δ = P a³/(3EI) + P a² h_b/(3EI), I = w t³/12;
//   m = ρ w × (L-shaped area).

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

/** Numeric fields checked in this order (inputs before derived values); the first offending one is reported. */
const NUMERIC_FIELDS = [
  'bendMomentNm',
  'nominalBendStressPa',
  'curvedBeamFactor',
  'bendStressPa',
  'bendRadiusRatio',
  'boltLeverArmM',
  'armDeflectionM',
  'flangeRotationDeflectionM',
  'deflectionM',
  'boltTensionN',
  'massKg',
] as const satisfies readonly (keyof BracketAnalysisBase)[]

/**
 * Analyzes a bracket design under the challenge load.
 *
 * Precondition: `validateBracketDesign(d, ch)` returns `[]` and the challenge passed the loader
 * (so the bolt lever arm is positive); callers validate first. When the precondition holds every
 * numeric field is finite and > 0. Otherwise a `BracketInvariantError` naming the first offending
 * field is thrown.
 *
 * The returned analysis is deep-frozen and names `boltedLBracket` v1. `applicable` is true iff
 * `notApplicableReasons` is empty, regardless of `warnings`.
 */
export function analyzeBracket(d: BracketDesign, ch: BracketChallenge): BracketAnalysis {
  const P = ch.load.forceN
  const a = ch.loadOffsetM
  const E = ch.material.elasticModulusPa
  const t = d.thicknessM
  const w = d.widthM
  const ri = d.innerRadiusM

  const bendMomentNm = bendMoment(P, a)
  const nominalBendStressPa = nominalBendingStress(bendMomentNm, w, t)
  const bendStressPa = curvedBeamInnerStress(bendMomentNm, w, t, ri)
  const I = plateSecondMoment(w, t)
  const boltLeverArmM = boltLeverArm(d.flangeHeightM, ch.bolts.edgeDistanceM, ri, t)
  const armDeflectionM = armBendingDeflection(P, a, E, I)
  const flangeRotationDeflectionM = flangeRotationDeflection(P, a, boltLeverArmM, E, I)

  const base: BracketAnalysisBase = {
    modelId: BRACKET_MODEL_ID,
    modelVersion: BRACKET_MODEL_VERSION,
    unsupportedEffects: BRACKET_UNSUPPORTED_EFFECTS,
    assumptions: BRACKET_ASSUMPTIONS,
    bendMomentNm,
    nominalBendStressPa,
    curvedBeamFactor: bendStressPa / nominalBendStressPa,
    bendStressPa,
    bendRadiusRatio: bendRadiusRatio(ri, t),
    armDeflectionM,
    flangeRotationDeflectionM,
    deflectionM: armDeflectionM + flangeRotationDeflectionM,
    boltLeverArmM,
    boltTensionN: boltTension(P, a, ch.bolts.count, boltLeverArmM),
    massKg: lBracketMass(ch.material.densityKgM3, w, t, ri, bracketArmLengthM(ch), d.flangeHeightM),
  }

  for (const field of NUMERIC_FIELDS) {
    const v = base[field]
    if (!Number.isFinite(v) || v <= 0) throw new BracketInvariantError(field, v)
  }

  const { warnings, notApplicable } = checkBracketApplicability(d, base, ch)

  return deepFreeze({
    ...base,
    applicable: notApplicable.length === 0,
    warnings,
    notApplicableReasons: notApplicable,
  })
}
