import { deepFreeze } from '../../challenge/deepFreeze'
import { HEAT_SINK_MODEL_REF, type HeatSinkChallenge } from '../../challenge/heatSink/types'
import { finGap, type HeatSinkDesign } from '../../geometry/heatSink/design'
import { PhysicsInvariantError } from '../analyze'
import { checkHeatSinkApplicability } from './applicability'
import { HEAT_SINK_ASSUMPTIONS, HEAT_SINK_UNSUPPORTED_EFFECTS } from './constants'
import { correctedFinLength, finEfficiency, finExcessRatio, finParameter, overallSurfaceEfficiency } from './fin'
import type { FinProfileSample, HeatSinkAnalysis, HeatSinkAnalysisBase } from './types'

// Heat sink analysis entry point (task 48.2; HSK-06, HSK-10–HSK-14, MM-03, MM-10).
// Pure and deterministic: reads only the typed design and challenge, never mesh/UI state, clocks
// or randomness, and never mutates its inputs. Fin count, thickness and height come from the
// design; base, conductivity, density, heat load, ambient temperature, the specified convection
// coefficient and the profile sample positions from the challenge.
//
// Heat path: Q enters uniformly over the mounting face, conducts through the base thickness
// (R_base), and leaves by convection with one coefficient h to air at T∞ from both faces of every
// fin, the fin tips (through the corrected length) and the exposed base strips (R_conv). Base side
// faces, fin end edges and the mounting face do not convect.

export const HEAT_SINK_MODEL_ID = HEAT_SINK_MODEL_REF.id
export const HEAT_SINK_MODEL_VERSION = HEAT_SINK_MODEL_REF.version

/**
 * Thrown when a computed heat sink value is non-finite or not strictly positive (MM-10). It
 * extends the beam's PhysicsInvariantError so the engine's invariant handling (a notice, no
 * appended result) applies unchanged.
 */
export class HeatSinkInvariantError extends PhysicsInvariantError {
  constructor(field: string, value: number) {
    super(field, value)
    this.name = 'HeatSinkInvariantError'
  }
}

/** Numeric fields checked in this order; the first offending one is reported. */
const NUMERIC_FIELDS = [
  'finGapM',
  'finHeightM',
  'channelAspectRatio',
  'finBiotNumber',
  'finParameterPerM',
  'correctedFinLengthM',
  'finEfficiency',
  'finAreaM2',
  'exposedBaseAreaM2',
  'totalAreaM2',
  'overallEfficiency',
  'effectiveAreaM2',
  'baseResistanceKPerW',
  'convectionResistanceKPerW',
  'totalResistanceKPerW',
  'baseTemperatureK',
  'baseTemperatureRiseK',
  'finnedSurfaceTemperatureK',
  'finRootExcessK',
  'massKg',
  'finHeatShare',
] as const satisfies readonly (keyof HeatSinkAnalysisBase)[]

/**
 * Analyzes a plate-fin heat sink design under the challenge heat load.
 *
 * Precondition: `validateHeatSinkDesign(d, ch)` returns `[]`; callers validate first (invalid input,
 * including N = 1 and gaps below the geometric floor, is rejected before analysis). When the
 * precondition holds every numeric field, and every profile excess ratio and temperature, is
 * finite and > 0. Otherwise a `HeatSinkInvariantError` naming the first offending field is thrown.
 *
 * The returned analysis is deep-frozen and names `plateFinHeatSink` v1. `applicable` is true iff
 * `notApplicableReasons` is empty, regardless of `warnings`.
 */
export function analyzeHeatSink(d: HeatSinkDesign, ch: HeatSinkChallenge): HeatSinkAnalysis {
  const N = d.finCount
  const t = d.finThicknessM
  const H = d.finHeightM
  const { widthM: W, depthM: D, thicknessM: tb } = ch.base
  const k = ch.material.thermalConductivityWPerMK
  const rho = ch.material.densityKgM3
  const h = ch.convection.coefficientWPerM2K
  const Q = ch.heatLoadW
  const Tinf = ch.ambientTemperatureK

  const s = finGap(W, N, t)
  const m = finParameter(h, k, t)
  const Lc = correctedFinLength(H, t)
  const etaF = finEfficiency(m * Lc)
  const Af = 2 * D * Lc
  const Ab = W * D - N * t * D
  const At = N * Af + Ab
  const etaO = overallSurfaceEfficiency(N, Af, At, etaF)
  const Rbase = tb / (k * W * D)
  const Rconv = 1 / (etaO * h * At)
  const Rtotal = Rbase + Rconv
  const rise = Q * Rtotal
  const thetaB = Q * Rconv

  const base: HeatSinkAnalysisBase = {
    modelId: HEAT_SINK_MODEL_ID,
    modelVersion: HEAT_SINK_MODEL_VERSION,
    unsupportedEffects: HEAT_SINK_UNSUPPORTED_EFFECTS,
    assumptions: HEAT_SINK_ASSUMPTIONS,
    finGapM: s,
    finHeightM: H,
    channelAspectRatio: H / s,
    finBiotNumber: (h * t) / (2 * k),
    finParameterPerM: m,
    correctedFinLengthM: Lc,
    finEfficiency: etaF,
    finAreaM2: Af,
    exposedBaseAreaM2: Ab,
    totalAreaM2: At,
    overallEfficiency: etaO,
    effectiveAreaM2: etaO * At,
    baseResistanceKPerW: Rbase,
    convectionResistanceKPerW: Rconv,
    totalResistanceKPerW: Rtotal,
    baseTemperatureK: Tinf + rise,
    baseTemperatureRiseK: rise,
    finnedSurfaceTemperatureK: Tinf + thetaB,
    finRootExcessK: thetaB,
    massKg: rho * (W * D * tb + N * t * H * D),
    finHeatShare: (N * etaF * h * Af * thetaB) / Q,
    finProfile: ch.visualization.profileSamplesXOverH.map((xOverH): FinProfileSample => {
      const excessRatio = finExcessRatio(m, Lc, xOverH * H)
      return { xOverH, excessRatio, temperatureK: Tinf + thetaB * excessRatio }
    }),
  }

  for (const field of NUMERIC_FIELDS) {
    const v = base[field]
    if (!Number.isFinite(v) || v <= 0) throw new HeatSinkInvariantError(field, v)
  }
  for (const [i, p] of base.finProfile.entries()) {
    for (const key of ['excessRatio', 'temperatureK'] as const) {
      if (!Number.isFinite(p[key]) || p[key] <= 0) throw new HeatSinkInvariantError(`finProfile.${i}.${key}`, p[key])
    }
  }

  const { warnings, notApplicable } = checkHeatSinkApplicability(base)

  return deepFreeze({
    ...base,
    applicable: notApplicable.length === 0,
    warnings,
    notApplicableReasons: notApplicable,
  })
}
