// Axial loading of a straight prismatic bar (task 72; stress-strain-1 design "Model axialTieRod
// v1"). Pure and deterministic, SI units. Shared by the Stress and Strain I challenge
// (physics/axial/analyze.ts) and the Stress and strain Learn module (learn/axialDemo.ts), so the
// module's demonstrations and the challenge use exactly the same physics.
// Linear elastic: the load passes through the centroid, the stress is uniform over the section
// (away from the ends) and the bar stretches uniformly. Not valid beyond yield.
// References: Gere & Goodno, Mechanics of Materials (axially loaded members); Hibbeler, Mechanics
// of Materials (stress, strain, axial load). Edition and equation numbers pending engineering
// review (29.2).

/** Area of a solid circular section, A = π d² / 4, m². */
export function circleArea(diameterM: number): number {
  return (Math.PI * diameterM * diameterM) / 4
}

/** Normal stress σ = P / A, Pa (positive in tension). */
export function axialStress(forceN: number, areaM2: number): number {
  return forceN / areaM2
}

/** Strain from Hooke's law, ε = σ / E (dimensionless). */
export function strainFromStress(stressPa: number, elasticModulusPa: number): number {
  return stressPa / elasticModulusPa
}

/** Stress from Hooke's law, σ = E ε, Pa. */
export function stressFromStrain(strain: number, elasticModulusPa: number): number {
  return elasticModulusPa * strain
}

/** Strain from its definition, ε = δ / L (dimensionless). */
export function strainFromElongation(elongationM: number, lengthM: number): number {
  return elongationM / lengthM
}

/** Change in length δ = P L / (A E), m. */
export function axialElongation(forceN: number, lengthM: number, areaM2: number, elasticModulusPa: number): number {
  return (forceN * lengthM) / (areaM2 * elasticModulusPa)
}

/** Axial stiffness k = E A / L, N/m (load per unit stretch). */
export function axialStiffness(elasticModulusPa: number, areaM2: number, lengthM: number): number {
  return (elasticModulusPa * areaM2) / lengthM
}

/** Mass m = ρ A L, kg. */
export function prismMass(densityKgM3: number, areaM2: number, lengthM: number): number {
  return densityKgM3 * areaM2 * lengthM
}

/** Allowable stress σ_y / n, Pa, for a design factor n ≥ 1. */
export function allowableStress(yieldStressPa: number, designFactor: number): number {
  return yieldStressPa / designFactor
}

/** Yield ratio σ / σ_y: above 1 the bar has yielded and this linear model no longer applies. */
export function yieldRatio(stressPa: number, yieldStressPa: number): number {
  return stressPa / yieldStressPa
}
