import type { BracketAnalysis } from '../../physics/bracket/types'

// Bracket prediction and comparison metrics (task 55 L-bracket; MM-13, MM-14). The primary
// prediction metric is the bend stress, named "bend stress" for students. Scoring reuses the
// shared 0.98/1.02 ratio band (evaluation/prediction.ts `scorePredictionByMetric`). The readers
// return undefined for a stored value that is not a finite positive number, which makes an
// outcome not scorable instead of inventing a placeholder.

/** Reads a stored analysis field, or undefined when it is absent or not a finite positive number. */
function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

/** Numeric analysis fields a metric may read. */
export type BracketMetricId =
  | 'bendStressPa'
  | 'curvedBeamFactor'
  | 'nominalBendStressPa'
  | 'deflectionM'
  | 'boltTensionN'
  | 'boltLeverArmM'
  | 'massKg'

export interface BracketMetric {
  id: BracketMetricId
  /** Student-facing name. Contains no digits. */
  label: string
  read(a: BracketAnalysis): number | undefined
}

const metric = (id: BracketMetric['id'], label: string): BracketMetric =>
  Object.freeze({ id, label, read: (a: BracketAnalysis) => finitePositive(a[id]) })

/** The metric a prediction is scored against. */
export const BRACKET_PRIMARY_METRIC: BracketMetric = metric('bendStressPa', 'bend stress')

/** Stored-value metrics for history/compare deltas, in display order. */
export const BRACKET_COMPARISON_METRICS: readonly BracketMetric[] = Object.freeze([
  BRACKET_PRIMARY_METRIC,
  metric('curvedBeamFactor', 'curved-beam factor'),
  metric('nominalBendStressPa', 'straight-beam stress'),
  metric('deflectionM', 'deflection at the load'),
  metric('boltTensionN', 'bolt tension'),
  metric('boltLeverArmM', 'bolt lever arm'),
  metric('massKg', 'mass'),
])
