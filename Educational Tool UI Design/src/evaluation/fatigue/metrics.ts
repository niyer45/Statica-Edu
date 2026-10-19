import type { FatigueAnalysis } from '../../physics/fatigue/types'

// Fatigue prediction and comparison metrics (task 70; FAT-10, MM-13, MM-14). The primary
// prediction metric is the fatigue safety factor at the target life. Readers return undefined for
// a stored value that is absent or not a finite positive number (an infinite or low-cycle life has
// no predicted cycles), which makes a comparison show "—" instead of inventing a placeholder.

function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

export type FatigueMetricId =
  | 'fatigueSafetyFactor'
  | 'yieldSafetyFactor'
  | 'stressConcentrationKt'
  | 'fatigueNotchFactorKf'
  | 'alternatingStressPa'
  | 'enduranceLimitPa'
  | 'predictedLifeCycles'
  | 'massKg'
  | 'shoulderFaceM'

export interface FatigueMetric {
  id: FatigueMetricId
  /** Student-facing name. Contains no digits. */
  label: string
  read(a: FatigueAnalysis): number | undefined
}

const metric = (id: FatigueMetricId, label: string): FatigueMetric => Object.freeze({ id, label, read: (a: FatigueAnalysis) => finitePositive(a[id]) })

export const FATIGUE_PRIMARY_METRIC: FatigueMetric = metric('fatigueSafetyFactor', 'fatigue safety factor')

/** Stored-value metrics for history/compare deltas, in display order. */
export const FATIGUE_COMPARISON_METRICS: readonly FatigueMetric[] = Object.freeze([
  FATIGUE_PRIMARY_METRIC,
  metric('yieldSafetyFactor', 'first-cycle yield safety factor'),
  metric('stressConcentrationKt', 'stress-concentration factor Kt'),
  metric('fatigueNotchFactorKf', 'fatigue notch factor Kf'),
  metric('alternatingStressPa', 'alternating stress at the fillet'),
  metric('enduranceLimitPa', 'endurance limit'),
  metric('predictedLifeCycles', 'predicted life (finite-life regime)'),
  metric('massKg', 'mass'),
  metric('shoulderFaceM', 'shoulder face'),
])
