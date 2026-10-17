import type { TorsionChallenge } from '../../challenge/torsion/types'
import type { TorsionDesign } from '../../geometry/torsion/design'
import { withinLimit } from '../tolerance'
import { TORSION_APPLICABILITY_CODES, TORSION_THRESHOLDS, type TorsionApplicabilityCode } from './constants'
import type { TorsionApplicabilityInput, TorsionApplicabilityIssue } from './types'

// Torsion applicability checker (task 47.2; TSH-10). Pure: reads its inputs, never mutates them.
// Thresholds come only from ./constants.ts; comparisons use the shared inclusive withinLimit
// (REL_TOL), so a metric exactly at a threshold is on the safe side.
//   PLASTICITY_SHEAR  τ_max / τ_yield, every section
//   TUBE_SLENDERNESS  D / t_wall with t_wall = (D − d)/2, tubes only

/** Plain-language name of each metric, used in student-facing messages. */
const METRIC_LABELS: Readonly<Record<TorsionApplicabilityCode, string>> = Object.freeze({
  PLASTICITY_SHEAR: 'Maximum shear stress divided by yield shear stress',
  TUBE_SLENDERNESS: 'Tube diameter divided by wall thickness',
})

/** Up to 3 significant figures without trailing zeros, e.g. 0.899, 14, 0.8. */
const fmt = (x: number): string => String(Number(x.toPrecision(3)))

function issue(
  code: TorsionApplicabilityCode,
  value: number,
  threshold: number,
  level: 'warning' | 'notApplicable',
): TorsionApplicabilityIssue {
  const { effect } = TORSION_THRESHOLDS[code]
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

/** Metric values evaluated for this design, keyed by code. Codes not evaluated are absent. */
export function torsionApplicabilityMetrics(
  d: TorsionDesign,
  a: TorsionApplicabilityInput,
  ch: Pick<TorsionChallenge, 'material'>,
): Partial<Record<TorsionApplicabilityCode, number>> {
  const m: Partial<Record<TorsionApplicabilityCode, number>> = {
    PLASTICITY_SHEAR: a.maxShearStressPa / ch.material.yieldShearStressPa,
  }
  const s = d.section
  if (s.kind === 'tube') m.TUBE_SLENDERNESS = s.outerDiameterM / ((s.outerDiameterM - s.innerDiameterM) / 2)
  return m
}

/**
 * Classifies each evaluated metric: not-applicable is checked first, then warning, so each code
 * appears at most once across both lists. Issues follow TORSION_APPLICABILITY_CODES order.
 *
 * Precondition: `d` is valid for `ch` and `a` holds the finite analysis of `d`.
 */
export function checkTorsionApplicability(
  d: TorsionDesign,
  a: TorsionApplicabilityInput,
  ch: Pick<TorsionChallenge, 'material'>,
): { warnings: TorsionApplicabilityIssue[]; notApplicable: TorsionApplicabilityIssue[] } {
  const values = torsionApplicabilityMetrics(d, a, ch)
  const warnings: TorsionApplicabilityIssue[] = []
  const notApplicable: TorsionApplicabilityIssue[] = []
  for (const code of TORSION_APPLICABILITY_CODES) {
    const value = values[code]
    if (value === undefined) continue
    const { warning, notApplicable: naLimit } = TORSION_THRESHOLDS[code]
    if (!withinLimit(value, naLimit)) {
      notApplicable.push(issue(code, value, naLimit, 'notApplicable'))
    } else if (!withinLimit(value, warning)) {
      warnings.push(issue(code, value, warning, 'warning'))
    }
  }
  return { warnings, notApplicable }
}
