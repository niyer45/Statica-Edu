import type { ColumnChallenge } from '../../challenge/column/types'
import { withinLimit } from '../tolerance'
import { COLUMN_APPLICABILITY_CODES, COLUMN_THRESHOLDS, type ColumnApplicabilityCode } from './constants'
import type { ColumnApplicabilityInput, ColumnApplicabilityIssue } from './types'

// Column applicability checker (task 68; CBK-11, CBK-12). Pure: reads its inputs, never mutates
// them. Thresholds come only from ./constants.ts; comparisons use the shared inclusive withinLimit
// (REL_TOL), so a metric exactly at a threshold is on the safe side.
//   EULER_RANGE       σ_E / σ_y
//   WALL_SLENDERNESS  D / t

/** Plain-language name of each metric, used in student-facing messages. */
const METRIC_LABELS: Readonly<Record<ColumnApplicabilityCode, string>> = Object.freeze({
  EULER_RANGE: 'Buckling stress divided by yield stress',
  WALL_SLENDERNESS: 'Outer diameter divided by wall thickness',
})

/** Why the limit exists, in one plain sentence (no digits). */
const REASONS: Readonly<Record<ColumnApplicabilityCode, string>> = Object.freeze({
  EULER_RANGE: 'This column is too stocky for the Euler formula: the material starts to yield before it buckles.',
  WALL_SLENDERNESS: 'A very thin wall can crumple locally before the whole column bows.',
})

/** Up to 3 significant figures without trailing zeros, e.g. 0.899, 14, 0.5. */
const fmt = (x: number): string => String(Number(x.toPrecision(3)))

function issue(code: ColumnApplicabilityCode, value: number, threshold: number, level: 'warning' | 'notApplicable'): ColumnApplicabilityIssue {
  const { effect } = COLUMN_THRESHOLDS[code]
  const consequence =
    level === 'notApplicable'
      ? `The model does not include ${effect}, so its results cannot be trusted for this design.`
      : `The model does not include ${effect}, so treat these results with caution.`
  const limitName = level === 'notApplicable' ? 'model limit' : 'caution level'
  const reason = level === 'notApplicable' ? ` ${REASONS[code]}` : ''
  return {
    code,
    message: `${METRIC_LABELS[code]} is ${fmt(value)}, above the ${limitName} of ${fmt(threshold)}.${reason} ${consequence}`,
    value,
    threshold,
  }
}

/** Metric values evaluated for this design, keyed by code. */
export function columnApplicabilityMetrics(a: ColumnApplicabilityInput, ch: Pick<ColumnChallenge, 'material'>): Record<ColumnApplicabilityCode, number> {
  return {
    EULER_RANGE: a.eulerStressPa / ch.material.yieldStressPa,
    WALL_SLENDERNESS: a.diameterToWall,
  }
}

/**
 * Classifies each metric: not-applicable is checked first, then warning, so each code appears at
 * most once across both lists. Issues follow COLUMN_APPLICABILITY_CODES order.
 *
 * Precondition: `a` holds the finite analysis of a valid design.
 */
export function checkColumnApplicability(
  a: ColumnApplicabilityInput,
  ch: Pick<ColumnChallenge, 'material'>,
): { warnings: ColumnApplicabilityIssue[]; notApplicable: ColumnApplicabilityIssue[] } {
  const values = columnApplicabilityMetrics(a, ch)
  const warnings: ColumnApplicabilityIssue[] = []
  const notApplicable: ColumnApplicabilityIssue[] = []
  for (const code of COLUMN_APPLICABILITY_CODES) {
    const value = values[code]
    const { warning, notApplicable: naLimit } = COLUMN_THRESHOLDS[code]
    if (!withinLimit(value, naLimit)) {
      notApplicable.push(issue(code, value, naLimit, 'notApplicable'))
    } else if (!withinLimit(value, warning)) {
      warnings.push(issue(code, value, warning, 'warning'))
    }
  }
  return { warnings, notApplicable }
}
