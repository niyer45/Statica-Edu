import type { FatigueChallenge } from '../../challenge/fatigue/types'
import type { FatigueDesign } from '../../geometry/fatigue/design'
import { withinLimit } from '../tolerance'
import { FATIGUE_APPLICABILITY_CODES, FATIGUE_THRESHOLDS, KT_FIT_LIMITS, type FatigueApplicabilityCode } from './constants'
import type { FatigueAnalysisBase, FatigueApplicabilityIssue } from './types'

// Fatigue applicability checker (task 70; FAT-12). Pure. Thresholds come only from ./constants.ts;
// comparisons use the shared inclusive withinLimit (REL_TOL), so a metric exactly at its threshold
// is on the safe side. Every screen is not-applicable only (no warning band).
//   KT_FIT_RANGE  max((h/r)/20, 0.1/(h/r), (r/d)/0.3, (D/d)/3)
//   LOCAL_YIELD   (σa + σm) / Sy, local stresses
//   LOW_CYCLE     σa / (f Sut) + σm / Sut

const METRIC_LABELS: Readonly<Record<FatigueApplicabilityCode, string>> = Object.freeze({
  KT_FIT_RANGE: 'The largest fillet-geometry ratio over its fit limit (h/r from 0.1 to 20, r/d up to 0.3, D/d up to 3)',
  LOCAL_YIELD: 'Peak local stress at the fillet divided by the yield strength',
  LOW_CYCLE: 'The Goodman ratio at a thousand cycles',
})

/** Up to 3 significant figures without trailing zeros. */
const fmt = (x: number): string => String(Number(x.toPrecision(3)))

function issue(code: FatigueApplicabilityCode, value: number, threshold: number): FatigueApplicabilityIssue {
  const { effect } = FATIGUE_THRESHOLDS[code]
  return {
    code,
    message: `${METRIC_LABELS[code]} is ${fmt(value)}, above the model limit of ${fmt(threshold)}. The model does not include ${effect}, so its results cannot be trusted for this design.`,
    value,
    threshold,
  }
}

export type FatigueApplicabilityInput = Pick<FatigueAnalysisBase, 'shoulderHeightM' | 'alternatingStressPa' | 'meanStressPa' | 'strengthAt1e3CyclesPa'>

/** Metric values evaluated for this design, keyed by code. */
export function fatigueApplicabilityMetrics(
  d: FatigueDesign,
  a: FatigueApplicabilityInput,
  ch: Pick<FatigueChallenge, 'material'>,
): Record<FatigueApplicabilityCode, number> {
  const hr = a.shoulderHeightM / d.filletRadiusM
  const L = KT_FIT_LIMITS
  return {
    KT_FIT_RANGE: Math.max(hr / L.maxShoulderToFillet, L.minShoulderToFillet / hr, d.filletRadiusM / d.neckDiameterM / L.maxFilletToNeck, d.collarDiameterM / d.neckDiameterM / L.maxCollarToNeck),
    LOCAL_YIELD: (a.alternatingStressPa + a.meanStressPa) / ch.material.yieldStrengthPa,
    LOW_CYCLE: a.alternatingStressPa / a.strengthAt1e3CyclesPa + a.meanStressPa / ch.material.ultimateStrengthPa,
  }
}

/**
 * Classifies each metric in FATIGUE_APPLICABILITY_CODES order. Every screen has warning =
 * notApplicable, so only not-applicable issues are produced; `warnings` is kept for the shared
 * analysis envelope and is always empty for this model.
 */
export function checkFatigueApplicability(
  d: FatigueDesign,
  a: FatigueApplicabilityInput,
  ch: Pick<FatigueChallenge, 'material'>,
): { warnings: FatigueApplicabilityIssue[]; notApplicable: FatigueApplicabilityIssue[] } {
  const values = fatigueApplicabilityMetrics(d, a, ch)
  const warnings: FatigueApplicabilityIssue[] = []
  const notApplicable: FatigueApplicabilityIssue[] = []
  for (const code of FATIGUE_APPLICABILITY_CODES) {
    const value = values[code]
    const { warning, notApplicable: naLimit } = FATIGUE_THRESHOLDS[code]
    if (!withinLimit(value, naLimit)) notApplicable.push(issue(code, value, naLimit))
    else if (!withinLimit(value, warning)) warnings.push(issue(code, value, warning))
  }
  return { warnings, notApplicable }
}
