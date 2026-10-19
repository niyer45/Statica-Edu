import type { ColumnSupport } from '../../challenge/column/types'
import type { ApplicabilityThreshold } from '../constants'

// Column Buckling I model constants (task 68, model `eulerColumnBuckling` v1). These are constants
// of the model, never challenge configuration; any change after release requires a model version
// change (MM-04). The applicability checker reads them only from this module. Thresholds are
// inclusive on the safe side: a metric equal to its threshold (within REL_TOL) produces no issue.

/**
 * Effective-length factor K per end condition: the theoretical value for ideal pins at both ends.
 * Version 1 offers only pinned–pinned, so no design or configuration can choose another K.
 */
export const EFFECTIVE_LENGTH_FACTORS: Readonly<Record<ColumnSupport, number>> = Object.freeze({ pinnedPinned: 1 })

/** Disclosure wherever the model limits are listed. No digits. */
export const COLUMN_SOURCE_NOTE =
  'Euler critical load for a pinned–pinned column and the Euler–Johnson transition slenderness (Shigley; Gere and Timoshenko; Hibbeler); edition and equation numbers pending engineering review'

// ---------------------------------------------------------------------------
// Applicability screens.

export type ColumnApplicabilityCode = 'EULER_RANGE' | 'WALL_SLENDERNESS'

/** Fixed issue order. */
export const COLUMN_APPLICABILITY_CODES: readonly ColumnApplicabilityCode[] = Object.freeze(['EULER_RANGE', 'WALL_SLENDERNESS'] as const)

const t = (warning: number, notApplicable: number, metric: string, effect: string): ApplicabilityThreshold =>
  Object.freeze({ warning, notApplicable, metric, effect })

/**
 * The two column screens.
 *   EULER_RANGE       σ_E/σ_y with σ_E = P_cr/A = π²E/λ². Not applicable above 0.5, the Johnson
 *                     transition (slenderness below √(2π²E/σ_y)): an intermediate column buckles
 *                     inelastically and the Euler load is unconservative. Caution above 0.4, 80 %
 *                     of the limit, as for the shared plasticity screens.
 *   WALL_SLENDERNESS  D/t (a solid bar counts as wall = radius, so 2). The 40 / 100 convention of
 *                     the beam and torsion tube screens, conservative for local (shell) buckling;
 *                     the configured ranges cap D/t at 80, so the limit is defense in depth.
 */
export const COLUMN_THRESHOLDS: Readonly<Record<ColumnApplicabilityCode, ApplicabilityThreshold>> = Object.freeze({
  EULER_RANGE: t(0.4, 0.5, 'Euler stress / yield stress', 'inelastic (Johnson) buckling of intermediate columns'),
  WALL_SLENDERNESS: t(40, 100, 'D / t_wall', 'local (shell) buckling of the tube wall'),
})

/** Effects the model never accounts for, listed on every analysis. */
export const COLUMN_UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'initial crookedness, load eccentricity and residual stresses (real columns buckle below the Euler load; the safety factor stands in for them)',
  'inelastic (Johnson) buckling of intermediate columns (screened only)',
  'local buckling of thin tube walls (screened only)',
  'end conditions other than ideal pins, and the connection details',
  'self-weight, lateral loads and combined bending',
  'shear deformation',
  'post-buckling behaviour, dynamic loads, fatigue and temperature',
])

/** Model assumptions listed on every analysis. */
export const COLUMN_ASSUMPTIONS: readonly string[] = Object.freeze([
  'straight, prismatic, homogeneous column of linear elastic material',
  'the load acts along the column axis, through the centroid',
  'ideal pins at both ends: free to rotate, held against sideways movement (effective-length factor 1)',
  'small-deflection (bifurcation) buckling; a round section has the same stiffness about every axis',
  'axial stress spread evenly over the cross-section',
  COLUMN_SOURCE_NOTE,
])
