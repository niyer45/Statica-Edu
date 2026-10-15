import type { Challenge } from '../challenge/types'
import { orientedEnvelope } from '../geometry/envelope'
import type { BeamDesign } from '../geometry/sections'
import { APPLICABILITY_CODES, THRESHOLDS, type ApplicabilityCode } from './constants'
import { withinLimit } from './tolerance'
import type { ApplicabilityInput, ApplicabilityIssue } from './types'

// Applicability checker (Req 10.1–10.7, 10.10). Pure: reads its inputs, never mutates them.
// Thresholds come only from constants.ts.
//
// Orientation dependence:
// - DEPTH_SPAN and RECT_ASPECT use the oriented envelope, so they change with orientation.
//   RECT_ASPECT is evaluated only when the rectangle's envelope height > envelope width
//   (long side vertical), so a rectangle evaluates it in at most one of 0° / 90°.
// - LARGE_DEFLECTION and PLASTICITY depend on orientation through δ and σ.
// - TUBE_SLENDERNESS, FLANGE_OUTSTAND, WEB_SLENDERNESS are local plate/shell ratios of the
//   section's own geometry, so they are evaluated for every orientation of their section kind.

/** Plain-language name of each metric, used in student-facing messages. */
const METRIC_LABELS: Readonly<Record<ApplicabilityCode, string>> = Object.freeze({
  DEPTH_SPAN: 'Section depth divided by span',
  LARGE_DEFLECTION: 'Tip deflection divided by span',
  PLASTICITY: 'Nominal stress divided by yield stress',
  TUBE_SLENDERNESS: 'Tube diameter divided by wall thickness',
  FLANGE_OUTSTAND: 'Flange outstand divided by flange thickness',
  WEB_SLENDERNESS: 'Web height divided by web thickness',
  RECT_ASPECT: 'Section height divided by width',
})

/** Up to 3 significant figures without trailing zeros, e.g. 0.0411, 10.9, 0.2. */
const fmt = (x: number): string => String(Number(x.toPrecision(3)))

function issue(
  code: ApplicabilityCode,
  value: number,
  threshold: number,
  level: 'warning' | 'notApplicable',
): ApplicabilityIssue {
  const { effect } = THRESHOLDS[code]
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

/** Metric values evaluated for this design, keyed by code. Codes not evaluated are absent (Req 10.3). */
function metrics(
  d: BeamDesign,
  a: ApplicabilityInput,
  ch: Challenge,
): Partial<Record<ApplicabilityCode, number>> {
  const L = d.lengthM
  const env = orientedEnvelope(d.section, d.orientationDeg)
  const m: Partial<Record<ApplicabilityCode, number>> = {
    DEPTH_SPAN: env.heightYM / L,
    LARGE_DEFLECTION: a.tipDeflectionM / L,
    PLASTICITY: a.nominalMaxStressPa / ch.material.yieldStressPa,
  }
  const s = d.section
  switch (s.kind) {
    case 'tube': {
      const wall = (s.outerDiameterM - s.innerDiameterM) / 2
      m.TUBE_SLENDERNESS = s.outerDiameterM / wall
      break
    }
    case 'iSection': {
      const { widthM: b, heightM: h, flangeThicknessM: tf, webThicknessM: tw } = s
      m.FLANGE_OUTSTAND = (b - tw) / (2 * tf)
      m.WEB_SLENDERNESS = (h - 2 * tf) / tw
      break
    }
    case 'rectangle':
      if (env.heightYM > env.widthZM) m.RECT_ASPECT = env.heightYM / env.widthZM
      break
    case 'circle':
      break
  }
  return m
}

/**
 * Classifies each evaluated metric against THRESHOLDS: not-applicable is checked first, then
 * warning, so each code appears at most once across both lists (Req 10.7). Values within
 * REL_TOL of a threshold produce no issue (Req 10.6). Issues follow APPLICABILITY_CODES order.
 *
 * Precondition: `d` is valid for `ch` and `a` holds the finite analysis of `d`.
 */
export function checkApplicability(
  d: BeamDesign,
  a: ApplicabilityInput,
  ch: Challenge,
): { warnings: ApplicabilityIssue[]; notApplicable: ApplicabilityIssue[] } {
  const values = metrics(d, a, ch)
  const warnings: ApplicabilityIssue[] = []
  const notApplicable: ApplicabilityIssue[] = []
  for (const code of APPLICABILITY_CODES) {
    const value = values[code]
    if (value === undefined) continue
    const { warning, notApplicable: naLimit } = THRESHOLDS[code]
    if (!withinLimit(value, naLimit)) {
      notApplicable.push(issue(code, value, naLimit, 'notApplicable'))
    } else if (!withinLimit(value, warning)) {
      warnings.push(issue(code, value, warning, 'warning'))
    }
  }
  return { warnings, notApplicable }
}
