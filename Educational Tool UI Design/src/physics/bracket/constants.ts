import type { ApplicabilityThreshold } from '../constants'

// Mounting Bracket I model constants (task 55, model `boltedLBracket` v1). These are constants of
// the model, never challenge configuration; any change after release requires a model version
// change (MM-04). The bracket applicability checker reads them only from this module. Thresholds
// are inclusive on the safe side: a metric equal to its threshold (within REL_TOL) produces no
// issue, as for the beam.

// ---------------------------------------------------------------------------
// Curved-beam (Winkler–Bach) inner-fibre stress at the bend, rectangular section:
//   r_o = r_i + t,  r_c = r_i + t/2,  r_n = t / ln(r_o / r_i),  e = r_c − r_n,
//   σ_inner = M (r_n − r_i) / (A e r_i),  A = w t.
// Sources: Budynas & Nisbett, Shigley's Mechanical Engineering Design, "Curved Beams in Bending"
// (the hyperbolic stress distribution and the rectangular-section neutral radius); Young &
// Budynas, Roark's Formulas for Stress and Strain, chapter 9 (curved beams) and Table 9.1, case 1
// (solid rectangle), which tabulates the inner-fibre factor k_i for R/c from 1.2 to 10.
// Edition, equation and table numbers are pending owner engineering review (29.2).

/**
 * The model applies the formula only for R/c ≥ 1.2 (R = r_c, c = t/2), the sharpest bend that
 * Roark's Table 9.1 tabulates for a rectangle. Equivalent to r_i ≥ 0.1 t. The screen metric is
 * CURVED_BEAM_MIN_R_OVER_C / (R/c), not applicable above 1.
 */
export const CURVED_BEAM_MIN_R_OVER_C = 1.2

/** Disclosure wherever the model limits are listed. No digits. */
export const BRACKET_SOURCE_NOTE =
  "bend stress from the Winkler–Bach curved-beam formula (Shigley; Roark's curved-beam table), used only inside the table's range; edition and equation numbers pending engineering review"

// ---------------------------------------------------------------------------
// Applicability screens.

export type BracketApplicabilityCode = 'CURVED_BEAM_RANGE' | 'PLASTICITY' | 'LARGE_DEFLECTION' | 'LEG_SPAN'

/** Fixed issue order. */
export const BRACKET_APPLICABILITY_CODES: readonly BracketApplicabilityCode[] = Object.freeze([
  'CURVED_BEAM_RANGE',
  'PLASTICITY',
  'LARGE_DEFLECTION',
  'LEG_SPAN',
] as const)

const t = (
  warning: number,
  notApplicable: number,
  metric: string,
  effect: string,
): ApplicabilityThreshold => Object.freeze({ warning, notApplicable, metric, effect })

/**
 * The four bracket screens. A screen with no warning band has warning = notApplicable, so only
 * the not-applicable level can fire.
 *   CURVED_BEAM_RANGE  The configured ranges keep R/c ≥ 1.2 (r_i ≥ 0.1 t), so this is defense in
 *                      depth.
 *   PLASTICITY         The shared beam convention (0.8 / 1.0 of yield).
 *   LARGE_DEFLECTION   The shared beam convention (0.02 / 0.1 of the span, here the load offset).
 *   LEG_SPAN           t / h_b for the flange between the heel and the bolt row. Timoshenko
 *                      shear deformation adds 3EI/(κGA h_b²) = E/(4κG)·(t/h_b)² ≈ 0.8 (t/h_b)²
 *                      to that span's end rotation (rectangle, κ = 5/6, ν = 0.33): about 3 % at
 *                      0.2 and 20 % at 0.5. The model neglects it. (For the arm, t/a ≤ 0.084
 *                      within the configured ranges, so the same correction stays below 0.6 %.)
 */
export const BRACKET_THRESHOLDS: Readonly<Record<BracketApplicabilityCode, ApplicabilityThreshold>> =
  Object.freeze({
    CURVED_BEAM_RANGE: t(1, 1, '1.2 / (R/c)', 'curved-beam stresses for bends sharper than the tabulated range'),
    PLASTICITY: t(0.8, 1.0, 'bend stress / yield stress', 'plasticity'),
    LARGE_DEFLECTION: t(0.02, 0.1, 'deflection / load offset', 'large deflection'),
    LEG_SPAN: t(0.2, 0.5, 'thickness / bolt lever arm', 'shear deformation of the short flange span'),
  })

/** Effects the model never accounts for, listed on every analysis. */
export const BRACKET_UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'bolt preload, joint compliance and T-stub prying amplification',
  'bolt shear, bearing and pull-through, and the wall anchors or wall itself',
  'bolt-hole stress concentrations',
  'fatigue and notch sensitivity',
  'local yielding and stress redistribution (screened only)',
  'shear deformation (screened only)',
  'wide-plate stiffening and point loads that do not span the width',
  'axial and shear stresses at the bend (small next to bending)',
  'self-weight, contact, residual and forming stresses',
  'out-of-plane loads and torsion',
])

/** Model assumptions listed on every analysis. */
export const BRACKET_ASSUMPTIONS: readonly string[] = Object.freeze([
  'linear elastic material, small deflections',
  'rectangular section of thickness t and width w; bending about the thin axis',
  'the load hangs from a pin spanning the arm width, so it acts uniformly across the width',
  'statics: the moment at the bend is the load times its offset from the wall face (an upper bound on the moment anywhere in the arm or flange)',
  'bend stress at the inner fibre from the Winkler–Bach curved-beam formula',
  'the bracket rotates about its heel, where the flange leaves the wall at the start of the bend; the bolt row resists the overturning moment',
  'the bolts in the row share the tension equally',
  'deflection: the arm is a cantilever from the wall face, plus the rotation of the flange span between the heel and the bolt row, simply supported there',
  'rigid wall',
  BRACKET_SOURCE_NOTE,
])
