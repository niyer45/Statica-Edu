import type { BracketChallenge } from '../../challenge/bracket/types'
import { isUniformBar, type BracketDesign } from '../../geometry/bracket/design'
import { withinLimit } from '../tolerance'
import {
  BRACKET_APPLICABILITY_CODES,
  BRACKET_THRESHOLDS,
  KT_SHOULDER_CONDITION,
  KT_SMALL_STEP_MIN_RATIO,
  type BracketApplicabilityCode,
} from './constants'
import { shoulderRatios } from './kt'
import type { BracketApplicabilityInput, BracketApplicabilityIssue } from './types'

// Bracket applicability checker (task 46.2; MBR-14). Pure: reads its inputs, never mutates them.
// Thresholds come only from ./constants.ts; comparisons use the shared inclusive withinLimit
// (REL_TOL), so a metric exactly at a threshold is on the safe side.
//   KT_FIT_SHARP        h/r                                   step only
//   KT_FIT_SHALLOW      r/h                                   step only
//   KT_SHOULDER_LENGTH  [2.0 − 2.05(r/d − 0.025)] / (a/D)     step only
//   KT_STEP_RATIO       D/d                                   step only
//   KT_SMALL_STEP       1.1 / (D/d)                           step only
//   PLASTICITY          σ_peak / σ_yield                      only when a peak stress exists
//   DEPTH_SPAN          D/L
//   RECT_ASPECT         D/b
//   LARGE_DEFLECTION    δ_tip/L
// Step-related screens are skipped for a uniform bar; PLASTICITY is skipped when no peak stress
// exists, because the design is then already not applicable (KT_FIT_*).

/** Plain-language name of each metric, used in student-facing messages. */
const METRIC_LABELS: Readonly<Record<BracketApplicabilityCode, string>> = Object.freeze({
  KT_FIT_SHARP: 'Shoulder height divided by fillet radius',
  KT_FIT_SHALLOW: 'Fillet radius divided by shoulder height',
  KT_SHOULDER_LENGTH: 'Required deep-segment length divided by the step location (relative to root depth)',
  KT_STEP_RATIO: 'Root depth divided by arm depth',
  KT_SMALL_STEP: 'Minimum step ratio divided by root depth over arm depth',
  PLASTICITY: 'Peak stress divided by yield stress',
  DEPTH_SPAN: 'Root depth divided by length',
  RECT_ASPECT: 'Root depth divided by thickness',
  LARGE_DEFLECTION: 'Tip deflection divided by length',
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

/** Metric values evaluated for this design, keyed by code. Codes not evaluated are absent. */
export function bracketApplicabilityMetrics(
  d: BracketDesign,
  a: BracketApplicabilityInput,
  ch: Pick<BracketChallenge, 'material' | 'lengthM' | 'thicknessM'>,
): Partial<Record<BracketApplicabilityCode, number>> {
  const D = d.rootDepthM
  const m: Partial<Record<BracketApplicabilityCode, number>> = {}
  if (!isUniformBar(d)) {
    const s = shoulderRatios(D, d.armDepthM, d.filletRadiusM)
    const k = KT_SHOULDER_CONDITION
    m.KT_FIT_SHARP = s.heightToRadiusRatio
    m.KT_FIT_SHALLOW = s.radiusToHeightRatio
    m.KT_SHOULDER_LENGTH = (k.intercept - k.slope * (d.filletRadiusM / d.armDepthM - k.rOverDOffset)) / (d.stepLocationM / D)
    m.KT_STEP_RATIO = s.stepRatio
    m.KT_SMALL_STEP = KT_SMALL_STEP_MIN_RATIO / s.stepRatio
  }
  if (a.peakStressPa !== undefined) m.PLASTICITY = a.peakStressPa / ch.material.yieldStressPa
  m.DEPTH_SPAN = D / ch.lengthM
  m.RECT_ASPECT = D / ch.thicknessM
  m.LARGE_DEFLECTION = a.tipDeflectionM / ch.lengthM
  return m
}

/**
 * Classifies each evaluated metric: not-applicable is checked first, then warning, so each code
 * appears at most once across both lists. Issues follow BRACKET_APPLICABILITY_CODES order. For a
 * screen with no warning band (warning = not applicable) only the not-applicable level can fire.
 *
 * Precondition: `d` is valid for `ch` and `a` holds the finite analysis of `d`.
 */
export function checkBracketApplicability(
  d: BracketDesign,
  a: BracketApplicabilityInput,
  ch: Pick<BracketChallenge, 'material' | 'lengthM' | 'thicknessM'>,
): { warnings: BracketApplicabilityIssue[]; notApplicable: BracketApplicabilityIssue[] } {
  const values = bracketApplicabilityMetrics(d, a, ch)
  const warnings: BracketApplicabilityIssue[] = []
  const notApplicable: BracketApplicabilityIssue[] = []
  for (const code of BRACKET_APPLICABILITY_CODES) {
    const value = values[code]
    if (value === undefined) continue
    const { warning, notApplicable: naLimit } = BRACKET_THRESHOLDS[code]
    if (!withinLimit(value, naLimit)) {
      notApplicable.push(issue(code, value, naLimit, 'notApplicable'))
    } else if (!withinLimit(value, warning)) {
      warnings.push(issue(code, value, warning, 'warning'))
    }
  }
  return { warnings, notApplicable }
}
