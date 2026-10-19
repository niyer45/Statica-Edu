import type { AxialModelId } from '../../challenge/axial/types'
import type { AxialApplicabilityCode } from './constants'

// Stress and Strain I analysis result types (task 72; MM-03, MM-10). Independent of the beam
// `Analysis`, whose shape is frozen (D-39). Like the other new models, it stores `modelVersion`.

/** One applicability finding, shaped like the beam's ApplicabilityIssue with rod codes. */
export interface AxialApplicabilityIssue {
  code: AxialApplicabilityCode
  /** Student-facing text naming the unmodeled effect and comparing value with threshold. */
  message: string
  /** Computed metric value (dimensionless ratio). */
  value: number
  /** The exceeded threshold: the warning threshold for warnings, the not-applicable one otherwise. */
  threshold: number
}

export interface AxialAnalysis {
  modelId: AxialModelId
  modelVersion: 1
  /** True iff `notApplicableReasons` is empty, independent of `warnings`. */
  applicable: boolean
  warnings: readonly AxialApplicabilityIssue[]
  notApplicableReasons: readonly AxialApplicabilityIssue[]
  /** Effects never modeled, always listed (SSR-12). */
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  /** d, m. */
  diameterM: number
  /** A = π d² / 4, m². */
  areaM2: number
  /** E of the chosen material, Pa (copied from the challenge material). */
  elasticModulusPa: number
  /** σ_y of the chosen material, Pa (copied from the challenge material). */
  yieldStressPa: number
  /** σ = P / A, Pa. */
  stressPa: number
  /** ε = σ / E. */
  strain: number
  /** δ = P L / (A E), m. */
  elongationM: number
  /** k = E A / L, N/m. */
  axialStiffnessNPerM: number
  /** m = ρ A L, kg. */
  massKg: number
  /** σ / σ_y. */
  yieldRatio: number
}

/** Analysis fields computed before the applicability check. */
export type AxialAnalysisBase = Omit<AxialAnalysis, 'applicable' | 'warnings' | 'notApplicableReasons'>
