import type { TorsionAnalysis } from '../../physics/torsion/types'

// Torsion prediction and comparison metrics (task 47.2; TSH-06, TSH-08, MM-13, MM-14).
// The primary prediction metric is the angle of twist, named "twist angle" for students and never
// "deflection". Scoring reuses the shared 0.98/1.02 ratio band (evaluation/prediction.ts
// `classifyRatio`); a side without a finite positive metric makes the outcome not scorable,
// which is why the readers return undefined instead of a placeholder.

/** Reads a stored analysis field, or undefined when it is not a finite positive number. */
function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

/** Numeric analysis fields a metric may read. */
export type TorsionMetricId =
  | 'twistRad'
  | 'maxShearStressPa'
  | 'massKg'
  | 'outerDiameterM'
  | 'torsionalStiffnessNmPerRad'
  | 'polarMomentM4'
  | 'areaM2'

export interface TorsionMetric {
  id: TorsionMetricId
  /** Student-facing name. Contains no digits. */
  label: string
  read(a: TorsionAnalysis): number | undefined
}

const metric = (id: TorsionMetric['id'], label: string): TorsionMetric =>
  Object.freeze({ id, label, read: (a: TorsionAnalysis) => finitePositive(a[id]) })

/** The metric a prediction is scored against (TSH-08). */
export const TORSION_PRIMARY_METRIC: TorsionMetric = metric('twistRad', 'twist angle')

/** Stored-value metrics for history/compare deltas (TSH-06), in display order. */
export const TORSION_COMPARISON_METRICS: readonly TorsionMetric[] = Object.freeze([
  TORSION_PRIMARY_METRIC,
  metric('maxShearStressPa', 'maximum shear stress'),
  metric('massKg', 'mass'),
  metric('outerDiameterM', 'outer diameter'),
  metric('torsionalStiffnessNmPerRad', 'torsional stiffness'),
  metric('polarMomentM4', 'polar moment'),
])
