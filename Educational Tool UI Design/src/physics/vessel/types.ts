import type { VesselModelId } from '../../challenge/vessel/types'
import type { VesselApplicabilityCode } from './constants'

// Pressure vessel analysis result types (task 69, model `thinWallPressureVessel` v1; MM-03,
// MM-10). Independent of the beam `Analysis`, whose shape is frozen (D-39). Every numeric field
// is always present, finite and > 0, so v2 saves re-analyze key-for-key (MM-18).

/** One applicability finding, shaped like the beam's ApplicabilityIssue with vessel codes. */
export interface VesselApplicabilityIssue {
  code: VesselApplicabilityCode
  /** Student-facing text naming the unmodeled effect and comparing value with threshold. */
  message: string
  /** Computed metric value (dimensionless ratio). */
  value: number
  /** The exceeded threshold: the warning threshold for warnings, the not-applicable one otherwise. */
  threshold: number
}

export interface VesselAnalysis {
  modelId: VesselModelId
  modelVersion: 1
  /** True iff `notApplicableReasons` is empty, independent of `warnings`. */
  applicable: boolean
  /** Applicable but approaching model limits. */
  warnings: readonly VesselApplicabilityIssue[]
  notApplicableReasons: readonly VesselApplicabilityIssue[]
  /** Effects never modeled, always listed. */
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  /** Inner radius r = D_i / 2, m. */
  innerRadiusM: number
  /** σ_h = p r / t_s, Pa. */
  hoopStressPa: number
  /** σ_l = p r / (2 t_s), Pa. */
  longitudinalStressPa: number
  /** p r / (2 t_h), Pa. */
  headStressPa: number
  /** Allowable membrane stress σ_y / n, Pa (stored so results never recompute it). */
  allowableStressPa: number
  /** π r² L + (4/3) π r³, m³. */
  volumeM3: number
  /** L + 2 (r + t_h), m. */
  overallLengthM: number
  shellMassKg: number
  headsMassKg: number
  /** Shell plus heads, kg. */
  massKg: number
  /** r / t_s (display; the screen reads t_s / r). */
  shellRadiusRatio: number
  /** r / t_h (display). */
  headRadiusRatio: number
}

/** Analysis fields computed before the applicability check. */
export type VesselAnalysisBase = Omit<VesselAnalysis, 'applicable' | 'warnings' | 'notApplicableReasons'>

/** The subset of VesselAnalysisBase the applicability checker reads. */
export type VesselApplicabilityInput = Pick<VesselAnalysisBase, 'innerRadiusM' | 'hoopStressPa' | 'headStressPa'>
