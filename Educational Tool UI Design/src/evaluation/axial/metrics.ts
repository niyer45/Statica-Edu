import type { AxialAnalysis } from '../../physics/axial/types'

// Stress and Strain I prediction and comparison metrics (task 72; SSR-06, SSR-08, MM-13, MM-14).
// The primary prediction metric is the elongation, which responds to both levers (diameter and
// material). Scoring reuses the shared 0.98/1.02 ratio band; a side without a finite positive
// metric makes the outcome not scorable, which is why the readers return undefined.

function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

export type AxialMetricId = 'elongationM' | 'stressPa' | 'massKg' | 'diameterM' | 'strain' | 'axialStiffnessNPerM'

export interface AxialMetric {
  id: AxialMetricId
  /** Student-facing name. Contains no digits. */
  label: string
  read(a: AxialAnalysis): number | undefined
}

const metric = (id: AxialMetricId, label: string): AxialMetric => Object.freeze({ id, label, read: (a: AxialAnalysis) => finitePositive(a[id]) })

/** The metric a prediction is scored against (SSR-08). */
export const AXIAL_PRIMARY_METRIC: AxialMetric = metric('elongationM', 'elongation')

/** Stored-value metrics for history/compare deltas (SSR-06), in display order. */
export const AXIAL_COMPARISON_METRICS: readonly AxialMetric[] = Object.freeze([
  AXIAL_PRIMARY_METRIC,
  metric('stressPa', 'axial stress'),
  metric('massKg', 'mass'),
  metric('diameterM', 'diameter'),
  metric('strain', 'strain'),
  metric('axialStiffnessNPerM', 'axial stiffness'),
])
