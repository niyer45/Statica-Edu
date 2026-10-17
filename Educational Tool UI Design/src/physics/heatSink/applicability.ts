import { withinLimit } from '../tolerance'
import { HEAT_SINK_APPLICABILITY_CODES, HEAT_SINK_THRESHOLDS, type HeatSinkApplicabilityCode } from './constants'
import type { HeatSinkApplicabilityInput, HeatSinkApplicabilityIssue } from './types'

// Heat sink applicability checker (task 48.2; HSK-10). Pure: reads its inputs, never mutates them.
// Thresholds come only from ./constants.ts. Comparisons are inclusive with REL_TOL on the safe
// side, so a metric exactly at a threshold raises no issue at that level:
//   FIN_GAP         s (lower bound): an issue below the threshold
//   CHANNEL_ASPECT  H/s (upper bound): an issue above the threshold
//   FIN_BIOT        h t/(2k) (upper bound): an issue above the threshold
// Upper bounds use the shared withinLimit. The lower bound is the mirrored comparison
// `value ≥ threshold − |threshold|·REL_TOL`, written as withinLimit(−value, −threshold): negation
// is exact in IEEE arithmetic, so this is bitwise the same comparison as the heat sink
// evaluation's withinLowerLimit (asserted by evaluation/heatSink/tolerance.p8.test.ts), with the
// same rule that non-finite values never pass. physics/ cannot import evaluation/ (Req 1.7).

/** Plain-language name of each metric, used in student-facing messages. */
const METRIC_LABELS: Readonly<Record<HeatSinkApplicabilityCode, string>> = Object.freeze({
  FIN_GAP: 'The gap between fins',
  CHANNEL_ASPECT: 'Fin height divided by fin gap',
  FIN_BIOT: 'The fin Biot number (h·t / 2k)',
})

/** Up to 3 significant figures without trailing zeros, e.g. 0.899, 14, 0.8. */
const fmt = (x: number): string => String(Number(x.toPrecision(3)))

/** Metric text: the gap in millimetres, other metrics as plain numbers. */
const show = (code: HeatSinkApplicabilityCode, x: number): string => (code === 'FIN_GAP' ? `${fmt(x * 1e3)} mm` : fmt(x))

/** True iff `value` is on the safe side of `threshold` for the code's direction (inclusive, REL_TOL). */
function safe(code: HeatSinkApplicabilityCode, value: number, threshold: number): boolean {
  return HEAT_SINK_THRESHOLDS[code].direction === 'lower' ? withinLimit(-value, -threshold) : withinLimit(value, threshold)
}

function issue(
  code: HeatSinkApplicabilityCode,
  value: number,
  threshold: number,
  level: 'warning' | 'notApplicable',
): HeatSinkApplicabilityIssue {
  const { effect, direction } = HEAT_SINK_THRESHOLDS[code]
  const consequence =
    level === 'notApplicable'
      ? `The model does not include ${effect}, so its results cannot be trusted for this design.`
      : `The model does not include ${effect}, so treat these results with caution.`
  const limitName = level === 'notApplicable' ? 'model limit' : 'caution level'
  const side = direction === 'lower' ? 'below' : 'above'
  return {
    code,
    message: `${METRIC_LABELS[code]} is ${show(code, value)}, ${side} the ${limitName} of ${show(code, threshold)}. ${consequence}`,
    value,
    threshold,
  }
}

/** Metric values for this design, keyed by code; every code is evaluated for every design. */
export function heatSinkApplicabilityMetrics(a: HeatSinkApplicabilityInput): Record<HeatSinkApplicabilityCode, number> {
  return { FIN_GAP: a.finGapM, CHANNEL_ASPECT: a.channelAspectRatio, FIN_BIOT: a.finBiotNumber }
}

/**
 * Classifies each metric: not-applicable is checked first, then warning, so each code appears at
 * most once across both lists. Issues follow HEAT_SINK_APPLICABILITY_CODES order.
 *
 * Precondition: `a` holds the finite analysis metrics of a valid design.
 */
export function checkHeatSinkApplicability(a: HeatSinkApplicabilityInput): {
  warnings: HeatSinkApplicabilityIssue[]
  notApplicable: HeatSinkApplicabilityIssue[]
} {
  const values = heatSinkApplicabilityMetrics(a)
  const warnings: HeatSinkApplicabilityIssue[] = []
  const notApplicable: HeatSinkApplicabilityIssue[] = []
  for (const code of HEAT_SINK_APPLICABILITY_CODES) {
    const value = values[code]
    const { warning, notApplicable: naLimit } = HEAT_SINK_THRESHOLDS[code]
    if (!safe(code, value, naLimit)) {
      notApplicable.push(issue(code, value, naLimit, 'notApplicable'))
    } else if (!safe(code, value, warning)) {
      warnings.push(issue(code, value, warning, 'warning'))
    }
  }
  return { warnings, notApplicable }
}
