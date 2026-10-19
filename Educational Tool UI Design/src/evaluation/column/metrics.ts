import type { ColumnAnalysis } from '../../physics/column/types'

// Column prediction and comparison metrics (task 68; CBK-09, MM-13, MM-14). The primary prediction
// metric is the critical buckling load, named "critical buckling load" for students. Scoring reuses
// the shared 0.98/1.02 ratio band (evaluation/prediction.ts `scorePredictionByMetric`). The readers
// return undefined for a stored value that is not a finite positive number, which makes an outcome
// not scorable instead of inventing a placeholder.

/** Reads a stored analysis field, or undefined when it is absent or not a finite positive number. */
function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

/** Numeric analysis fields a metric may read. */
export type ColumnMetricId =
  | 'criticalLoadN'
  | 'bucklingSafetyFactor'
  | 'axialStressPa'
  | 'massKg'
  | 'secondMomentM4'
  | 'areaM2'
  | 'slenderness'
  | 'criticalLoadPerMassNPerKg'

export interface ColumnMetric {
  id: ColumnMetricId
  /** Student-facing name. Contains no digits. */
  label: string
  read(a: ColumnAnalysis): number | undefined
}

const metric = (id: ColumnMetric['id'], label: string): ColumnMetric =>
  Object.freeze({ id, label, read: (a: ColumnAnalysis) => finitePositive(a[id]) })

/** The metric a prediction is scored against. */
export const COLUMN_PRIMARY_METRIC: ColumnMetric = metric('criticalLoadN', 'critical buckling load')

/** Stored-value metrics for history/compare deltas, in display order. */
export const COLUMN_COMPARISON_METRICS: readonly ColumnMetric[] = Object.freeze([
  COLUMN_PRIMARY_METRIC,
  metric('bucklingSafetyFactor', 'safety factor against buckling'),
  metric('axialStressPa', 'axial stress'),
  metric('massKg', 'mass'),
  metric('criticalLoadPerMassNPerKg', 'critical load per kilogram'),
  metric('secondMomentM4', 'second moment of area'),
  metric('areaM2', 'cross-section area'),
  metric('slenderness', 'slenderness'),
])
