import type { ApplicabilityThreshold } from '../constants'

// Torsion Shaft I applicability thresholds and model metadata (task 47.2; torsion-shaft-1
// TSH-10–TSH-12). The torsion applicability checker reads thresholds only from this module.
// Thresholds are inclusive on the safe side: a metric equal to its threshold (within REL_TOL)
// produces no issue, exactly as for the beam (physics/constants.ts, unchanged).
//
// Not screened, by design (TSH-11): surface shear strain is subsumed by PLASTICITY_SHEAR
// (γ = τ/G ≤ τ_yield/G in the elastic range), and Saint-Venant end effects need no screen
// because length is locked at L/D ≥ 13.3.

export type TorsionApplicabilityCode = 'PLASTICITY_SHEAR' | 'TUBE_SLENDERNESS'

/** Fixed issue order. */
export const TORSION_APPLICABILITY_CODES: readonly TorsionApplicabilityCode[] = Object.freeze([
  'PLASTICITY_SHEAR',
  'TUBE_SLENDERNESS',
] as const)

const t = (
  warning: number,
  notApplicable: number,
  metric: string,
  effect: string,
): ApplicabilityThreshold => Object.freeze({ warning, notApplicable, metric, effect })

/** The four torsion thresholds (2 warning, 2 not-applicable). */
export const TORSION_THRESHOLDS: Readonly<Record<TorsionApplicabilityCode, ApplicabilityThreshold>> =
  Object.freeze({
    PLASTICITY_SHEAR: t(0.8, 1.0, 'maximum shear stress / yield shear stress', 'plasticity'),
    // Mirrors the beam tube screen; the configured ranges cap D/t at 30 (defense in depth).
    TUBE_SLENDERNESS: t(40, 100, 'D / t_wall', 'torsional buckling of thin tubes'),
  })

/** Effects the model never accounts for, listed on every analysis (TSH-12). */
export const TORSION_UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'rotating dynamics and critical speed',
  'fatigue',
  'combined bending or axial load',
  'stress concentrations at keyways, shoulders and fixtures',
  'end-fitting compliance',
  'torsional buckling of thin tubes (screened only)',
  'plasticity (screened only)',
  'self-weight bending',
])

/** Model assumptions listed on every analysis (design "Model circularShaftTorsion v1"). */
export const TORSION_ASSUMPTIONS: readonly string[] = Object.freeze([
  'linear elastic material',
  'small angle of twist',
  'straight prismatic circular shaft',
  'plane circular cross-sections remain plane (Saint-Venant torsion)',
  'one end fixed rigidly against rotation',
  'steady torque applied at the free end',
  'isotropic homogeneous material',
  'shear stress linear in radius',
])
