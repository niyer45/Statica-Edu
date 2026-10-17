import type { ApplicabilityThreshold } from '../constants'

// Braced Frame I solver tolerances, applicability thresholds and model metadata (task 49.2;
// braced-frame-1 BFR-11–BFR-14). The braced-frame analysis reads tolerances and thresholds only
// from this module. Screen thresholds are inclusive on the safe side: a metric equal to its
// threshold (within REL_TOL) produces no issue, exactly as for the beam and torsion models.
//
// The solver tolerances are model constants rather than config fields: they define what the model
// calls a mechanism, so changing them is a model version change (MM-04), not a challenge edit.
// Measured separation over every catalog design (design.md): largest |pivot ratio| in a mechanism
// 8.4e-16, smallest in a stable design 1.52e-2, so τ_p = 1e-9 sits decades away from both.

export const BRACED_FRAME_SOLVER_TOLERANCES = Object.freeze({
  /** τ_p: a pivot ≤ τ_p · max diag(K_ff) means a mechanism (BFR-11). */
  pivotRelTol: 1e-9,
  /** τ_r: ‖K_ff u − P_f‖₂ / ‖P_f‖₂ above this means a mechanism (BFR-11). */
  residualRelTol: 1e-9,
  /** |N| ≤ this × max|N| is classified ≈ 0 (BFR-14). */
  zeroForceRelTol: 1e-9,
})

export type BracedFrameApplicabilityCode = 'MECHANISM' | 'INELASTIC_BUCKLING' | 'LARGE_DRIFT'

/** Fixed issue order. MECHANISM appears alone: the screens need a solved frame. */
export const BRACED_FRAME_APPLICABILITY_CODES: readonly BracedFrameApplicabilityCode[] = Object.freeze([
  'MECHANISM',
  'INELASTIC_BUCKLING',
  'LARGE_DRIFT',
] as const)

/** The screened codes (each with a warning and a not-applicable threshold). */
export type BracedFrameScreenCode = Exclude<BracedFrameApplicabilityCode, 'MECHANISM'>

const t = (
  warning: number,
  notApplicable: number,
  metric: string,
  effect: string,
): ApplicabilityThreshold => Object.freeze({ warning, notApplicable, metric, effect })

/** The four screen thresholds (2 warning, 2 not-applicable), BFR-12. */
export const BRACED_FRAME_THRESHOLDS: Readonly<Record<BracedFrameScreenCode, ApplicabilityThreshold>> = Object.freeze({
  // Johnson parabola N_J = A f_y [1 − f_y λ²/(4π²E)] for compression members with λ < λ_c; a screen
  // only, never a capacity. In this catalog only CHS76.1x4.0 and CHS88.9x5.0 at 3 m qualify.
  INELASTIC_BUCKLING: t(0.8, 1.0, 'max |N| / N_J for compression members with L/r < λ_c', 'inelastic buckling of stocky members'),
  // Defense in depth: the largest storey drift ratio of any stable catalog design is 0.00339.
  LARGE_DRIFT: t(0.01, 0.02, 'maximum inter-storey drift ratio', 'large displacements and second-order (P-Δ) effects'),
})

/** Assumptions listed on every analysis (BFR-13). */
export const BRACED_FRAME_ASSUMPTIONS: readonly string[] = Object.freeze([
  'pin joints: every joint is a hinge, so members carry only tension or compression',
  'loads applied at joints only',
  'linear elastic material',
  'small displacements (equilibrium on the undeformed geometry)',
  'straight prismatic members',
  'rigid pinned supports that resist uplift',
  'crossing diagonals are not connected at the crossing',
  'in-plane behavior with out-of-plane restraint at the joints',
  'pinned-end buckling over the full member length (K = 1)',
  'forces beyond capacity are nominal elastic values (no yielding or post-buckling redistribution)',
  'no self-weight',
])

/** Effects the model never accounts for, listed on every analysis (BFR-13). */
export const BRACED_FRAME_UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'rigid or semi-rigid joints and frame bending action',
  'P-Δ and other second-order effects (screened only)',
  'tension-only bracing and post-buckling redistribution',
  'load reversal and other load cases (only one load direction is analyzed)',
  'connection design, eccentricity and bolt or weld capacity',
  'member imperfections and residual stresses (inelastic buckling is screened only)',
  'out-of-plane and flexural-torsional buckling',
  'local buckling of the tube walls',
  'dynamic, wind-gust and seismic response',
  'self-weight',
  'foundation flexibility and support settlement',
])
