import { withinLimit } from '../tolerance'
import { VIBRATION_APPLICABILITY_CODES, VIBRATION_THRESHOLDS, type VibrationApplicabilityCode } from './constants'
import type { VibrationApplicabilityInput, VibrationApplicabilityIssue } from './types'

// Vibration applicability checker (task 50.2; VIB-10). Pure: reads its inputs, never mutates
// them. Thresholds come only from ./constants.ts; comparisons use the shared inclusive
// withinLimit (REL_TOL), so a metric exactly at a threshold is on the safe side.
//   SPRING_STROKE  (δ_st + Z_peak) / linear stroke
//   DAMPING_RATIO  ζ
// Within the configured range, SPRING_STROKE warns or refuses only designs that already fail
// staticDeflection (design.md derived targets).

/** Plain-language name of each metric, used in student-facing messages. */
const METRIC_LABELS: Readonly<Record<VibrationApplicabilityCode, string>> = Object.freeze({
  SPRING_STROKE: 'Static sag plus peak vibration travel, divided by the mount stroke,',
  DAMPING_RATIO: 'The damping ratio',
})

/** Up to 3 significant figures without trailing zeros, e.g. 0.926, 1.48, 0.8. */
const fmt = (x: number): string => String(Number(x.toPrecision(3)))

function issue(
  code: VibrationApplicabilityCode,
  value: number,
  threshold: number,
  level: 'warning' | 'notApplicable',
): VibrationApplicabilityIssue {
  const { effect } = VIBRATION_THRESHOLDS[code]
  const consequence =
    level === 'notApplicable'
      ? `The model does not include ${effect}, so its results cannot be trusted for this design.`
      : `The model does not include ${effect}, so treat these results with caution.`
  const limitName = level === 'notApplicable' ? 'model limit' : 'caution level'
  return {
    code,
    message: `${METRIC_LABELS[code]} is ${fmt(value)}, above the ${limitName} of ${fmt(threshold)}. ${consequence}`,
    value,
    threshold,
  }
}

/** Metric values evaluated for this design, keyed by code. Both codes are always evaluated. */
export function vibrationApplicabilityMetrics(a: VibrationApplicabilityInput): Record<VibrationApplicabilityCode, number> {
  return { SPRING_STROKE: a.strokeRatio, DAMPING_RATIO: a.dampingRatio }
}

/**
 * Classifies each metric: not-applicable is checked first, then warning, so each code appears at
 * most once across both lists. Issues follow VIBRATION_APPLICABILITY_CODES order.
 *
 * Precondition: `a` holds the finite analysis values of a valid design.
 */
export function checkVibrationApplicability(
  a: VibrationApplicabilityInput,
): { warnings: VibrationApplicabilityIssue[]; notApplicable: VibrationApplicabilityIssue[] } {
  const values = vibrationApplicabilityMetrics(a)
  const warnings: VibrationApplicabilityIssue[] = []
  const notApplicable: VibrationApplicabilityIssue[] = []
  for (const code of VIBRATION_APPLICABILITY_CODES) {
    const value = values[code]
    const { warning, notApplicable: naLimit } = VIBRATION_THRESHOLDS[code]
    if (!withinLimit(value, naLimit)) {
      notApplicable.push(issue(code, value, naLimit, 'notApplicable'))
    } else if (!withinLimit(value, warning)) {
      warnings.push(issue(code, value, warning, 'warning'))
    }
  }
  return { warnings, notApplicable }
}
