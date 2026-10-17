import type { TorsionSection } from '../../geometry/torsion/design'

// Closed-form Saint-Venant torsion of a straight prismatic circular shaft (task 47.2;
// torsion-shaft-1 design "Model circularShaftTorsion v1"). Pure and deterministic, SI units.
// Plane cross-sections remain plane and circular, so J is the polar second moment and shear
// stress is linear in radius. A solid circle is the d = 0 case of the tube formulas, so a tube
// with zero bore gives bitwise-identical results.
// References: Gere & Goodno, Mechanics of Materials, torsion of circular bars and tubes;
// Budynas & Nisbett, Shigley's Mechanical Engineering Design, torsion. Edition and equation
// numbers are pending owner engineering review (29.2).

export interface ShaftSectionProperties {
  /** A = π(D² − d²)/4. */
  areaM2: number
  /** J = π(D⁴ − d⁴)/32. */
  polarMomentM4: number
  /** D. */
  outerDiameterM: number
}

/** Outer and inner diameter of a shaft section (d = 0 for a solid circle). */
export function shaftDiameters(s: TorsionSection): { D: number; d: number } {
  return s.kind === 'circle' ? { D: s.diameterM, d: 0 } : { D: s.outerDiameterM, d: s.innerDiameterM }
}

/** Precondition: the section passes validateTorsionSection. All outputs are finite and > 0. */
export function shaftSectionProperties(s: TorsionSection): ShaftSectionProperties {
  const { D, d } = shaftDiameters(s)
  return {
    areaM2: (Math.PI * (D ** 2 - d ** 2)) / 4,
    polarMomentM4: (Math.PI * (D ** 4 - d ** 4)) / 32,
    outerDiameterM: D,
  }
}

/** φ = T L / (G J), radians. */
export function twistAngle(torqueNm: number, lengthM: number, shearModulusPa: number, polarMomentM4: number): number {
  return (torqueNm * lengthM) / (shearModulusPa * polarMomentM4)
}

/** τ_max = T (D/2) / J at the outer surface, Pa. */
export function maxShearStress(torqueNm: number, outerDiameterM: number, polarMomentM4: number): number {
  return (torqueNm * (outerDiameterM / 2)) / polarMomentM4
}

/** k_t = G J / L, N·m/rad. */
export function torsionalStiffness(shearModulusPa: number, polarMomentM4: number, lengthM: number): number {
  return (shearModulusPa * polarMomentM4) / lengthM
}
