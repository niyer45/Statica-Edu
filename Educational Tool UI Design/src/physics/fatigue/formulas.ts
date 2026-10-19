import {
  ENDURANCE_RATIO,
  FATIGUE_FRACTION_COEFFICIENTS,
  KT_COEFFICIENTS_HIGH,
  KT_COEFFICIENTS_LOW,
  KT_RANGE_SPLIT,
  MPA_PER_KPSI,
  NEUBER_COEFFICIENTS,
  NONROTATING_EQUIVALENT_DIAMETER_RATIO,
  SIZE_FACTOR_LARGE,
  SIZE_FACTOR_SMALL,
} from './constants'

// Closed-form stress-life formulas for the stepped spindle (task 70, model `steppedShaftFatigue`
// v1). Pure and deterministic. Public functions take SI units (m, N, Pa) unless the name says
// otherwise; the textbook correlations are evaluated in the units they are published in (MPa,
// mm, kpsi), converted here. Sources: .kiro/specs/fatigue-analysis-1/design.md and
// ./constants.ts (edition and equation numbers pending engineering review).

const PA_PER_MPA = 1e6
const MM_PER_M = 1e3

/** Nominal bending stress 32 M / (π d³) on a solid round of diameter d, Pa. */
export function nominalBendingStress(momentNm: number, diameterM: number): number {
  return (32 * momentNm) / (Math.PI * diameterM ** 3)
}

/**
 * Roark's polynomial fit for Kt of a shoulder fillet in a stepped round shaft in bending:
 * Kt = C1 + C2 x + C3 x² + C4 x³ with x = 2h/D, h = (D − d)/2 and C_i from h/r (two ranges split
 * at h/r = 2, the low set including 2). Valid for 0.1 ≤ h/r ≤ 20 (screened by KT_FIT_RANGE).
 */
export function shoulderFilletKt(collarDiameterM: number, neckDiameterM: number, filletRadiusM: number): number {
  const h = (collarDiameterM - neckDiameterM) / 2
  const hr = h / filletRadiusM
  const s = Math.sqrt(hr)
  const set = hr <= KT_RANGE_SPLIT ? KT_COEFFICIENTS_LOW : KT_COEFFICIENTS_HIGH
  const [c1, c2, c3, c4] = set.map(([c0, k1, k2]) => c0 + k1 * s + k2 * hr) as [number, number, number, number]
  const x = (2 * h) / collarDiameterM
  return c1 + c2 * x + c3 * x * x + c4 * x * x * x
}

/** Neuber constant √a in √mm for steels in bending (Shigley's fit), Sut in Pa. */
export function neuberConstantSqrtMm(ultimateStrengthPa: number): number {
  const s = ultimateStrengthPa / PA_PER_MPA
  const [k0, k1, k2, k3] = NEUBER_COEFFICIENTS
  return k0 + k1 * s + k2 * s * s + k3 * s * s * s
}

/** Notch sensitivity q = 1 / (1 + √a / √r), r converted to mm. */
export function notchSensitivity(ultimateStrengthPa: number, filletRadiusM: number): number {
  return 1 / (1 + neuberConstantSqrtMm(ultimateStrengthPa) / Math.sqrt(filletRadiusM * MM_PER_M))
}

/** Fatigue notch factor Kf = 1 + q (Kt − 1). */
export function fatigueNotchFactor(kt: number, q: number): number {
  return 1 + q * (kt - 1)
}

/** Unmodified endurance limit Se′ = 0.5 Sut (Sut ≤ 1400 MPa; the loader guarantees it), Pa. */
export function unmodifiedEnduranceLimit(ultimateStrengthPa: number): number {
  return ENDURANCE_RATIO * ultimateStrengthPa
}

/** Marin surface factor ka = a Sut^b with Sut in MPa. */
export function surfaceFactor(aMpa: number, b: number, ultimateStrengthPa: number): number {
  return aMpa * (ultimateStrengthPa / PA_PER_MPA) ** b
}

/** Equivalent diameter of a non-rotating solid round in bending, d_e = 0.370 d, m. */
export function nonRotatingEquivalentDiameter(diameterM: number): number {
  return NONROTATING_EQUIVALENT_DIAMETER_RATIO * diameterM
}

/** Marin size factor kb from the equivalent diameter (two ranges split at 51 mm). */
export function sizeFactor(equivalentDiameterM: number): number {
  const de = equivalentDiameterM * MM_PER_M
  const k = de <= SIZE_FACTOR_SMALL.maxMm ? SIZE_FACTOR_SMALL : SIZE_FACTOR_LARGE
  return k.coefficient * de ** k.exponent
}

/** Fraction f of Sut reached at 10³ cycles (Shigley's fit in kpsi). */
export function fatigueFraction(ultimateStrengthPa: number): number {
  const s = ultimateStrengthPa / PA_PER_MPA / MPA_PER_KPSI
  const [k0, k1, k2] = FATIGUE_FRACTION_COEFFICIENTS
  return k0 + k1 * s + k2 * s * s
}

/**
 * Basquin line through (10³, f Sut) and (10⁶, Se): S_f(N) = a N^b with a = (f Sut)² / Se and
 * b = −(1/3) log₁₀(f Sut / Se).
 */
export function basquinConstants(strengthAt1e3Pa: number, enduranceLimitPa: number): { coefficientPa: number; exponent: number } {
  return {
    coefficientPa: strengthAt1e3Pa ** 2 / enduranceLimitPa,
    exponent: -Math.log10(strengthAt1e3Pa / enduranceLimitPa) / 3,
  }
}

/** Fatigue strength on the Basquin line at N cycles, Pa. */
export function fatigueStrengthAt(coefficientPa: number, exponent: number, cycles: number): number {
  return coefficientPa * cycles ** exponent
}

/** Cycles to failure on the Basquin line at a completely reversed stress, N = (σ / a)^(1/b). */
export function cyclesAtStress(coefficientPa: number, exponent: number, reversedStressPa: number): number {
  return (reversedStressPa / coefficientPa) ** (1 / exponent)
}

/** Modified Goodman safety factor n = 1 / (σa / S + σm / Sut) for an alternating strength S. */
export function goodmanSafetyFactor(alternatingStressPa: number, meanStressPa: number, alternatingStrengthPa: number, ultimateStrengthPa: number): number {
  return 1 / (alternatingStressPa / alternatingStrengthPa + meanStressPa / ultimateStrengthPa)
}

/** Equivalent completely reversed stress on the Goodman line, σ_rev = σa / (1 − σm / Sut); requires σm < Sut. */
export function equivalentReversedStress(alternatingStressPa: number, meanStressPa: number, ultimateStrengthPa: number): number {
  return alternatingStressPa / (1 - meanStressPa / ultimateStrengthPa)
}

/** First-cycle yield safety factor Sy / (σa + σm) with local (Kf-applied) stresses. */
export function firstCycleYieldSafetyFactor(yieldStrengthPa: number, alternatingStressPa: number, meanStressPa: number): number {
  return yieldStrengthPa / (alternatingStressPa + meanStressPa)
}

/** Mass of the collar and neck cylinders, ρ (π/4)(D² L_D + d² L_d), kg. The fillet volume is neglected. */
export function steppedSpindleMass(densityKgM3: number, collarDiameterM: number, collarLengthM: number, neckDiameterM: number, neckLengthM: number): number {
  return densityKgM3 * (Math.PI / 4) * (collarDiameterM * collarDiameterM * collarLengthM + neckDiameterM * neckDiameterM * neckLengthM)
}
