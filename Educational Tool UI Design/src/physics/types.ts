import type { ApplicabilityCode } from './constants'

// Shared physics result types (design "Component: physics/").

export type ModelId = 'eulerBernoulliCantileverTipForce'

/** One applicability finding: which metric, why it matters, its value, and the threshold it exceeded. */
export interface ApplicabilityIssue {
  code: ApplicabilityCode
  /** Student-facing text naming the unmodeled effect and comparing value with threshold. */
  message: string
  /** Computed metric value (dimensionless ratio). */
  value: number
  /** The exceeded threshold: the warning threshold for warnings, the not-applicable one otherwise. */
  threshold: number
}

export interface Analysis {
  modelId: ModelId
  /** True iff `notApplicableReasons` is empty, independent of `warnings` (Req 10.8). */
  applicable: boolean
  /** Applicable but approaching model limits. */
  warnings: readonly ApplicabilityIssue[]
  notApplicableReasons: readonly ApplicabilityIssue[]
  /** Effects never modeled, always listed (Req 10.9). */
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  areaM2: number
  IxxM4: number
  IyyM4: number
  bendingInertiaM4: number
  extremeFiberM: number
  massKg: number
  tipDeflectionM: number
  maxMomentNm: number
  nominalMaxStressPa: number
}

/** Analysis fields computed before the applicability check. */
export type AnalysisBase = Omit<Analysis, 'applicable' | 'warnings' | 'notApplicableReasons'>

/** The subset of AnalysisBase the applicability checker reads. Any AnalysisBase satisfies it. */
export type ApplicabilityInput = Pick<AnalysisBase, 'tipDeflectionM' | 'nominalMaxStressPa'>
