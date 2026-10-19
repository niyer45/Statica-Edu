import type { VesselChallenge } from '../../challenge/vessel/types'
import type { VesselDesign } from '../../geometry/vessel/design'
import { withinLimit } from '../tolerance'
import { VESSEL_APPLICABILITY_CODES, VESSEL_THRESHOLDS, type VesselApplicabilityCode } from './constants'
import type { VesselApplicabilityInput, VesselApplicabilityIssue } from './types'

// Pressure vessel applicability checker (task 69; PVS-10). Pure: reads its inputs, never mutates
// them. Thresholds come only from ./constants.ts; comparisons use the shared inclusive withinLimit
// (REL_TOL), so a metric exactly at a threshold is on the safe side.
//   THIN_WALL_SHELL  t_s / r
//   THIN_WALL_HEAD   t_h / r
//   PLASTICITY       max(σ_h, σ_head) / σ_y

/** Plain-language name of each metric, used in student-facing messages. */
const METRIC_LABELS: Readonly<Record<VesselApplicabilityCode, string>> = Object.freeze({
  THIN_WALL_SHELL: 'Shell thickness divided by inner radius',
  THIN_WALL_HEAD: 'Head thickness divided by inner radius',
  PLASTICITY: 'Largest membrane stress divided by yield stress',
})

/** Up to 3 significant figures without trailing zeros, e.g. 0.12, 0.96, 2.4. */
const fmt = (x: number): string => String(Number(x.toPrecision(3)))

function issue(
  code: VesselApplicabilityCode,
  value: number,
  threshold: number,
  level: 'warning' | 'notApplicable',
): VesselApplicabilityIssue {
  const { effect } = VESSEL_THRESHOLDS[code]
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
export function vesselApplicabilityMetrics(
  d: VesselDesign,
  a: VesselApplicabilityInput,
  ch: Pick<VesselChallenge, 'material'>,
): Record<VesselApplicabilityCode, number> {
  return {
    THIN_WALL_SHELL: d.shellThicknessM / a.innerRadiusM,
    THIN_WALL_HEAD: d.headThicknessM / a.innerRadiusM,
    PLASTICITY: Math.max(a.hoopStressPa, a.headStressPa) / ch.material.yieldStressPa,
  }
}

/**
 * Classifies each metric: not-applicable is checked first, then warning, so each code appears at
 * most once across both lists. Issues follow VESSEL_APPLICABILITY_CODES order.
 *
 * Precondition: `d` is valid for `ch` and `a` holds the finite analysis of `d`.
 */
export function checkVesselApplicability(
  d: VesselDesign,
  a: VesselApplicabilityInput,
  ch: Pick<VesselChallenge, 'material'>,
): { warnings: VesselApplicabilityIssue[]; notApplicable: VesselApplicabilityIssue[] } {
  const values = vesselApplicabilityMetrics(d, a, ch)
  const warnings: VesselApplicabilityIssue[] = []
  const notApplicable: VesselApplicabilityIssue[] = []
  for (const code of VESSEL_APPLICABILITY_CODES) {
    const value = values[code]
    const { warning, notApplicable: naLimit } = VESSEL_THRESHOLDS[code]
    if (!withinLimit(value, naLimit)) {
      notApplicable.push(issue(code, value, naLimit, 'notApplicable'))
    } else if (!withinLimit(value, warning)) {
      warnings.push(issue(code, value, warning, 'warning'))
    }
  }
  return { warnings, notApplicable }
}
