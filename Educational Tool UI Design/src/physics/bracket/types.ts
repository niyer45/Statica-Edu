import type { BracketModelId } from '../../challenge/bracket/types'
import type { BracketApplicabilityCode } from './constants'
import type { KtBranch } from './kt'

// Bracket analysis result types (task 46.2; MBR-07, MBR-11–MBR-13, MM-03, MM-10). Independent
// of the beam `Analysis`, whose shape is frozen (D-39). Undefined quantities are omitted keys,
// never undefined, null or NaN, so v2 saves re-analyze key-for-key (MM-18).

/** One applicability finding, shaped like the beam's ApplicabilityIssue with bracket codes. */
export interface BracketApplicabilityIssue {
  code: BracketApplicabilityCode
  /** Student-facing text naming the unmodeled effect and comparing value with threshold. */
  message: string
  /** Computed metric value (dimensionless ratio). */
  value: number
  /** The exceeded threshold: the warning threshold for warnings, the not-applicable one otherwise. */
  threshold: number
}

/** Where the peak stress occurs (MBR-11): `step` only if σ_step > σ_root strictly. */
export type BracketPeakLocation = 'root' | 'step'

/**
 * `solved`: every quantity this geometry defines is present (a uniform bar has no step terms).
 * `ktFitUndefined`: the bar has a step but the Kt fit does not cover it, so Kt, the step peak,
 * the peak stress and its location are absent and the model is not applicable (MBR-13, MM-10).
 */
export type BracketAnalysisStatus = 'solved' | 'ktFitUndefined'

export interface BracketAnalysis {
  modelId: BracketModelId
  modelVersion: 1
  status: BracketAnalysisStatus
  /** True iff `notApplicableReasons` is empty, independent of `warnings`. */
  applicable: boolean
  /** Applicable but approaching model limits. */
  warnings: readonly BracketApplicabilityIssue[]
  notApplicableReasons: readonly BracketApplicabilityIssue[]
  /** Effects never modeled, always listed (MBR-15). */
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  /** M(0) = F L, N·m. */
  rootMomentNm: number
  /** σ_root = 6FL/(bD²), nominal, Pa. The wall-clamp concentration is excluded. */
  rootStressPa: number
  /** δ_tip, m. */
  tipDeflectionM: number
  /** m = ρ b [D a + d (L − a)], kg. */
  massKg: number
  /** Envelope (root) depth D, m. */
  envelopeDepthM: number
  /** M(a) = F (L − a), N·m. Absent for a uniform bar. */
  stepMomentNm?: number
  /** σ_step,nom = 6F(L − a)/(bd²) at the shoulder plane, Pa. Absent for a uniform bar. */
  stepNominalStressPa?: number
  /** h / r. Absent for a uniform bar. */
  heightToRadiusRatio?: number
  /** D / d. Absent for a uniform bar. */
  stepRatio?: number
  /** Kt fit branch used. Absent when Kt is absent. */
  ktBranch?: KtBranch
  /** Kt at the step. Absent for a uniform bar or outside the fit range. */
  ktStep?: number
  /** σ_step = Kt · σ_step,nom, Pa. Absent when Kt is absent. */
  stepPeakStressPa?: number
  /** σ_peak = max(σ_root, σ_step), Pa. Absent when the step has no defined Kt. */
  peakStressPa?: number
  /** Absent exactly when peakStressPa is absent. */
  peakLocation?: BracketPeakLocation
}

/** Analysis fields computed before the applicability check. */
export type BracketAnalysisBase = Omit<BracketAnalysis, 'applicable' | 'warnings' | 'notApplicableReasons'>

/** The subset of BracketAnalysisBase the applicability checker reads. */
export type BracketApplicabilityInput = Pick<BracketAnalysisBase, 'tipDeflectionM' | 'peakStressPa'>
