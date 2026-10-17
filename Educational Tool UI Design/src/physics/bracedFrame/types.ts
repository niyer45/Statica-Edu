import type { BracedFrameModelId } from '../../challenge/bracedFrame/types'
import type { FrameFreeJointId, FrameMemberId, FrameStorey, FrameSupportJointId, JointPoint } from '../../geometry/bracedFrame/template'
import type { BracedFrameApplicabilityCode } from './constants'

// Braced frame analysis result types (task 49.2; BFR-06, BFR-10–BFR-14, MM-03, MM-10).
// Independent of the beam `Analysis`, whose shape is frozen (D-39). Like torsion, the analysis
// stores `modelVersion`. A mechanism is an explicit status: its displacement, force, reaction,
// drift and utilization keys are ABSENT (never NaN, null, zero or a placeholder; OC-11, MM-10).

/** One applicability finding, shaped like the beam's ApplicabilityIssue with frame codes. */
export interface BracedFrameApplicabilityIssue {
  code: BracedFrameApplicabilityCode
  /** Student-facing text naming the unmodeled effect and comparing value with threshold. */
  message: string
  /**
   * Computed metric value. Screens: the dimensionless ratio. MECHANISM: the number of
   * independent mechanism modes found by the factorization (≥ 1).
   */
  value: number
  /** The exceeded threshold (warning or not-applicable); 0 allowed modes for MECHANISM. */
  threshold: number
}

/** Member force sense; `zero` means |N| ≤ 1e-9 · max|N| (BFR-14). */
export type MemberSense = 'tension' | 'compression' | 'zero'

/** Governing capacity mode (BFR-10). */
export type MemberCapacityMode = 'tensionYield' | 'compressionYield' | 'euler'

export interface BracedFrameMemberResult {
  /** Axial force, tension positive, N (never −0). */
  forceN: number
  sense: MemberSense
  /** P_t = A f_y for tension or ≈ 0; P_c = min(A f_y, π²EI/L²) for compression, N. */
  capacityN: number
  mode: MemberCapacityMode
  /** |N| / capacity (nominal, no resistance factors). */
  utilization: number
  /** λ = L / r. */
  slenderness: number
}

/** Fields stored for every analysis, solved or mechanism. */
export interface BracedFrameAnalysisCommon {
  modelId: BracedFrameModelId
  modelVersion: 1
  /** True iff `notApplicableReasons` is empty, independent of `warnings`. */
  applicable: boolean
  /** Applicable but approaching model limits. */
  warnings: readonly BracedFrameApplicabilityIssue[]
  notApplicableReasons: readonly BracedFrameApplicabilityIssue[]
  /** Effects never modeled, always listed (BFR-13). */
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
  /** m = ρ Σ A L over present members only, kg. */
  massKg: number
  /**
   * Storeys with no present diagonal: a topological display fact (BFR-06), never used to decide
   * the status, which is detected numerically only (BFR-11).
   */
  unbracedStoreys: readonly FrameStorey[]
}

export interface BracedFrameSolvedAnalysis extends BracedFrameAnalysisCommon {
  status: 'solved'
  /** Free-joint displacements, m. */
  displacementsM: Readonly<Record<FrameFreeJointId, Readonly<JointPoint>>>
  /** Present members only, keyed by id. */
  members: Readonly<Partial<Record<FrameMemberId, Readonly<BracedFrameMemberResult>>>>
  /** Support reactions R = K u − P, N. */
  reactionsN: Readonly<Record<FrameSupportJointId, Readonly<JointPoint>>>
  /** δ_1 = (u_j3x + u_j4x) / 2, m. */
  floorDriftM: number
  /** δ_roof = (u_j5x + u_j6x) / 2 (signed), m. */
  roofDriftM: number
  /** θ_1 = δ_1 / h and θ_2 = (δ_roof − δ_1) / h. */
  storeyDriftRatios: readonly [number, number]
  /** max(|θ_1|, |θ_2|). */
  maxStoreyDriftRatio: number
  /** Largest member utilization. */
  maxUtilization: number
  /** First member (fixed order) with the largest utilization. */
  governingMemberId: FrameMemberId
  /**
   * max |N| / N_J over compression members with λ < λ_c (Johnson screen). Absent when no
   * member qualifies, never zero.
   */
  maxInelasticRatio?: number
}

export interface BracedFrameMechanismAnalysis extends BracedFrameAnalysisCommon {
  status: 'mechanism'
}

export type BracedFrameAnalysis = BracedFrameSolvedAnalysis | BracedFrameMechanismAnalysis
