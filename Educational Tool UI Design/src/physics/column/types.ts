import type { ColumnModelId } from '../../challenge/column/types'
import type { ColumnApplicabilityCode } from './constants'

// Column analysis result types (task 68, model `eulerColumnBuckling` v1; MM-03, MM-10). Independent
// of the beam `Analysis`, whose shape is frozen (D-39). Every numeric field is always present,
// finite and > 0, so v2 saves re-analyze key-for-key (MM-18).

/** One applicability finding, shaped like the beam's ApplicabilityIssue with column codes. */
export interface ColumnApplicabilityIssue {
  code: ColumnApplicabilityCode
  /** Student-facing text naming the unmodeled effect and comparing value with threshold. */
  message: string
  /** Computed metric value (dimensionless ratio). */
  value: number
  /** The exceeded threshold: the warning threshold for warnings, the not-applicable one otherwise. */
  threshold: number
}

export interface ColumnAnalysis {
  modelId: ColumnModelId
  modelVersion: 1
  /** True iff `notApplicableReasons` is empty, independent of `warnings`. */
  applicable: boolean
  /** Applicable but approaching model limits. */
  warnings: readonly ColumnApplicabilityIssue[]
  notApplicableReasons: readonly ColumnApplicabilityIssue[]
  /** Effects never modeled, always listed. */
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  /** Outer diameter D, m. */
  outerDiameterM: number
  /** A, m². */
  areaM2: number
  /** I (same about every diameter), m⁴. */
  secondMomentM4: number
  /** r = √(I/A), m. */
  radiusOfGyrationM: number
  /** K L, m. */
  effectiveLengthM: number
  /** λ = K L / r. */
  slenderness: number
  /** λ_c = √(2π²E/σ_y), below which the column is intermediate (Johnson). */
  transitionSlenderness: number
  /** P_cr = π²EI/(KL)², N. The checked value. */
  criticalLoadN: number
  /** P_cr / P. */
  bucklingSafetyFactor: number
  /** σ_E = P_cr / A, Pa. */
  eulerStressPa: number
  /** σ = P / A, Pa. */
  axialStressPa: number
  /** m = ρ A L, kg. */
  massKg: number
  /** P_cr / m, N/kg (comparison only: how much buckling resistance each kilogram buys). */
  criticalLoadPerMassNPerKg: number
  /** D / t; a solid bar counts as wall = radius, so 2. */
  diameterToWall: number
}

/** Analysis fields computed before the applicability check. */
export type ColumnAnalysisBase = Omit<ColumnAnalysis, 'applicable' | 'warnings' | 'notApplicableReasons'>

/** The subset of ColumnAnalysisBase the applicability checker reads. */
export type ColumnApplicabilityInput = Pick<ColumnAnalysisBase, 'eulerStressPa' | 'diameterToWall'>
