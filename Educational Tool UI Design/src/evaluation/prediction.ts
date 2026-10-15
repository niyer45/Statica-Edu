import type { Analysis } from '../physics/types'
import type { Prediction, PredictionDirection, PredictionOutcome, TestResult } from './types'

/** Lower bound (inclusive) of the "same" band for r = next / prev tip deflection (Req 14.7). */
export const SAME_BAND_LOW = 0.98
/** Upper bound (inclusive) of the "same" band for r = next / prev tip deflection (Req 14.7). */
export const SAME_BAND_HIGH = 1.02

/**
 * Classify a deflection ratio (Req 14.7): increase when r > 1.02, decrease when r < 0.98,
 * same when 0.98 ≤ r ≤ 1.02. ±Infinity classify as increase / decrease; NaN falls through
 * to 'same' (see `scorePrediction` for how NaN affects the match flag).
 */
export function classifyRatio(r: number): PredictionDirection {
  if (r > SAME_BAND_HIGH) return 'increase'
  if (r < SAME_BAND_LOW) return 'decrease'
  return 'same'
}

/**
 * Score a prediction against the measured change in tip deflection (Req 14.7, 14.8).
 *
 * `prev` is the immediately preceding Test_Result (the Baseline for iteration 1); `next` is
 * the new Analysis (only `tipDeflectionM` is read), so the reducer can score before the new
 * Test_Result exists. Pure; returns a frozen object.
 *
 * Non-finite ratio: valid analyses always have a finite positive tip deflection (physics/
 * throws otherwise), so this should not occur. If r is NaN, `actual` is 'same' and `matched`
 * is false: an undefined ratio cannot confirm any prediction. ±Infinity classify normally.
 */
export function scorePrediction(
  p: Prediction,
  prev: TestResult,
  next: Pick<Analysis, 'tipDeflectionM'>,
): PredictionOutcome {
  const ratio = next.tipDeflectionM / prev.analysis.tipDeflectionM
  const actual = classifyRatio(ratio)
  const matched = !Number.isNaN(ratio) && p.direction === actual
  return Object.freeze({ predicted: p.direction, actual, ratio, matched })
}
