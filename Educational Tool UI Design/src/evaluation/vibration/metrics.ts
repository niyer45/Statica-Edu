import type { VibrationAnalysis } from '../../physics/vibration/types'

// Vibration prediction and comparison metrics (task 50.2; VIB-06, VIB-08, MM-13, MM-14).
// The primary prediction metric is the worst in-band transmissibility, named "worst vibration
// transmitted in the operating band" for students and never deflection or twist. Scoring reuses
// the shared 0.98/1.02 ratio band (evaluation/prediction.ts `classifyRatio`); a side without a
// finite positive metric makes the outcome not scorable, which is why the readers return
// undefined instead of a placeholder.

/** Reads a stored analysis field, or undefined when it is not a finite positive number. */
function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

/** Numeric analysis fields a metric may read. */
export type VibrationMetricId =
  | 'worstInBandTransmissibility'
  | 'naturalFrequencyHz'
  | 'staticDeflectionM'
  | 'peakTransmissibility'
  | 'peakRelativeDisplacementM'
  | 'stiffnessNPerM'
  | 'dampingRatio'

export interface VibrationMetric {
  id: VibrationMetricId
  /** Student-facing name. Contains no digits. */
  label: string
  read(a: VibrationAnalysis): number | undefined
}

const metric = (id: VibrationMetric['id'], label: string): VibrationMetric =>
  Object.freeze({ id, label, read: (a: VibrationAnalysis) => finitePositive(a[id]) })

/** The metric a prediction is scored against (VIB-08). */
export const VIBRATION_PRIMARY_METRIC: VibrationMetric = metric(
  'worstInBandTransmissibility',
  'worst vibration transmitted in the operating band',
)

/** Stored-value metrics for history/compare deltas (VIB-06), in display order. */
export const VIBRATION_COMPARISON_METRICS: readonly VibrationMetric[] = Object.freeze([
  VIBRATION_PRIMARY_METRIC,
  metric('naturalFrequencyHz', 'natural frequency'),
  metric('staticDeflectionM', 'static deflection'),
  metric('peakTransmissibility', 'peak transmissibility'),
  metric('peakRelativeDisplacementM', 'peak relative displacement'),
  metric('stiffnessNPerM', 'stiffness'),
  metric('dampingRatio', 'damping ratio'),
])
