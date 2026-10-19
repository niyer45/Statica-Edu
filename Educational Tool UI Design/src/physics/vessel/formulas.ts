// Closed-form formulas for the thin-walled pressure vessel (task 69, model
// `thinWallPressureVessel` v1). Pure and deterministic, SI units. r is the inner radius of the
// shell and of the hemispherical heads; t_s and t_h are the shell and head walls; L is the
// cylindrical shell length between the head junctions; p is the internal gauge pressure.
//
// References (edition and equation numbers pending engineering review): Hibbeler, Mechanics of
// Materials, and Gere & Goodno, Mechanics of Materials (thin-walled cylindrical and spherical
// pressure vessels).

/** σ_h = p r / t_s: equilibrium of half a ring of the shell, p · 2r = 2 σ_h t_s, Pa. */
export function hoopStress(pressurePa: number, innerRadiusM: number, shellThicknessM: number): number {
  return (pressurePa * innerRadiusM) / shellThicknessM
}

/** σ_l = p r / (2 t_s): equilibrium of a closed end, p π r² = σ_l · 2π r t_s, Pa. */
export function longitudinalStress(pressurePa: number, innerRadiusM: number, shellThicknessM: number): number {
  return (pressurePa * innerRadiusM) / (2 * shellThicknessM)
}

/** σ = p r / (2 t_h): equilibrium of half a hemispherical head, p π r² = σ · 2π r t_h, Pa. */
export function headMembraneStress(pressurePa: number, innerRadiusM: number, headThicknessM: number): number {
  return (pressurePa * innerRadiusM) / (2 * headThicknessM)
}

/** V = π r² L + (4/3) π r³: the cylinder plus the two hemispheres, m³. */
export function internalVolume(innerRadiusM: number, shellLengthM: number): number {
  return Math.PI * innerRadiusM ** 2 * shellLengthM + (4 / 3) * Math.PI * innerRadiusM ** 3
}

/** L_o = L + 2 (r + t_h): outside of one head to outside of the other, m. */
export function overallLength(shellLengthM: number, innerRadiusM: number, headThicknessM: number): number {
  return shellLengthM + 2 * (innerRadiusM + headThicknessM)
}

/** m_s = ρ π ((r + t_s)² − r²) L: the cylindrical shell, kg. */
export function shellMass(densityKgM3: number, innerRadiusM: number, shellThicknessM: number, shellLengthM: number): number {
  return densityKgM3 * Math.PI * ((innerRadiusM + shellThicknessM) ** 2 - innerRadiusM ** 2) * shellLengthM
}

/** m_h = ρ (4/3) π ((r + t_h)³ − r³): the two hemispherical heads together, kg. */
export function headsMass(densityKgM3: number, innerRadiusM: number, headThicknessM: number): number {
  return densityKgM3 * (4 / 3) * Math.PI * ((innerRadiusM + headThicknessM) ** 3 - innerRadiusM ** 3)
}
