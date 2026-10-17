import { withinLimit } from '../tolerance'
import { BRACED_FRAME_THRESHOLDS, type BracedFrameScreenCode } from './constants'
import type { BracedFrameApplicabilityIssue, BracedFrameSolvedAnalysis } from './types'

// Braced frame applicability (task 49.2; BFR-11, BFR-12). Pure: reads its inputs, never mutates
// them. Screen thresholds come only from ./constants.ts; comparisons use the shared inclusive
// withinLimit (REL_TOL), so a metric exactly at a threshold is on the safe side.
//   MECHANISM           reported by the solver (numeric detection only); always not applicable
//   INELASTIC_BUCKLING  max |N| / N_J over compression members with λ < λ_c (when any qualifies)
//   LARGE_DRIFT         maximum inter-storey drift ratio

/** Plain-language name of each screened metric, used in student-facing messages. */
const METRIC_LABELS: Readonly<Record<BracedFrameScreenCode, string>> = Object.freeze({
  INELASTIC_BUCKLING: 'The largest compression force divided by the inelastic (Johnson) buckling load of a stocky member',
  LARGE_DRIFT: 'The largest inter-storey drift ratio',
})

/** Up to 3 significant figures without trailing zeros, e.g. 0.902, 0.01. */
const fmt = (x: number): string => String(Number(x.toPrecision(3)))

function issue(code: BracedFrameScreenCode, value: number, threshold: number, level: 'warning' | 'notApplicable'): BracedFrameApplicabilityIssue {
  const { effect } = BRACED_FRAME_THRESHOLDS[code]
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

/** The not-applicable issue for a mechanism with `modes` independent mechanism modes (≥ 1). */
export function mechanismIssue(modes: number): BracedFrameApplicabilityIssue {
  return {
    code: 'MECHANISM',
    message:
      `The frame is a mechanism (${modes} independent sway ${modes === 1 ? 'mode' : 'modes'}): a pin-jointed storey ` +
      'without a diagonal cannot resist sideways load, so displacements, member forces, drift and reactions are not defined.',
    value: modes,
    threshold: 0,
  }
}

/** The solved-analysis fields the screens read. */
export type BracedFrameScreenInput = Pick<BracedFrameSolvedAnalysis, 'maxStoreyDriftRatio' | 'maxInelasticRatio'>

/** Metric values evaluated for a solved frame, keyed by code. Codes not evaluated are absent. */
export function bracedFrameScreenMetrics(a: BracedFrameScreenInput): Partial<Record<BracedFrameScreenCode, number>> {
  const m: Partial<Record<BracedFrameScreenCode, number>> = {}
  if (a.maxInelasticRatio !== undefined) m.INELASTIC_BUCKLING = a.maxInelasticRatio
  m.LARGE_DRIFT = a.maxStoreyDriftRatio
  return m
}

/**
 * Classifies each evaluated screen metric of a solved frame: not-applicable is checked first,
 * then warning, so each code appears at most once across both lists, in fixed code order.
 */
export function checkBracedFrameScreens(a: BracedFrameScreenInput): {
  warnings: BracedFrameApplicabilityIssue[]
  notApplicable: BracedFrameApplicabilityIssue[]
} {
  const values = bracedFrameScreenMetrics(a)
  const warnings: BracedFrameApplicabilityIssue[] = []
  const notApplicable: BracedFrameApplicabilityIssue[] = []
  for (const code of ['INELASTIC_BUCKLING', 'LARGE_DRIFT'] as const) {
    const value = values[code]
    if (value === undefined) continue
    const { warning, notApplicable: naLimit } = BRACED_FRAME_THRESHOLDS[code]
    if (!withinLimit(value, naLimit)) {
      notApplicable.push(issue(code, value, naLimit, 'notApplicable'))
    } else if (!withinLimit(value, warning)) {
      warnings.push(issue(code, value, warning, 'warning'))
    }
  }
  return { warnings, notApplicable }
}
