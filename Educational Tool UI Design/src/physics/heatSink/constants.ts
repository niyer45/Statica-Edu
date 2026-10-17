import type { ApplicabilityThreshold } from '../constants'

// Heat Sink I applicability thresholds and model metadata (task 48.2; heat-sink-1 HSK-10–HSK-12).
// The heat sink applicability checker reads thresholds only from this module. Thresholds are
// inclusive on the safe side: a metric equal to its threshold (within REL_TOL) produces no issue,
// as for the beam and torsion. Unlike their screens, FIN_GAP is a lower-bound screen (an issue is
// raised when the gap falls below the threshold), so each threshold records its direction.
// All values are engineering judgment pending owner review (29.2).
//
// Not screened, by design (HSK-11): fin aspect H/t (with Bi ≤ 3.1e-4 the fin is isothermal across
// its thickness at any H/t; HS-05's "fin aspect ratio" is implemented as the channel aspect H/s),
// fin depth/thickness (D/t ≥ 12 by the configured ranges), the corrected-length tip (≤ 5.6e-6
// relative against the exact convective tip across the worksheet) and spreading (the heat input
// covers the full footprint).

export type HeatSinkApplicabilityCode = 'FIN_GAP' | 'CHANNEL_ASPECT' | 'FIN_BIOT'

/** Fixed issue order. */
export const HEAT_SINK_APPLICABILITY_CODES: readonly HeatSinkApplicabilityCode[] = Object.freeze([
  'FIN_GAP',
  'CHANNEL_ASPECT',
  'FIN_BIOT',
] as const)

/** An applicability threshold with its direction: 'upper' raises issues above, 'lower' below. */
export interface HeatSinkThreshold extends ApplicabilityThreshold {
  readonly direction: 'upper' | 'lower'
}

const t = (
  direction: 'upper' | 'lower',
  warning: number,
  notApplicable: number,
  metric: string,
  effect: string,
): HeatSinkThreshold => Object.freeze({ direction, warning, notApplicable, metric, effect })

/** The six heat sink thresholds (3 warning, 3 not-applicable). */
export const HEAT_SINK_THRESHOLDS: Readonly<Record<HeatSinkApplicabilityCode, HeatSinkThreshold>> =
  Object.freeze({
    // Below the 4 mm gap constraint on purpose: the constraint is a design rule, this screen a
    // model-trust boundary. At fixed fan pressure laminar channel velocity scales with s², so
    // narrow channels heat their air and bypass flow, and "air at T∞ everywhere" no longer holds.
    FIN_GAP: t('lower', 0.003, 0.002, 's (fin gap, m)', 'air heating and flow bypass in narrow fin channels'),
    // Deep, narrow channels starve the fin roots of airflow, so one h over the whole fin is
    // questionable. Within the constraints (H ≤ 35 mm, s ≥ 4 mm) the maximum is 8.75.
    CHANNEL_ASPECT: t('upper', 8, 12, 'H / s', 'reduced airflow at the roots of deep, narrow fin channels'),
    // Screens the 1D-fin assumption; the configured ranges cap Bi at 3.125e-4 (defense in depth).
    FIN_BIOT: t('upper', 0.01, 0.1, 'h t / (2 k)', 'temperature variation across the fin thickness'),
  })

/** Effects the model never accounts for, listed on every analysis (HSK-12). */
export const HEAT_SINK_UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'radiation',
  'spreading or constriction resistance from a heat source smaller than the base',
  'spacing- and flow-dependent convection (the coefficient is specified, not computed; screened only)',
  'air temperature rise along the channels and flow bypass',
  'natural convection and orientation',
  'fan curve and pressure drop',
  'interface (contact or thermal interface material) resistance',
  'transient warm-up',
  'temperature-dependent properties',
  'non-uniform heating and hot spots',
  'two-dimensional conduction in fins (screened only)',
  'convection from fin end edges',
])

/** Model assumptions listed on every analysis (HSK-12, design "Model plateFinHeatSink v1"). */
export const HEAT_SINK_ASSUMPTIONS: readonly string[] = Object.freeze([
  'steady state',
  'uniform heat flux over the base footprint',
  'one-dimensional conduction through the base',
  'one-dimensional fin conduction',
  'constant properties',
  'uniform specified convection coefficient',
  'air at ambient temperature everywhere',
  'corrected-length adiabatic-tip fins',
  'perfect fin-base contact',
])
