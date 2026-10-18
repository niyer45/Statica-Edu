// Closed-form formulas for the bolted L-bracket (task 55, model `boltedLBracket` v1). Pure and
// deterministic, SI units. Geometry (geometry/bracket/outline.ts): the flange lies on the wall
// face x = 0; the arm runs along y = 0 … t; the bend has inner radius r_i and outer radius
// r_o = r_i + t; the bolt row is at the bolt edge distance e below the top of the flange (H).
// The load P hangs at x = a (the load offset).
//
// References (edition and equation numbers pending owner engineering review, 29.2):
//   - Curved beam in bending (Winkler–Bach): Budynas & Nisbett, Shigley's Mechanical Engineering
//     Design, "Curved Beams in Bending"; Young & Budynas, Roark's Formulas for Stress and Strain,
//     chapter 9 and Table 9.1 case 1.
//   - Cantilever tip deflection P a³/(3EI) and the end rotation M L/(3EI) of a simply supported
//     beam under an end moment: Gere & Goodno, Mechanics of Materials (deflection tables).
//   - Bolted bracket loaded in tension by an overturning moment, with rotation about the heel
//     (the edge of the bracket that bears on the wall): the conventional rigid-bracket method in
//     Shigley (bolted joints) and the AISC Steel Construction Manual's conservative approach to
//     bolts in tension from eccentric loads.

/** M = P a, the overturning moment about the wall face and the bending moment at the bend, N·m. */
export function bendMoment(forceN: number, loadOffsetM: number): number {
  return forceN * loadOffsetM
}

/** σ = 6 M / (w t²), the straight-beam extreme-fibre stress of the w × t section, Pa. */
export function nominalBendingStress(momentNm: number, widthM: number, thicknessM: number): number {
  return (6 * momentNm) / (widthM * thicknessM ** 2)
}

/** Neutral-axis radius of a rectangular curved beam, r_n = t / ln(r_o / r_i), m. */
export function curvedBeamNeutralRadius(innerRadiusM: number, thicknessM: number): number {
  return thicknessM / Math.log((innerRadiusM + thicknessM) / innerRadiusM)
}

/**
 * Winkler–Bach inner-fibre bending stress of a rectangular curved beam,
 * σ_i = M (r_n − r_i) / (A e r_i), with A = w t, e = r_c − r_n, r_c = r_i + t/2, Pa.
 * For the moment direction that opens the bend (a hanging load on the arm) this fibre is in
 * tension; the magnitude is returned.
 */
export function curvedBeamInnerStress(momentNm: number, widthM: number, thicknessM: number, innerRadiusM: number): number {
  const rn = curvedBeamNeutralRadius(innerRadiusM, thicknessM)
  const rc = innerRadiusM + thicknessM / 2
  const e = rc - rn
  return (momentNm * (rn - innerRadiusM)) / (widthM * thicknessM * e * innerRadiusM)
}

/** R/c = r_c / (t/2) = 1 + 2 r_i / t, the curvature ratio Roark tabulates. */
export function bendRadiusRatio(innerRadiusM: number, thicknessM: number): number {
  return (innerRadiusM + thicknessM / 2) / (thicknessM / 2)
}

/** I = w t³ / 12, m⁴. */
export function plateSecondMoment(widthM: number, thicknessM: number): number {
  return (widthM * thicknessM ** 3) / 12
}

/** δ_arm = P a³ / (3 E I): the arm as a cantilever from the wall face, m. */
export function armBendingDeflection(forceN: number, loadOffsetM: number, elasticModulusPa: number, secondMomentM4: number): number {
  return (forceN * loadOffsetM ** 3) / (3 * elasticModulusPa * secondMomentM4)
}

/**
 * δ_flange = θ a with θ = (P a) h_b / (3 E I): the flange span between the heel and the bolt row,
 * simply supported there, rotates under the end moment P a at the heel, and the arm turns with
 * it, m.
 */
export function flangeRotationDeflection(
  forceN: number,
  loadOffsetM: number,
  leverArmM: number,
  elasticModulusPa: number,
  secondMomentM4: number,
): number {
  return (forceN * loadOffsetM ** 2 * leverArmM) / (3 * elasticModulusPa * secondMomentM4)
}

/**
 * h_b = H − e − r_o: the bolt row's height above the heel, the point where the flange leaves the
 * wall at the start of the bend, m.
 */
export function boltLeverArm(flangeHeightM: number, boltEdgeDistanceM: number, innerRadiusM: number, thicknessM: number): number {
  return flangeHeightM - boltEdgeDistanceM - (innerRadiusM + thicknessM)
}

/** T = P a / (n h_b): moments about the heel, shared equally by the n bolts of the row, N. */
export function boltTension(forceN: number, loadOffsetM: number, boltCount: number, leverArmM: number): number {
  return (forceN * loadOffsetM) / (boltCount * leverArmM)
}

/**
 * m = ρ w [t (L_arm − r_o) + t (H − r_o) + (π/4)(r_o² − r_i²)]: two straight legs plus the
 * quarter-annulus bend; bolt holes neglected, kg.
 */
export function lBracketMass(
  densityKgM3: number,
  widthM: number,
  thicknessM: number,
  innerRadiusM: number,
  armLengthM: number,
  flangeHeightM: number,
): number {
  const ro = innerRadiusM + thicknessM
  const area = thicknessM * (armLengthM - ro) + thicknessM * (flangeHeightM - ro) + (Math.PI / 4) * (ro ** 2 - innerRadiusM ** 2)
  return densityKgM3 * widthM * area
}
