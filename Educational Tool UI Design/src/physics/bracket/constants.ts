import type { ApplicabilityThreshold } from '../constants'

// Mounting Bracket I model constants (task 46.2; mounting-bracket-1 MBR-13–MBR-15, design.md
// "Stress-concentration factor: transcription record", owner decisions D-40/D-41 K-1–K-5).
// These are constants of `steppedBarBracket` v1, never challenge configuration (MBR-13); any
// change after release requires a model version change (MM-04). The bracket applicability
// checker and the Kt fit read them only from this module. Thresholds are inclusive on the safe
// side: a metric equal to its threshold (within REL_TOL) produces no issue, as for the beam.

// ---------------------------------------------------------------------------
// Shoulder-fillet stress-concentration fit (stepped flat bar, opposite shoulder fillets,
// in-plane bending), transcribed exactly as written in design.md (K-1, D-41):
//   σ_nom = 6M/(t d²),  Kt = C1 + C2(2h/D) + C3(2h/D)² + C4(2h/D)³,
//   Ci = αi + βi√(h/r) + γi(h/r),  h = (D − d)/2.
// Source: Roark's Formulas for Stress and Strain, Table 6-1, case III.1b (Pilkey's fits to
// Peterson's charts), cross-checked against the AmesWeb copy (Pilkey 2005). Both are secondary
// copies; printed-edition verification is owner QA before customer release (29.2).

/** One coefficient Ci = alpha + beta·√(h/r) + gamma·(h/r). */
export interface KtCoefficient {
  readonly alpha: number
  readonly beta: number
  readonly gamma: number
}

/** C1–C4 of one h/r branch. */
export type KtBranchCoefficients = readonly [KtCoefficient, KtCoefficient, KtCoefficient, KtCoefficient]

const c = (alpha: number, beta: number, gamma: number): KtCoefficient => Object.freeze({ alpha, beta, gamma })

/** 0.1 ≤ h/r ≤ 2.0. */
export const KT_LOWER_BRANCH: KtBranchCoefficients = Object.freeze([
  c(1.006, 0.967, 0.013),
  c(-0.270, -2.372, 0.708),
  c(0.662, 1.157, -0.908),
  c(-0.405, 0.249, -0.200),
] as const)

/** 2.0 ≤ h/r ≤ 20.0. */
export const KT_UPPER_BRANCH: KtBranchCoefficients = Object.freeze([
  c(1.058, 1.002, -0.038),
  c(-3.652, 1.639, -0.436),
  c(6.170, -5.687, 1.175),
  c(-2.558, 3.046, -0.701),
] as const)

/**
 * Fit validity range 0.1 ≤ h/r ≤ 20, inclusive within REL_TOL; outside it Kt is undefined
 * (MBR-13). The lower limit is applied as r/h ≤ 10, the KT_FIT_SHALLOW screen metric, so the fit
 * and the screens always agree on the same computed values.
 */
export const KT_H_OVER_R_MAX = 20
export const KT_R_OVER_H_MAX = 10

/**
 * Branch rule (model choice, K-3): both printed ranges include h/r = 2; the lower branch applies
 * for h/r ≤ 2 within REL_TOL, so rounding such as 1.9999999999999996 cannot flip the branch.
 */
export const KT_BRANCH_H_OVER_R = 2

/**
 * Validity condition printed with the fit, applied with the step location a in place of the
 * source's shoulder length L (K-2, conservative): a/D ≥ intercept − slope·(r/d − rOverDOffset).
 * The screen metric is [intercept − slope·(r/d − rOverDOffset)] / (a/D), not applicable above 1.
 */
export const KT_SHOULDER_CONDITION = Object.freeze({ intercept: 2.0, slope: 2.05, rOverDOffset: 0.025 })

/** With a step, D/d must be at least this (K-4); the screen metric is this / (D/d). */
export const KT_SMALL_STEP_MIN_RATIO = 1.1

/** Disclosure required by MBR-20/D-41 wherever the model limits are listed. No digits. */
export const BRACKET_KT_SOURCE_NOTE =
  "shoulder-fillet Kt coefficients transcribed from secondary copies of Peterson's charts as fitted in Roark's formulas, pending printed-edition verification"

// ---------------------------------------------------------------------------
// Applicability screens (MBR-14).

