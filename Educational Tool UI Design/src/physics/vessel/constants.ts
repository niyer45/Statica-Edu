import type { ApplicabilityThreshold } from '../constants'

// Pressure Vessel I model constants (task 69, model `thinWallPressureVessel` v1;
// .kiro/specs/pressure-vessel-1 PVS-10, PVS-11). Constants of the model, never challenge
// configuration; any change after release requires a model version change (MM-04). The vessel
// applicability checker reads them only from this module. Thresholds are inclusive on the safe
// side: a metric equal to its threshold (within REL_TOL) produces no issue.
//
// Thin-wall (membrane) theory for a closed cylinder with hemispherical heads under internal
// pressure, stresses from the inner radius. Sources (edition and equation numbers pending
// engineering review): Hibbeler, Mechanics of Materials (thin-walled pressure vessels and the
// r/t ≥ 10 rule); Gere & Goodno, Mechanics of Materials (spherical and cylindrical pressure
// vessels); Budynas & Nisbett, Shigley's Mechanical Engineering Design (thick-walled cylinders,
// used to size the screens); Timoshenko & Woinowsky-Krieger, Theory of Plates and Shells
// (membrane theory and head-shell discontinuity stresses, which are not modeled).

/** Disclosure wherever the model limits are listed. No digits. */
export const VESSEL_SOURCE_NOTE =
  'thin-wall membrane stresses for a closed cylinder with hemispherical heads (Hibbeler; Gere & Goodno), screened against the thick-wall solution (Shigley); edition and equation numbers pending engineering review'

export type VesselApplicabilityCode = 'THIN_WALL_SHELL' | 'THIN_WALL_HEAD' | 'PLASTICITY'

/** Fixed issue order. */
export const VESSEL_APPLICABILITY_CODES: readonly VesselApplicabilityCode[] = Object.freeze([
  'THIN_WALL_SHELL',
  'THIN_WALL_HEAD',
  'PLASTICITY',
] as const)

const t = (
  warning: number,
  notApplicable: number,
  metric: string,
  effect: string,
): ApplicabilityThreshold => Object.freeze({ warning, notApplicable, metric, effect })

/**
 * The three vessel screens.
 *   THIN_WALL_SHELL  t_s / r. The thin-wall rule r/t ≥ 10 is the not-applicable level (0.1); the
 *                    thick-wall (Lamé) peak hoop stress exceeds p r / t by about t/(2r): 2.6 % at
 *                    the warning level 0.05 (r/t = 20) and 5.2 % at 0.1.
 *   THIN_WALL_HEAD   t_h / r, the same rule for the heads (the sphere's error is smaller: 0.16 %
 *                    and 0.63 % at the two levels).
 *   PLASTICITY       Largest membrane stress (hoop or head) / yield, the shared 0.8 / 1.0
 *                    convention of the other models.
 */
export const VESSEL_THRESHOLDS: Readonly<Record<VesselApplicabilityCode, ApplicabilityThreshold>> =
  Object.freeze({
    THIN_WALL_SHELL: t(0.05, 0.1, 'shell thickness / inner radius', 'through-thickness stress variation in a thick shell wall (the thin-wall rule needs r/t of at least 10)'),
    THIN_WALL_HEAD: t(0.05, 0.1, 'head thickness / inner radius', 'through-thickness stress variation in a thick head wall (the thin-wall rule needs r/t of at least 10)'),
    PLASTICITY: t(0.8, 1.0, 'largest membrane stress / yield stress', 'plasticity'),
  })

/** Effects the model never accounts for, listed on every analysis. */
export const VESSEL_UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'discontinuity (bending) stresses where the heads meet the shell, and the transition between unequal walls',
  'radial stress through the wall (thin-wall membrane theory)',
  'weld joint efficiency, corrosion allowance and manufacturing tolerances',
  'openings, nozzles and their reinforcement',
  'external pressure and buckling',
  'cyclic pressure and fatigue',
  'thermal stresses',
  'supports, saddles, self-weight and the weight of the contents',
  'brittle fracture and material toughness',
  'pressure-vessel code rules (this is not a code calculation)',
  'thick walls and local yielding (screened only)',
])

/** Model assumptions listed on every analysis. */
export const VESSEL_ASSUMPTIONS: readonly string[] = Object.freeze([
  'linear elastic material, small deformations',
  'a closed cylindrical shell with two hemispherical heads of the same inner radius',
  'uniform internal gauge pressure; the outside is at zero gauge pressure',
  'thin-wall membrane stresses, uniform through the wall and computed from the inner radius',
  'hoop stress from equilibrium of half a ring, longitudinal stress from equilibrium of the closed ends, head stress from equilibrium of half a sphere',
  'each membrane stress is compared with the allowable stress, the yield stress divided by the design factor',
  'volume and mass from the exact cylinder and hemisphere solids; welds, nozzles and supports excluded',
  VESSEL_SOURCE_NOTE,
])
