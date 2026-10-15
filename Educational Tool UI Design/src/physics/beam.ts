// Euler-Bernoulli cantilever with a tip point load (Req 8.9, 8.11, 9.5).
// SI units throughout: F [N], L and x [m], E [Pa], I [m⁴], M [N·m], c [m].
// Pure functions; validity of inputs is checked by analyze() (task 9.2).

/** Tip deflection δ = F·L³ / (3·E·I). */
export function tipDeflection(F: number, L: number, E: number, I: number): number {
  return (F * L ** 3) / (3 * E * I)
}

/** Maximum bending moment at the fixed root, M = F·L. */
export function maxMoment(F: number, L: number): number {
  return F * L
}

/** Nominal extreme-fibre bending stress σ = M·c / I. */
export function nominalStress(M: number, c: number, I: number): number {
  return (M * c) / I
}

/**
 * Deflection at distance x from the root: w(x) = F·x²·(3L − x) / (6·E·I).
 * x is clamped to [0, L] (outside the beam the shape is undefined, and
 * clamping keeps visualization callers safe). w(0) is exactly 0 and w(L)
 * equals tipDeflection(F, L, E, I) to within floating-point rounding.
 * Monotone non-decreasing on [0, L] for F, E, I > 0.
 */
export function deflectionShape(F: number, L: number, E: number, I: number, x: number): number {
  const xc = Math.min(Math.max(x, 0), L)
  return (F * xc ** 2 * (3 * L - xc)) / (6 * E * I)
}
