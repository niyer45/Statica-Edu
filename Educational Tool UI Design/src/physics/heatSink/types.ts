import type { HeatSinkModelId } from '../../challenge/heatSink/types'
import type { HeatSinkApplicabilityCode } from './constants'

// Heat sink analysis result types (task 48.2; HSK-06, HSK-14, MM-03, MM-10). Independent of the
// beam `Analysis` (frozen, D-39) and the torsion analysis. Like torsion, it stores
// `modelVersion`. Temperatures are absolute kelvin; differences (rise, excess) are kelvin too.

/** One applicability finding, shaped like the beam's ApplicabilityIssue with heat sink codes. */
export interface HeatSinkApplicabilityIssue {
  code: HeatSinkApplicabilityCode
  /** Student-facing text naming the unmodeled effect and comparing value with threshold. */
  message: string
  /** Computed metric value (metres for FIN_GAP, dimensionless otherwise). */
  value: number
  /** The crossed threshold: the warning threshold for warnings, the not-applicable one otherwise. */
  threshold: number
}

/** One stored fin temperature sample (HSK-14); the UI colors and tabulates these, computing nothing. */
export interface FinProfileSample {
  /** Position along the fin, x/H: 0 at the root, 1 at the tip (a configured sample position). */
  xOverH: number
  /** θ/θ_b = cosh(m(L_c − x))/cosh(m L_c). */
  excessRatio: number
  /** T(x) = T∞ + θ_b · θ/θ_b, K. */
  temperatureK: number
}

export interface HeatSinkAnalysis {
  modelId: HeatSinkModelId
  modelVersion: 1
  /** True iff `notApplicableReasons` is empty, independent of `warnings`. */
  applicable: boolean
  /** Applicable but approaching model limits. */
  warnings: readonly HeatSinkApplicabilityIssue[]
  notApplicableReasons: readonly HeatSinkApplicabilityIssue[]
  /** Effects never modeled, always listed (HSK-12). */
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  /** s = (W − N t)/(N − 1), m. */
  finGapM: number
  /** H, m (copied from the design for the finHeight constraint and display). */
  finHeightM: number
  /** H/s, the CHANNEL_ASPECT screen metric. */
  channelAspectRatio: number
  /** Bi = h t/(2k), the FIN_BIOT screen metric. */
  finBiotNumber: number
  /** m = √(2h/(k t)), 1/m. */
  finParameterPerM: number
  /** L_c = H + t/2, m. */
  correctedFinLengthM: number
  /** η_f = tanh(m L_c)/(m L_c). */
  finEfficiency: number
  /** A_f = 2 D L_c, one fin, m². */
  finAreaM2: number
  /** A_b = W D − N t D, exposed base between and beside the fins, m². */
  exposedBaseAreaM2: number
  /** A_t = N A_f + A_b, m². */
  totalAreaM2: number
  /** η_o = 1 − (N A_f/A_t)(1 − η_f). */
  overallEfficiency: number
  /** η_o A_t, m². */
  effectiveAreaM2: number
  /** R_base = t_b/(k W D), K/W. */
  baseResistanceKPerW: number
  /** R_conv = 1/(η_o h A_t), K/W. */
  convectionResistanceKPerW: number
  /** R_total = R_base + R_conv, K/W (display only). */
  totalResistanceKPerW: number
  /** Mounting-face temperature T_base = T∞ + Q R_total, K (the constrained temperature). */
  baseTemperatureK: number
  /** ΔT = T_base − T∞ = Q R_total, K (the primary prediction metric). */
  baseTemperatureRiseK: number
  /** Finned-surface temperature T_s = T∞ + Q R_conv, K. */
  finnedSurfaceTemperatureK: number
  /** Fin root excess θ_b = T_s − T∞ = Q R_conv, K. */
  finRootExcessK: number
  /** mass = ρ (W D t_b + N t H D), kg. */
  massKg: number
  /** Share of Q leaving through the fins: N η_f h A_f θ_b / Q. */
  finHeatShare: number
  /** Fin temperature profile at the configured x/H positions, root first (HSK-14). */
  finProfile: readonly FinProfileSample[]
}

/** Analysis fields computed before the applicability check. */
export type HeatSinkAnalysisBase = Omit<HeatSinkAnalysis, 'applicable' | 'warnings' | 'notApplicableReasons'>

/** The subset of HeatSinkAnalysisBase the applicability checker reads. */
export type HeatSinkApplicabilityInput = Pick<HeatSinkAnalysisBase, 'finGapM' | 'channelAspectRatio' | 'finBiotNumber'>
