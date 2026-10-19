// Closed-form formulas for the pinned–pinned Euler column (task 68, model `eulerColumnBuckling` v1).
// Pure and deterministic, SI units. The section is a solid round bar (inner diameter 0) or a round
// tube of outer diameter D and inner diameter d = D − 2t.
//
// References (names only; edition and equation numbers pending owner engineering review, 29.2):
//   - Euler critical load P_cr = π²EI/(KL)², slenderness KL/r and the Euler–Johnson transition
//     slenderness √(2π²E/σ_y): Budynas & Nisbett, Shigley's Mechanical Engineering Design, columns
//     with central loading; Gere & Goodno, Mechanics of Materials; Hibbeler, Mechanics of
//     Materials; Timoshenko & Gere, Theory of Elastic Stability.
//   - Area and second moment of a circle and an annulus: any mechanics of materials text.

/** A = π(D² − d²)/4, m². */
export function annulusArea(outerDiameterM: number, innerDiameterM: number): number {
  return (Math.PI * (outerDiameterM ** 2 - innerDiameterM ** 2)) / 4
}

/** I = π(D⁴ − d⁴)/64, the same about every diameter, m⁴. */
export function annulusSecondMoment(outerDiameterM: number, innerDiameterM: number): number {
  return (Math.PI * (outerDiameterM ** 4 - innerDiameterM ** 4)) / 64
}

/** r = √(I/A), m. */
export function radiusOfGyration(secondMomentM4: number, areaM2: number): number {
  return Math.sqrt(secondMomentM4 / areaM2)
}

/** P_cr = π² E I / (K L)², N. */
export function eulerCriticalLoad(elasticModulusPa: number, secondMomentM4: number, effectiveLengthM: number): number {
  return (Math.PI ** 2 * elasticModulusPa * secondMomentM4) / effectiveLengthM ** 2
}

/** λ_c = √(2π² E / σ_y): Euler and Johnson curves meet where the Euler stress is half the yield stress. */
export function transitionSlenderness(elasticModulusPa: number, yieldStressPa: number): number {
  return Math.sqrt((2 * Math.PI ** 2 * elasticModulusPa) / yieldStressPa)
}

/** m = ρ A L, kg. */
export function columnMass(densityKgM3: number, areaM2: number, lengthM: number): number {
  return densityKgM3 * areaM2 * lengthM
}
