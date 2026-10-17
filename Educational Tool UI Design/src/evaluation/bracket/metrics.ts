import type { BracketAnalysis } from '../../physics/bracket/types'

// Bracket prediction and comparison metrics (task 46.2; MBR-07, MBR-09, MM-13, MM-14).
// The primary prediction metric is the peak stress, named "peak stress" for students and never
// "deflection". Scoring reuses the shared 0.98/1.02 ratio band (evaluation/prediction.ts
// `scorePredictionByMetric`); a side without a finite positive peak stress (Kt fit undefined)
// makes the outcome not scorable, which is why the readers return undefined instead of a
// placeholder.

/** Reads a stored analysis field, or undefined when it is absent or not a finite positive number. */
function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

/** Numeric analysis fields a metric may read. */
export type BracketMetricId =
  | 'peakStressPa'
  | 'ktStep'
  | 'rootStressPa'
  | 'stepNominalStressPa'
  | 'stepPeakStressPa'
  | 'tipDeflectionM'
  | 'massKg'
  | 'envelopeDepthM'

export interface BracketMetric {
  id: BracketMetricId
  /** Student-facing name. Contains no digits. */
  label: string
  read(a: BracketAnalysis): number | undefined
}

const metric = (id: BracketMetric['id'], label: string): BracketMetric =>
  Object.freeze({ id, label, read: (a: BracketAnalysis) => finitePositive(a[id]) })

/** The metric a prediction is scored against (MBR-09). */
export const BRACKET_PRIMARY_METRIC: BracketMetric = metric('peakStressPa', 'peak stress')

/** Stored-value metrics for history/compare deltas (MBR-07), in display order. */
export const BRACKET_COMPARISON_METRICS: readonly BracketMetric[] = Object.freeze([
  BRACKET_PRIMARY_METRIC,
  metric('ktStep', 'Kt at the step'),
  metric('rootStressPa', 'nominal root stress'),
  metric('stepNominalStressPa', 'nominal step stress'),
  metric('stepPeakStressPa', 'step peak stress'),
  metric('tipDeflectionM', 'tip deflection'),
  metric('massKg', 'mass'),
  metric('envelopeDepthM', 'envelope depth'),
])
