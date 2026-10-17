import { withinLimit } from '../tolerance'
import {
  KT_BRANCH_H_OVER_R,
  KT_H_OVER_R_MAX,
  KT_LOWER_BRANCH,
  KT_R_OVER_H_MAX,
  KT_UPPER_BRANCH,
  type KtBranchCoefficients,
} from './constants'

// Shoulder-fillet stress-concentration factor for a stepped flat bar in in-plane bending
// (task 46.2; MBR-13, design.md "Stress-concentration factor"). Pure and deterministic. The
// coefficient table, validity range and branch rule come only from ./constants.ts.
//
// Kt = C1 + C2(2h/D) + C3(2h/D)² + C4(2h/D)³ with Ci = αi + βi√(h/r) + γi(h/r), h = (D − d)/2.
// The fit is defined iff h/r ≤ 20 and r/h ≤ 10 (inclusive, REL_TOL). Those are exactly the
// KT_FIT_SHARP and KT_FIT_SHALLOW screen metrics, computed by shoulderRatios below, so the fit
// and the screens can never disagree. h/r ≤ 2 (inclusive, REL_TOL) uses the lower branch.

export type KtBranch = 'lower' | 'upper'

/** Shoulder ratios of a stepped bar. Precondition: 0 < d < D and r > 0 for finite results. */
export interface ShoulderRatios {
  /** Shoulder height on each side, h = (D − d)/2, m. */
  shoulderHeightM: number
  /** h / r (KT_FIT_SHARP metric). */
  heightToRadiusRatio: number
  /** r / h (KT_FIT_SHALLOW metric). */
  radiusToHeightRatio: number
  /** D / d (KT_STEP_RATIO metric). */
  stepRatio: number
  /** 2h / D, the polynomial variable. */
  depthFraction: number
}

export function shoulderRatios(rootDepthM: number, armDepthM: number, filletRadiusM: number): ShoulderRatios {
  const h = (rootDepthM - armDepthM) / 2
  return {
    shoulderHeightM: h,
    heightToRadiusRatio: h / filletRadiusM,
    radiusToHeightRatio: filletRadiusM / h,
    stepRatio: rootDepthM / armDepthM,
    depthFraction: (2 * h) / rootDepthM,
  }
}

/** True iff the fit covers these ratios: h/r ≤ 20 and r/h ≤ 10, inclusive within REL_TOL. */
export function ktFitDefined(r: Pick<ShoulderRatios, 'heightToRadiusRatio' | 'radiusToHeightRatio'>): boolean {
  return withinLimit(r.heightToRadiusRatio, KT_H_OVER_R_MAX) && withinLimit(r.radiusToHeightRatio, KT_R_OVER_H_MAX)
}

/** The branch for h/r: lower iff h/r ≤ 2 within REL_TOL (K-3). */
export function ktBranchFor(heightToRadiusRatio: number): KtBranch {
  return withinLimit(heightToRadiusRatio, KT_BRANCH_H_OVER_R) ? 'lower' : 'upper'
}

/** C1–C4 evaluated at h/r for the given branch table. */
export function ktCoefficients(heightToRadiusRatio: number, table: KtBranchCoefficients): [number, number, number, number] {
  const s = Math.sqrt(heightToRadiusRatio)
  const [c1, c2, c3, c4] = table.map((k) => k.alpha + k.beta * s + k.gamma * heightToRadiusRatio)
  return [c1, c2, c3, c4]
}

/** The cubic in 2h/D with branch coefficients at h/r. No range check (see shoulderFilletKt). */
export function ktPolynomial(heightToRadiusRatio: number, depthFraction: number, branch: KtBranch): number {
  const [c1, c2, c3, c4] = ktCoefficients(heightToRadiusRatio, branch === 'lower' ? KT_LOWER_BRANCH : KT_UPPER_BRANCH)
  const x = depthFraction
  return c1 + c2 * x + c3 * x ** 2 + c4 * x ** 3
}

export interface ShoulderFilletKt {
  kt: number
  branch: KtBranch
}

/** Kt and its branch, or undefined when the fit does not cover the ratios (MBR-13). */
export function shoulderFilletKt(r: ShoulderRatios): ShoulderFilletKt | undefined {
  if (!ktFitDefined(r)) return undefined
  const branch = ktBranchFor(r.heightToRadiusRatio)
  return { kt: ktPolynomial(r.heightToRadiusRatio, r.depthFraction, branch), branch }
}