export type BracketApplicabilityCode =
  | 'KT_FIT_SHARP'
  | 'KT_FIT_SHALLOW'
  | 'KT_SHOULDER_LENGTH'
  | 'KT_STEP_RATIO'
  | 'KT_SMALL_STEP'
  | 'PLASTICITY'
  | 'DEPTH_SPAN'
  | 'RECT_ASPECT'
  | 'LARGE_DEFLECTION'

/** Fixed issue order (MBR-14 table order). */
export const BRACKET_APPLICABILITY_CODES: readonly BracketApplicabilityCode[] = Object.freeze([
  'KT_FIT_SHARP',
  'KT_FIT_SHALLOW',
  'KT_SHOULDER_LENGTH',
  'KT_STEP_RATIO',
  'KT_SMALL_STEP',
  'PLASTICITY',
  'DEPTH_SPAN',
  'RECT_ASPECT',
  'LARGE_DEFLECTION',
] as const)

/** Screens evaluated only when the bar has a step; skipped for a uniform bar (MBR-14). */
export const BRACKET_STEP_CODES: readonly BracketApplicabilityCode[] = Object.freeze([
  'KT_FIT_SHARP',
  'KT_FIT_SHALLOW',
  'KT_SHOULDER_LENGTH',
  'KT_STEP_RATIO',
  'KT_SMALL_STEP',
] as const)

const t = (
  warning: number,
  notApplicable: number,
  metric: string,
  effect: string,
): ApplicabilityThreshold => Object.freeze({ warning, notApplicable, metric, effect })

/**
 * The nine bracket screens. A screen with no warning band has warning = notApplicable, so only
 * the not-applicable level can fire (MBR-14).
 */
export const BRACKET_THRESHOLDS: Readonly<Record<BracketApplicabilityCode, ApplicabilityThreshold>> =
  Object.freeze({
    KT_FIT_SHARP: t(KT_H_OVER_R_MAX, KT_H_OVER_R_MAX, 'h / r', 'stress concentration for fillets sharper than the curve fit covers'),
    KT_FIT_SHALLOW: t(KT_R_OVER_H_MAX, KT_R_OVER_H_MAX, 'r / h', 'stress concentration for shoulders shallower than the curve fit covers'),
    KT_SHOULDER_LENGTH: t(1, 1, '[2.0 − 2.05(r/d − 0.025)] / (a/D)', 'interaction between the wall clamp and the fillet stress field'),
    // Fit-reliability limit, not stated by the source; owner-approved (K-3).
    KT_STEP_RATIO: t(1.5, 1.6, 'D / d', 'reliable stress concentration for steps this large'),
    // Owner decision K-4: the fit under-predicts the chart for small steps.
    KT_SMALL_STEP: t(1, 1, '1.1 / (D/d)', 'reliable stress concentration for steps this small'),
    PLASTICITY: t(0.8, 1.0, 'peak stress / yield stress', 'plasticity'),
    DEPTH_SPAN: t(0.1, 0.2, 'D / L', 'shear deformation'),
    // The configured ranges cap D/b at 5, so this is defense in depth.
    RECT_ASPECT: t(8, 20, 'D / b', 'lateral-torsional buckling'),
    LARGE_DEFLECTION: t(0.02, 0.1, 'tip deflection / L', 'large deflection'),
  })

/** Effects the model never accounts for, listed on every analysis (MBR-15). */
export const BRACKET_UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'wall-clamp and bolt-hole stress concentrations',
  'fastener and joint compliance',
  'fatigue and notch sensitivity (Kt is the theoretical elastic factor; no Kf)',
  'local yielding and stress redistribution (screened only)',
  '3D and out-of-plane loading, and torsion',
  'lateral-torsional buckling (screened only)',
  'shear deformation (screened only)',
  'fillet–wall interaction (screened only)',
  "the fillet's stiffness and mass (neglected)",
  'one-sided steps',
  'contact, self-weight, residual and manufacturing stresses',
])

/** Model assumptions listed on every analysis (design.md "Model steppedBarBracket v1"). */
export const BRACKET_ASSUMPTIONS: readonly string[] = Object.freeze([
  'linear elastic material',
  'small deflection (Euler–Bernoulli bending)',
  'planar bending of a rectangular section, thickness out of plane',
  'rigid wall clamp at the root',
  'static tip force at the free end',
  'symmetric step with opposite shoulder fillets',
  'step nominal stress taken at the shoulder plane (conservative)',
  'Kt is a local elastic peak at the fillet; it does not change the moment, the deflection or the root stress',
  BRACKET_KT_SOURCE_NOTE,
])
