import type { BracketChallenge } from '../../challenge/bracket/types'
import type { BracketDesign } from '../../geometry/bracket/design'
import { withinLimit } from '../tolerance'
import { BRACKET_APPLICABILITY_CODES, BRACKET_THRESHOLDS, CURVED_BEAM_MIN_R_OVER_C, type BracketApplicabilityCode } from './constants'
import type { BracketApplicabilityInput, BracketApplicabilityIssue } from './types'

// Bracket applicability checker (task 55). Pure: reads its inputs, never mutates them.
// Thresholds come only from ./constants.ts; comparisons use the shared inclusive withinLimit
// (REL_TOL), so a metric exactly at a threshold is on the safe side.
//   CURVED_BEAM_RANGE  1.2 / (R/c)
//   PLASTICITY         σ_bend / σ_yield
//   LARGE_DEFLECTION   δ / a
//   LEG_SPAN           t / h_b

/** Plain-language name of each metric, used in student-facing messages. */
const METRIC_LABELS: Readonly<Record<BracketApplicabilityCode, string>> = Object.freeze({
  CURVED_BEAM_RANGE: 'Sharpest tabulated bend ratio divided by this bend ratio',
  PLASTICITY: 'Bend stress divided by yield stress',
  LARGE_DEFLECTION: 'Deflection divided by load offset',
  LEG_SPAN: 'Thickness divided by bolt lever arm',
})

/** Up to 3 significant figures without trailing zeros, e.g. 0.899, 14, 0.8. */
const fmt = (x: number): string => String(Number(x.toPrecision(3)))

function issue(
  code: BracketApplicabilityCode,
  value: number,
  threshold: number,
  level: 'warning' | 'notApplicable',
): BracketApplicabilityIssue {
  const { effect } = BRACKET_THRESHOLDS[code]
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

/** Metric values evaluated for this design, keyed by code. */
export function bracketApplicabilityMetrics(
  d: BracketDesign,
  a: BracketApplicabilityInput,
  ch: Pick<BracketChallenge, 'material' | 'loadOffsetM'>,
): Record<BracketApplicabilityCode, number> {
  return {
    CURVED_BEAM_RANGE: CURVED_BEAM_MIN_R_OVER_C / a.bendRadiusRatio,
    PLASTICITY: a.bendStressPa / ch.material.yieldStressPa,
    LARGE_DEFLECTION: a.deflectionM / ch.loadOffsetM,
    LEG_SPAN: d.thicknessM / a.boltLeverArmM,
  }
}

/**
 * Classifies each metric: not-applicable is checked first, then warning, so each code appears at
 * most once across both lists. Issues follow BRACKET_APPLICABILITY_CODES order. For a screen with
 * no warning band (warning = not applicable) only the not-applicable level can fire.
 *
 * Precondition: `d` is valid for `ch` and `a` holds the finite analysis of `d`.
 */
export function checkBracketApplicability(
  d: BracketDesign,
  a: BracketApplicabilityInput,
  ch: Pick<BracketChallenge, 'material' | 'loadOffsetM'>,
): { warnings: BracketApplicabilityIssue[]; notApplicable: BracketApplicabilityIssue[] } {
  const values = bracketApplicabilityMetrics(d, a, ch)
  const warnings: BracketApplicabilityIssue[] = []
  const notApplicable: BracketApplicabilityIssue[] = []
  for (const code of BRACKET_APPLICABILITY_CODES) {
    const value = values[code]
    const { warning, notApplicable: naLimit } = BRACKET_THRESHOLDS[code]
    if (!withinLimit(value, naLimit)) {
      notApplicable.push(issue(code, value, naLimit, 'notApplicable'))
    } else if (!withinLimit(value, warning)) {
      warnings.push(issue(code, value, warning, 'warning'))
    }
  }
  return { warnings, notApplicable }
}
