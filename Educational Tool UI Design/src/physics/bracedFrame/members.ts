import type { MemberCapacityMode, MemberSense } from './types'

// Braced frame section properties and member capacity (task 49.2; braced-frame-1 BFR-04,
// BFR-10, BFR-12, BFR-14, design "Section" and "Capacity"). Pure, SI units.
//   CHS (outer diameter D, wall t, d = D − 2t): A = π(D² − d²)/4, I = π(D⁴ − d⁴)/64, r = √(I/A).
//   Tension: P_t = A f_y. Compression: P_c = min(A f_y, P_E), P_E = π² E I / L² (pinned ends,
//   K = 1, full member length because crossing diagonals are not connected).
//   Utilization u = |N| / P, with P_t for tension or ≈ 0 members (so round-off sign never
//   matters) and P_c for compression. No resistance or safety factors (educational nominal).
//   Johnson screen (never a capacity): λ_c = π √(2E/f_y); N_J = A f_y [1 − f_y λ²/(4π²E)].
// References: Timoshenko & Gere, Theory of Elastic Stability (Euler load of a pin-ended column;
// inelastic buckling context); Salmon, Johnson & Malhas, Steel Structures: Design and Behavior
// (Johnson parabola for inelastic columns). Edition and equation numbers pending owner review (29.2).

export interface ChsProperties {
  /** A, m². */
  areaM2: number
  /** I, m⁴. */
  secondMomentM4: number
  /** r = √(I/A), m. */
  radiusOfGyrationM: number
}

/** Precondition: 0 < t < D/2 (the config loader enforces it). */
export function chsProperties(outerDiameterM: number, wallM: number): ChsProperties {
  const D = outerDiameterM
  const d = D - 2 * wallM
  const areaM2 = (Math.PI * (D * D - d * d)) / 4
  const secondMomentM4 = (Math.PI * (D * D * D * D - d * d * d * d)) / 64
  return { areaM2, secondMomentM4, radiusOfGyrationM: Math.sqrt(secondMomentM4 / areaM2) }
}

/** π² E I / L², N. */
export function eulerLoad(elasticModulusPa: number, secondMomentM4: number, lengthM: number): number {
  return (Math.PI * Math.PI * elasticModulusPa * secondMomentM4) / (lengthM * lengthM)
}

/** λ_c = π √(2E / f_y): below it the Johnson parabola applies. */
export function criticalSlenderness(elasticModulusPa: number, yieldStressPa: number): number {
  return Math.PI * Math.sqrt((2 * elasticModulusPa) / yieldStressPa)
}

/** N_J = A f_y [1 − f_y λ² / (4π² E)], N. Only meaningful for λ < λ_c. */
export function johnsonLoad(areaM2: number, yieldStressPa: number, slenderness: number, elasticModulusPa: number): number {
  return areaM2 * yieldStressPa * (1 - (yieldStressPa * slenderness * slenderness) / (4 * Math.PI * Math.PI * elasticModulusPa))
}

/** Tension, compression or ≈ 0 when |N| ≤ zeroRelTol · max|N| (BFR-14). */
export function classifyForce(forceN: number, maxAbsForceN: number, zeroRelTol: number): MemberSense {
  if (Math.abs(forceN) <= zeroRelTol * maxAbsForceN) return 'zero'
  return forceN > 0 ? 'tension' : 'compression'
}

/** The governing capacity for a member of the given sense. */
export function memberCapacity(
  sense: MemberSense,
  props: Pick<ChsProperties, 'areaM2' | 'secondMomentM4'>,
  lengthM: number,
  elasticModulusPa: number,
  yieldStressPa: number,
): { capacityN: number; mode: MemberCapacityMode } {
  const squash = props.areaM2 * yieldStressPa
  if (sense !== 'compression') return { capacityN: squash, mode: 'tensionYield' }
  const euler = eulerLoad(elasticModulusPa, props.secondMomentM4, lengthM)
  return euler < squash ? { capacityN: euler, mode: 'euler' } : { capacityN: squash, mode: 'compressionYield' }
}
