import type { HeatSinkAnalysis } from '../../physics/heatSink/types'

// Heat sink prediction and comparison metrics (task 48.2; HSK-06, HSK-08, MM-13, MM-14).
// The primary prediction metric is the base temperature rise ΔT = T_base − T∞ (K, always > 0),
// named "base temperature rise" for students and never "deflection" or "stress". Using the rise
// rather than the absolute temperature keeps the ratio independent of the °C/K offset. Scoring
// reuses the shared 0.98/1.02 ratio band (evaluation/prediction.ts `classifyRatio`); a side
// without a finite positive metric makes the outcome not scorable, which is why the readers
// return undefined instead of a placeholder.

/** Reads a stored analysis field, or undefined when it is not a finite positive number. */
function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

/** Numeric analysis fields a metric may read. */
export type HeatSinkMetricId =
  | 'baseTemperatureRiseK'
  | 'baseTemperatureK'
  | 'massKg'
  | 'finEfficiency'
  | 'overallEfficiency'
  | 'totalAreaM2'
  | 'effectiveAreaM2'
  | 'finGapM'
  | 'finHeightM'
  | 'finHeatShare'
  | 'totalResistanceKPerW'

export interface HeatSinkMetric {
  id: HeatSinkMetricId
  /** Student-facing name. Contains no digits. */
  label: string
  read(a: HeatSinkAnalysis): number | undefined
}

const metric = (id: HeatSinkMetric['id'], label: string): HeatSinkMetric =>
  Object.freeze({ id, label, read: (a: HeatSinkAnalysis) => finitePositive(a[id]) })

/** The metric a prediction is scored against (HSK-08). */
export const HEAT_SINK_PRIMARY_METRIC: HeatSinkMetric = metric('baseTemperatureRiseK', 'base temperature rise')

/** Stored-value metrics for history/compare deltas (HSK-06), in display order. */
export const HEAT_SINK_COMPARISON_METRICS: readonly HeatSinkMetric[] = Object.freeze([
  HEAT_SINK_PRIMARY_METRIC,
  metric('baseTemperatureK', 'base temperature'),
  metric('massKg', 'mass'),
  metric('finEfficiency', 'fin efficiency'),
  metric('overallEfficiency', 'overall surface efficiency'),
  metric('totalAreaM2', 'total exposed area'),
  metric('effectiveAreaM2', 'effective area'),
  metric('finGapM', 'fin gap'),
  metric('finHeightM', 'fin height'),
  metric('finHeatShare', 'heat share through the fins'),
  metric('totalResistanceKPerW', 'total thermal resistance'),
])
