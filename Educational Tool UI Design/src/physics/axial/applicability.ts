import { withinLimit } from '../tolerance'
import { AXIAL_APPLICABILITY_CODES, AXIAL_THRESHOLDS, type AxialApplicabilityCode } from './constants'
import type { AxialApplicabilityIssue } from './types'

// Stress and Strain I applicability checker (task 72; SSR-10). Pure. The threshold comes only from
// ./constants.ts; comparisons use the shared inclusive withinLimit (REL_TOL), so a metric exactly
// at a threshold is on the safe side.
//   PLASTICITY  σ / σ_y: warning above 0.8, not applicable above 1 (the rod has yielded)

const METRIC_LABELS: Readonly<Record<AxialApplicabilityCode, string>> = Object.freeze({
  PLASTICITY: 'Axial stress divided by yield strength',
})

/** Up to 3 significant figures without trailing zeros, e.g. 0.837, 2.83, 0.8. */
const fmt = (x: number): string => String(Number(x.toPrecision(3)))

function issue(code: AxialApplicabilityCode, value: number, threshold: number, level: 'warning' | 'notApplicable'): AxialApplicabilityIssue {
  const { effect } = AXIAL_THRESHOLDS[code]
  const consequence =
    level === 'notApplicable'
      ? `The rod has reached yield. The model does not include ${effect}, so its results cannot be trusted for this design.`
      : `The rod is close to yield. The model does not include ${effect}, so treat these results with caution.`
  const limitName = level === 'notApplicable' ? 'model limit' : 'caution level'
  return {
    code,
    message: `${METRIC_LABELS[code]} is ${fmt(value)}, above the ${limitName} of ${fmt(threshold)}. ${consequence}`,
    value,
    threshold,
  }
}

/**
 * Classifies the yield ratio: not-applicable is checked first, then warning, so the code appears at
 * most once across both lists.
 *
 * Precondition: `yieldRatio` is the finite σ / σ_y of a valid design's analysis.
 */
export function checkAxialApplicability(yieldRatio: number): { warnings: AxialApplicabilityIssue[]; notApplicable: AxialApplicabilityIssue[] } {
  const values: Record<AxialApplicabilityCode, number> = { PLASTICITY: yieldRatio }
  const warnings: AxialApplicabilityIssue[] = []
  const notApplicable: AxialApplicabilityIssue[] = []
  for (const code of AXIAL_APPLICABILITY_CODES) {
    const value = values[code]
    const { warning, notApplicable: naLimit } = AXIAL_THRESHOLDS[code]
    if (!withinLimit(value, naLimit)) notApplicable.push(issue(code, value, naLimit, 'notApplicable'))
    else if (!withinLimit(value, warning)) warnings.push(issue(code, value, warning, 'warning'))
  }
  return { warnings, notApplicable }
}
