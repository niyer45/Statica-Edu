import { deepFreeze } from '../../challenge/deepFreeze'
import { allowableStressPa, VESSEL_MODEL_REF, type VesselChallenge } from '../../challenge/vessel/types'
import type { VesselDesign } from '../../geometry/vessel/design'
import { PhysicsInvariantError } from '../analyze'
import { checkVesselApplicability } from './applicability'
import { VESSEL_ASSUMPTIONS, VESSEL_UNSUPPORTED_EFFECTS } from './constants'
import {
  headMembraneStress,
  headsMass,
  hoopStress,
  internalVolume,
  longitudinalStress,
  overallLength,
  shellMass,
} from './formulas'
import type { VesselAnalysis, VesselAnalysisBase } from './types'

// Pressure vessel analysis entry point (task 69, model `thinWallPressureVessel` v1; MM-03,
// MM-10). Pure and deterministic: reads only the typed design and challenge, never UI state,
// clocks or randomness, and never mutates its inputs. Pressure, material and design factor come
// from the challenge; D_i, L, t_s and t_h from the design.
//
// Model (formulas.ts, constants.ts): r = D_i/2; σ_h = p r/t_s; σ_l = p r/(2 t_s);
// σ_head = p r/(2 t_h); σ_a = σ_y/n; V = π r² L + (4/3) π r³; L_o = L + 2(r + t_h);
// m = ρ [π((r+t_s)² − r²) L + (4/3) π((r+t_h)³ − r³)].

export const VESSEL_MODEL_ID = VESSEL_MODEL_REF.id
export const VESSEL_MODEL_VERSION = VESSEL_MODEL_REF.version

/**
 * Thrown when a computed vessel value is non-finite or not strictly positive (MM-10). It extends
 * the beam's PhysicsInvariantError so the shared reducer handling (a notice, no appended result)
 * applies unchanged.
 */
export class VesselInvariantError extends PhysicsInvariantError {
  constructor(field: string, value: number) {
    super(field, value)
    this.name = 'VesselInvariantError'
  }
}

/** Numeric fields checked in this order (inputs before derived values); the first offending one is reported. */
const NUMERIC_FIELDS = [
  'innerRadiusM',
  'hoopStressPa',
  'longitudinalStressPa',
  'headStressPa',
  'allowableStressPa',
  'volumeM3',
  'overallLengthM',
  'shellMassKg',
  'headsMassKg',
  'massKg',
  'shellRadiusRatio',
  'headRadiusRatio',
] as const satisfies readonly (keyof VesselAnalysisBase)[]

/**
 * Analyzes a vessel design under the challenge pressure.
 *
 * Precondition: `validateVesselDesign(d, ch)` returns `[]` and the challenge passed the loader;
 * callers validate first. When the precondition holds every numeric field is finite and > 0.
 * Otherwise a `VesselInvariantError` naming the first offending field is thrown.
 *
 * The returned analysis is deep-frozen and names `thinWallPressureVessel` v1. `applicable` is true
 * iff `notApplicableReasons` is empty, regardless of `warnings`.
 */
export function analyzeVessel(d: VesselDesign, ch: VesselChallenge): VesselAnalysis {
  const p = ch.pressurePa
  const rho = ch.material.densityKgM3
  const r = d.innerDiameterM / 2
  const ts = d.shellThicknessM
  const th = d.headThicknessM
  const L = d.shellLengthM

  const shellMassKg = shellMass(rho, r, ts, L)
  const headsMassKg = headsMass(rho, r, th)

  const base: VesselAnalysisBase = {
    modelId: VESSEL_MODEL_ID,
    modelVersion: VESSEL_MODEL_VERSION,
    unsupportedEffects: VESSEL_UNSUPPORTED_EFFECTS,
    assumptions: VESSEL_ASSUMPTIONS,
    innerRadiusM: r,
    hoopStressPa: hoopStress(p, r, ts),
    longitudinalStressPa: longitudinalStress(p, r, ts),
    headStressPa: headMembraneStress(p, r, th),
    allowableStressPa: allowableStressPa(ch),
    volumeM3: internalVolume(r, L),
    overallLengthM: overallLength(L, r, th),
    shellMassKg,
    headsMassKg,
    massKg: shellMassKg + headsMassKg,
    shellRadiusRatio: r / ts,
    headRadiusRatio: r / th,
  }

  for (const field of NUMERIC_FIELDS) {
    const v = base[field]
    if (!Number.isFinite(v) || v <= 0) throw new VesselInvariantError(field, v)
  }

  const { warnings, notApplicable } = checkVesselApplicability(d, base, ch)

  return deepFreeze({
    ...base,
    applicable: notApplicable.length === 0,
    warnings,
    notApplicableReasons: notApplicable,
  })
}
