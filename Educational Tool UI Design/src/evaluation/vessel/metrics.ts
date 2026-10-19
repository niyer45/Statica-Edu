import type { VesselAnalysis } from '../../physics/vessel/types'

// Pressure vessel prediction and comparison metrics (task 69; PVS-08, MM-13, MM-14). The primary
// prediction metric is the hoop stress, named "hoop stress" for students. Scoring reuses the
// shared 0.98/1.02 ratio band (evaluation/prediction.ts `scorePredictionByMetric`). The readers
// return undefined for a stored value that is not a finite positive number, which makes an
// outcome not scorable instead of inventing a placeholder.

/** Reads a stored analysis field, or undefined when it is absent or not a finite positive number. */
function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

/** Numeric analysis fields a metric may read. */
export type VesselMetricId =
  | 'hoopStressPa'
  | 'longitudinalStressPa'
  | 'headStressPa'
  | 'volumeM3'
  | 'overallLengthM'
  | 'massKg'
  | 'shellRadiusRatio'

export interface VesselMetric {
  id: VesselMetricId
  /** Student-facing name. Contains no digits. */
  label: string
  read(a: VesselAnalysis): number | undefined
}

const metric = (id: VesselMetric['id'], label: string): VesselMetric =>
  Object.freeze({ id, label, read: (a: VesselAnalysis) => finitePositive(a[id]) })

/** The metric a prediction is scored against. */
export const VESSEL_PRIMARY_METRIC: VesselMetric = metric('hoopStressPa', 'hoop stress')

/** Stored-value metrics for history/compare deltas, in display order. */
export const VESSEL_COMPARISON_METRICS: readonly VesselMetric[] = Object.freeze([
  VESSEL_PRIMARY_METRIC,
  metric('longitudinalStressPa', 'longitudinal stress'),
  metric('headStressPa', 'head stress'),
  metric('volumeM3', 'internal volume'),
  metric('overallLengthM', 'overall length'),
  metric('massKg', 'mass'),
  metric('shellRadiusRatio', 'shell radius ÷ thickness'),
])
