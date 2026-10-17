// Closed-form Euler–Bernoulli formulas for the stepped rectangular cantilever (task 46.2;
// mounting-bracket-1 design.md "Model steppedBarBracket v1"). Pure and deterministic, SI units.
// Depth D over 0 ≤ x < a, d over a ≤ x ≤ L, thickness b out of plane, tip force F at x = L,
// wall clamp at x = 0, so M(x) = F(L − x).
// References (edition and equation numbers pending owner engineering review, 29.2):
// Gere & Goodno, Mechanics of Materials (cantilever deflection; unit-load / moment-area method
// for nonprismatic beams); Budynas & Nisbett, Shigley's Mechanical Engineering Design
// (Castigliano and unit-load deflection).

/** I = b h³ / 12 for a rectangle of thickness b and depth h, m⁴. */
export function rectSecondMoment(thicknessM: number, depthM: number): number {
  return (thicknessM * depthM ** 3) / 12
}

/** M(x) = F (L − x), N·m. */
export function bendingMoment(forceN: number, lengthM: number, xM: number): number {
  return forceN * (lengthM - xM)
}

/** σ = 6 M / (b h²), the nominal extreme-fibre stress of a rectangle, Pa. */
export function nominalBendingStress(momentNm: number, thicknessM: number, depthM: number): number {
  return (6 * momentNm) / (thicknessM * depthM ** 2)
}

/**
 * δ_tip = (F/(3E)) [(L³ − (L − a)³)/I_D + (L − a)³/I_d], from the unit-load integral
 * δ = ∫₀ᴸ F(L − x)²/(E I(x)) dx split at x = a, m.
 */
export function steppedTipDeflection(
  forceN: number,
  elasticModulusPa: number,
  lengthM: number,
  stepLocationM: number,
  rootSecondMomentM4: number,
  armSecondMomentM4: number,
): number {
  const L3 = lengthM ** 3
  const arm3 = (lengthM - stepLocationM) ** 3
  return (forceN / (3 * elasticModulusPa)) * ((L3 - arm3) / rootSecondMomentM4 + arm3 / armSecondMomentM4)
}

/** δ_tip = F L³ / (3 E I) for a prismatic cantilever (uniform bar, MBR-12), m. */
export function uniformTipDeflection(forceN: number, elasticModulusPa: number, lengthM: number, secondMomentM4: number): number {
  return (forceN * lengthM ** 3) / (3 * elasticModulusPa * secondMomentM4)
}

/** m = ρ b [D a + d (L − a)], fillets neglected (design.md bounds them), kg. */
export function steppedBarMass(
  densityKgM3: number,
  thicknessM: number,
  rootDepthM: number,
  armDepthM: number,
  stepLocationM: number,
  lengthM: number,
): number {
  return densityKgM3 * thicknessM * (rootDepthM * stepLocationM + armDepthM * (lengthM - stepLocationM))
}

/** m = ρ b h L for a uniform bar, kg. */
export function uniformBarMass(densityKgM3: number, thicknessM: number, depthM: number, lengthM: number): number {
  return densityKgM3 * thicknessM * depthM * lengthM
}
