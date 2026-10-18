import type { BracketModelId } from '../../challenge/bracket/types'
import type { BracketApplicabilityCode } from './constants'

// Bracket analysis result types (task 55, model `boltedLBracket` v1; MM-03, MM-10). Independent
// of the beam `Analysis`, whose shape is frozen (D-39). Every numeric field is always present,
// finite and > 0, so v2 saves re-analyze key-for-key (MM-18).

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

export interface BracketAnalysis {
  modelId: BracketModelId
  modelVersion: 1
  /** True iff `notApplicableReasons` is empty, independent of `warnings`. */
  applicable: boolean
  /** Applicable but approaching model limits. */
  warnings: readonly BracketApplicabilityIssue[]
  notApplicableReasons: readonly BracketApplicabilityIssue[]
  /** Effects never modeled, always listed. */
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  /** M = P a at the bend, N·m. */
  bendMomentNm: number
  /** Straight-beam stress 6M/(w t²), Pa. */
  nominalBendStressPa: number
  /** Curved-beam factor σ_bend / σ_nominal (Roark's k_i), ≥ 1. */
  curvedBeamFactor: number
  /** Winkler–Bach inner-fibre stress at the bend, Pa. The checked stress. */
  bendStressPa: number
  /** R/c = 1 + 2 r_i / t. */
  bendRadiusRatio: number
  /** P a³/(3EI), m. */
  armDeflectionM: number
  /** P a² h_b/(3EI), m. */
  flangeRotationDeflectionM: number
  /** Vertical deflection at the load line, the sum of the two parts, m. */
  deflectionM: number
  /** h_b = H − e − r_o, m. */
  boltLeverArmM: number
  /** Tension per bolt P a / (n h_b), N. */
  boltTensionN: number
  massKg: number
}

/** Analysis fields computed before the applicability check. */
export type BracketAnalysisBase = Omit<BracketAnalysis, 'applicable' | 'warnings' | 'notApplicableReasons'>

/** The subset of BracketAnalysisBase the applicability checker reads. */
export type BracketApplicabilityInput = Pick<BracketAnalysisBase, 'bendStressPa' | 'bendRadiusRatio' | 'deflectionM' | 'boltLeverArmM'>
