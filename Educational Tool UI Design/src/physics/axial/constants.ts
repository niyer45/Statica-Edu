import type { ApplicabilityThreshold } from '../constants'

// Stress and Strain I applicability threshold and model metadata (task 72; stress-strain-1
// SSR-10–SSR-12). The applicability checker reads thresholds only from this module. Thresholds are
// inclusive on the safe side: a metric equal to its threshold (within REL_TOL) produces no issue,
// exactly as for the other models.
//
// Not screened, by design (SSR-11): Saint-Venant end effects (the loader requires L ≥ 10 d_max)
// and buckling (the load is tension only).

export type AxialApplicabilityCode = 'PLASTICITY'

/** Fixed issue order. */
export const AXIAL_APPLICABILITY_CODES: readonly AxialApplicabilityCode[] = Object.freeze(['PLASTICITY'] as const)

/** The rod threshold: σ / σ_y, warning above 0.8, not applicable above 1 (yield). */
export const AXIAL_THRESHOLDS: Readonly<Record<AxialApplicabilityCode, ApplicabilityThreshold>> = Object.freeze({
  PLASTICITY: Object.freeze({
    warning: 0.8,
    notApplicable: 1.0,
    metric: 'axial stress / yield strength',
    effect: 'yielding, necking or plastic flow',
  }),
})

/** Effects the model never accounts for, listed on every analysis (SSR-12). */
export const AXIAL_UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'yielding, necking and plastic flow (screened only)',
  'stress concentrations at threads, holes and end fittings',
  'bending from an off-centre load or a bent rod',
  'compression and buckling',
  'fatigue and dynamic or impact loads',
  'creep and temperature changes',
  'self-weight of the rod',
  'compliance of the end fittings and supports',
  'corrosion',
])

/** Model assumptions listed on every analysis (design "Model axialTieRod v1"). */
export const AXIAL_ASSUMPTIONS: readonly string[] = Object.freeze([
  'linear elastic, isotropic, homogeneous material',
  'straight prismatic solid round rod',
  'static tensile load through the centroid (pure axial tension)',
  'uniform stress over the cross-section away from the ends',
  'small strains',
  'rod pinned to rigid supports at both ends',
  'material properties are typical textbook values',
])
