import type { TorsionModelId } from '../../challenge/torsion/types'
import type { TorsionApplicabilityCode } from './constants'

// Torsion analysis result types (task 47.2; MM-03, MM-10). Independent of the beam `Analysis`,
// whose shape is frozen (D-39). Unlike the beam, a torsion analysis stores `modelVersion`.

/** One applicability finding, shaped like the beam's ApplicabilityIssue with torsion codes. */
export interface TorsionApplicabilityIssue {
  code: TorsionApplicabilityCode
  /** Student-facing text naming the unmodeled effect and comparing value with threshold. */
  message: string
  /** Computed metric value (dimensionless ratio). */
  value: number
  /** The exceeded threshold: the warning threshold for warnings, the not-applicable one otherwise. */
  threshold: number
}

export interface TorsionAnalysis {
  modelId: TorsionModelId
  modelVersion: 1
  /** True iff `notApplicableReasons` is empty, independent of `warnings`. */
  applicable: boolean
  /** Applicable but approaching model limits. */
  warnings: readonly TorsionApplicabilityIssue[]
  notApplicableReasons: readonly TorsionApplicabilityIssue[]
  /** Effects never modeled, always listed (TSH-12). */
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  /** A = π(D² − d²)/4, m². */
  areaM2: number
  /** J = π(D⁴ − d⁴)/32, m⁴. */
  polarMomentM4: number
  /** D (the diameter for a solid shaft), m. */
  outerDiameterM: number
  /** m = ρ A L, kg. */
  massKg: number
  /** φ = T L / (G J), rad. */
  twistRad: number
  /** τ_max = T (D/2) / J, Pa. */
  maxShearStressPa: number
  /** k_t = G J / L, N·m/rad. */
  torsionalStiffnessNmPerRad: number
}

/** Analysis fields computed before the applicability check. */
export type TorsionAnalysisBase = Omit<TorsionAnalysis, 'applicable' | 'warnings' | 'notApplicableReasons'>

/** The subset of TorsionAnalysisBase the applicability checker reads. */
export type TorsionApplicabilityInput = Pick<TorsionAnalysisBase, 'maxShearStressPa'>
