import { deepFreeze } from '../../challenge/deepFreeze'
import { VIBRATION_MODEL_REF, type VibrationChallenge } from '../../challenge/vibration/types'
import type { VibrationDesign } from '../../geometry/vibration/design'
import { PhysicsInvariantError } from '../analyze'
import { checkVibrationApplicability } from './applicability'
import { STANDARD_GRAVITY_MS2, VIBRATION_ASSUMPTIONS, VIBRATION_UNSUPPORTED_EFFECTS } from './constants'
import {
  clamp,
  dampingCoefficient,
  naturalFrequencyHz,
  relativeDisplacementPeakRatio,
  relativeDisplacementRatio,
  staticDeflection,
  transmissibility,
  transmissibilityCurve,
  transmissibilityPeakRatio,
  type ResponsePoint,
} from './response'
import type { VibrationAnalysis, VibrationAnalysisBase } from './types'

// Vibration isolation analysis entry point (task 50.2; VIB-06, VIB-10–VIB-13, MM-03, MM-10).
// Pure and deterministic: reads only the typed design and challenge, never UI state, clocks or
// randomness, and never mutates its inputs. Stiffness and material come from the design; mass,
// band, base amplitude and stroke from the challenge; g is a model constant.
//
// Peaks are exact, not sampled (design.md): TR is unimodal on r > 0 with its maximum at r_p and
// Z/Y is unimodal with its maximum at r_z (monotonic for ζ² ≥ 1/2), so the maximum over a
// frequency interval is attained at the peak frequency clamped into the interval. Clamping is
// done in frequency space so a peak on a band edge reports exactly that edge (e.g. 25 Hz).
//   worst in-band TR: TR at clamp(f_n·r_p, f_min, f_max)
//   peak TR:          TR at clamp(f_n·r_p, runUpFromHz, f_max)
//   peak Z:           Y·Z/Y at clamp(f_n·r_z, runUpFromHz, f_max)

export const VIBRATION_MODEL_ID = VIBRATION_MODEL_REF.id
export const VIBRATION_MODEL_VERSION = VIBRATION_MODEL_REF.version

/**
 * Thrown when a computed vibration value is non-finite or not strictly positive (MM-10). It
 * extends the beam's PhysicsInvariantError so existing reducer handling (a notice, no appended
 * result) applies unchanged once the model is registered.
 */
export class VibrationInvariantError extends PhysicsInvariantError {
  constructor(field: string, value: number) {
    super(field, value)
    this.name = 'VibrationInvariantError'
  }
}

/** Numeric fields checked in this order; the first offending one is reported. */
const NUMERIC_FIELDS = [
  'stiffnessNPerM',
  'naturalFrequencyHz',
  'dampingRatio',
  'dampingCoefficientNsPerM',
  'frequencyRatioAtBandMin',
  'frequencyRatioAtBandMax',
  'worstInBandTransmissibility',
  'worstInBandFrequencyHz',
  'peakTransmissibility',
  'peakTransmissibilityFrequencyHz',
  'staticDeflectionM',
  'peakRelativeDisplacementM',
  'peakRelativeDisplacementFrequencyHz',
  'strokeRatio',
] as const satisfies readonly (keyof VibrationAnalysisBase)[]

/** ζ of the design's material, or NaN for an unlisted id (a precondition violation). */
function dampingRatioOf(d: VibrationDesign, ch: Pick<VibrationChallenge, 'materials'>): number {
  return ch.materials.find((m) => m.id === d.materialId)?.dampingRatio ?? Number.NaN
}

/**
 * Analyzes an isolator design under the challenge's base excitation.
 *
 * Precondition: `validateVibrationDesign(d, ch)` returns `[]`; callers validate first (invalid
 * input is rejected before analysis). When the precondition holds every numeric field is finite
 * and > 0. Otherwise a `VibrationInvariantError` naming the first offending field is thrown.
 *
 * The returned analysis is deep-frozen and names `sdofBaseIsolation` v1. `applicable` is true iff
 * `notApplicableReasons` is empty, regardless of `warnings`.
 */
export function analyzeIsolator(d: VibrationDesign, ch: VibrationChallenge): VibrationAnalysis {
  const k = d.stiffnessNPerM
  const m = ch.component.massKg
  const zeta = dampingRatioOf(d, ch)
  const Y = ch.excitation.amplitudeM
  const { minHz, maxHz } = ch.excitation.operatingBandHz
  const fromHz = ch.excitation.runUpFromHz

  const fn = naturalFrequencyHz(k, m)
  const trAt = (fHz: number) => transmissibility(fHz / fn, zeta)

  const fPeakTr = fn * transmissibilityPeakRatio(zeta)
  const worstHz = clamp(fPeakTr, minHz, maxHz)
  const peakHz = clamp(fPeakTr, fromHz, maxHz)
  const zHz = clamp(fn * relativeDisplacementPeakRatio(zeta), fromHz, maxHz)
  const worst = trAt(worstHz)
  const deltaSt = staticDeflection(m, STANDARD_GRAVITY_MS2, k)
  const zPeak = Y * relativeDisplacementRatio(zHz / fn, zeta)

  const base: VibrationAnalysisBase = {
    modelId: VIBRATION_MODEL_ID,
    modelVersion: VIBRATION_MODEL_VERSION,
    unsupportedEffects: VIBRATION_UNSUPPORTED_EFFECTS,
    assumptions: VIBRATION_ASSUMPTIONS,
    stiffnessNPerM: k,
    naturalFrequencyHz: fn,
    dampingRatio: zeta,
    dampingCoefficientNsPerM: dampingCoefficient(zeta, k, m),
    frequencyRatioAtBandMin: minHz / fn,
    frequencyRatioAtBandMax: maxHz / fn,
    worstInBandTransmissibility: worst,
    worstInBandFrequencyHz: worstHz,
    ...(worst < 1 ? { isolationEfficiency: 1 - worst } : {}),
    peakTransmissibility: trAt(peakHz),
    peakTransmissibilityFrequencyHz: peakHz,
    staticDeflectionM: deltaSt,
    peakRelativeDisplacementM: zPeak,
    peakRelativeDisplacementFrequencyHz: zHz,
    strokeRatio: (deltaSt + zPeak) / ch.mount.linearStrokeM,
  }

  for (const field of NUMERIC_FIELDS) {
    const v = base[field]
    if (!Number.isFinite(v) || v <= 0) throw new VibrationInvariantError(field, v)
  }

  const { warnings, notApplicable } = checkVibrationApplicability(base)

  return deepFreeze({
    ...base,
    applicable: notApplicable.length === 0,
    warnings,
    notApplicableReasons: notApplicable,
  })
}

/**
 * The frequency-response chart data for a stored design snapshot (VIB-14): TR sampled over
 * [0, chartMaxHz] with the configured sample count, from the same formulas the analysis uses.
 * Display data only; never persisted. Same precondition as analyzeIsolator; an unlisted material
 * throws a VibrationInvariantError instead of returning NaN samples.
 */
export function vibrationResponseCurve(d: VibrationDesign, ch: VibrationChallenge): readonly ResponsePoint[] {
  const zeta = dampingRatioOf(d, ch)
  if (!(Number.isFinite(zeta) && zeta > 0)) throw new VibrationInvariantError('dampingRatio', zeta)
  const fn = naturalFrequencyHz(d.stiffnessNPerM, ch.component.massKg)
  if (!(Number.isFinite(fn) && fn > 0)) throw new VibrationInvariantError('naturalFrequencyHz', fn)
  return deepFreeze(transmissibilityCurve(fn, zeta, ch.visualization.chartMaxHz, ch.visualization.chartSamples))
}
