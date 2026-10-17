import type { BracedFrameAnalysis } from '../../physics/bracedFrame/types'

// Braced frame prediction and comparison metrics (task 49.2; BFR-06, BFR-08, MM-13, MM-14).
// The primary prediction metric is |roof drift|, named "roof drift" for students and never
// "deflection". Scoring reuses the shared 0.98/1.02 ratio band (evaluation/prediction.ts
// `scorePredictionByMetric`). A mechanism has no roof drift, so the readers return undefined and
// a prediction involving a mechanism is recorded as not scorable (MM-13, OC-07).

/** A finite positive number, or undefined. */
function finitePositive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

/** Stored analysis values a metric may read. */
export type BracedFrameMetricId = 'roofDriftM' | 'floorDriftM' | 'maxStoreyDriftRatio' | 'maxUtilization' | 'massKg'

export interface BracedFrameMetric {
  id: BracedFrameMetricId
  /** Student-facing name. Contains no digits. */
  label: string
  read(a: BracedFrameAnalysis): number | undefined
}

/** Magnitude of a solved-only field; undefined for a mechanism. */
const solvedMagnitude = (id: Exclude<BracedFrameMetricId, 'massKg'>, label: string): BracedFrameMetric =>
  Object.freeze({ id, label, read: (a: BracedFrameAnalysis) => (a.status === 'solved' ? finitePositive(Math.abs(a[id])) : undefined) })

/** The metric a prediction is scored against: |δ_roof| (BFR-08). */
export const BRACED_FRAME_PRIMARY_METRIC: BracedFrameMetric = solvedMagnitude('roofDriftM', 'roof drift')

/** Stored-value metrics for history/compare deltas (BFR-06), in display order. */
export const BRACED_FRAME_COMPARISON_METRICS: readonly BracedFrameMetric[] = Object.freeze([
  BRACED_FRAME_PRIMARY_METRIC,
  solvedMagnitude('maxUtilization', 'maximum member utilization'),
  Object.freeze({ id: 'massKg' as const, label: 'mass', read: (a: BracedFrameAnalysis) => finitePositive(a.massKg) }),
  solvedMagnitude('floorDriftM', 'floor drift'),
  solvedMagnitude('maxStoreyDriftRatio', 'maximum inter-storey drift ratio'),
])
