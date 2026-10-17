// Closed-form steady-state response of a single-degree-of-freedom base-excited isolator (task
// 50.2; vibration-isolation-1 design "Model sdofBaseIsolation v1"). Pure and deterministic, SI
// units. A rigid mass m on a linear spring k and a viscous damper c in parallel is driven by
// base motion y(t) = Y sin ωt; the model never integrates the equations of motion.
//   ω_n = √(k/m), f_n = ω_n/2π, ζ = c/(2√(k m)), r = f/f_n
//   TR(r, ζ)  = √[(1 + (2ζr)²)/((1 − r²)² + (2ζr)²)] = X/Y (also the transmitted-force ratio)
//   Z/Y(r, ζ) = r²/√[(1 − r²)² + (2ζr)²]
//   δ_st = m g/k
// For ζ > 0 every denominator is ≥ (2ζr)² > 0 at r > 0, and r = 0 gives TR = 1, Z/Y = 0.
// The undamped case ζ = 0 is defined by the same formulas away from r = 1 and is used only as a
// limiting check; configs reject ζ ≤ 0.
// References (edition, section and equation numbers pending transcription and owner review,
// 29.2): Rao, Mechanical Vibrations, base excitation and vibration isolation; Thomson & Dahleh,
// Theory of Vibration with Applications, support motion and vibration isolation; Harris' Shock and
// Vibration Handbook, vibration isolation theory and equivalent viscous damping.

const TWO_PI = 2 * Math.PI

/** f_n = √(k/m)/2π, Hz. */
export function naturalFrequencyHz(stiffnessNPerM: number, massKg: number): number {
  return Math.sqrt(stiffnessNPerM / massKg) / TWO_PI
}

/** c = 2ζ√(k m), N·s/m (display-only). */
export function dampingCoefficient(dampingRatio: number, stiffnessNPerM: number, massKg: number): number {
  return 2 * dampingRatio * Math.sqrt(stiffnessNPerM * massKg)
}

/** δ_st = m g/k, m. */
export function staticDeflection(massKg: number, gravityMS2: number, stiffnessNPerM: number): number {
  return (massKg * gravityMS2) / stiffnessNPerM
}

/** (1 − r²)² + (2ζr)², the squared dynamic-amplification denominator. */
function denominatorSquared(r: number, zeta: number): number {
  const twoZetaR = 2 * zeta * r
  return (1 - r * r) * (1 - r * r) + twoZetaR * twoZetaR
}

/** Absolute transmissibility TR(r, ζ) = X/Y. */
export function transmissibility(r: number, zeta: number): number {
  const twoZetaR = 2 * zeta * r
  return Math.sqrt((1 + twoZetaR * twoZetaR) / denominatorSquared(r, zeta))
}

/** Relative displacement ratio Z/Y(r, ζ) = r²/√[(1 − r²)² + (2ζr)²]. */
export function relativeDisplacementRatio(r: number, zeta: number): number {
  return (r * r) / Math.sqrt(denominatorSquared(r, zeta))
}

/**
 * Frequency ratio of the transmissibility peak, r_p = √[(√(1 + 8ζ²) − 1)/(4ζ²)].
 *
 * Evaluated in the algebraically identical rationalized form r_p² = 2/(√(1 + 8ζ²) + 1), which
 * avoids cancellation for small ζ and gives the undamped limit r_p = 1 at ζ = 0. TR is unimodal
 * on r > 0 with its maximum here (design.md derivation).
 */
export function transmissibilityPeakRatio(zeta: number): number {
  return Math.sqrt(2 / (Math.sqrt(1 + 8 * zeta * zeta) + 1))
}

/**
 * Frequency ratio of the relative-displacement peak, r_z = 1/√(1 − 2ζ²) for ζ² < 1/2.
 * For ζ² ≥ 1/2, Z/Y increases monotonically in r, so the peak is unbounded: returns +∞ and
 * callers clamp to the top of their frequency range.
 */
export function relativeDisplacementPeakRatio(zeta: number): number {
  const s = 1 - 2 * zeta * zeta
  return s > 0 ? 1 / Math.sqrt(s) : Number.POSITIVE_INFINITY
}

/** min(max(v, lo), hi); the upper bound wins if lo > hi. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** One point of the frequency-response curve. */
export interface ResponsePoint {
  frequencyHz: number
  transmissibility: number
}

/**
 * TR sampled at `samples` (≥ 2) evenly spaced frequencies over [0, maxHz], both ends included,
 * for the frequency-response chart (VIB-14). Display data only: every labeled number comes from
 * the stored analysis, and samples are never persisted.
 */
export function transmissibilityCurve(naturalHz: number, zeta: number, maxHz: number, samples: number): ResponsePoint[] {
  const n = Math.max(2, Math.floor(samples))
  const points: ResponsePoint[] = []
  for (let i = 0; i < n; i++) {
    const frequencyHz = i === n - 1 ? maxHz : (maxHz * i) / (n - 1)
    points.push({ frequencyHz, transmissibility: transmissibility(frequencyHz / naturalHz, zeta) })
  }
  return points
}
