// Closed-form steady one-dimensional fin and fin-array relations (task 48.2; heat-sink-1 design
// "Model plateFinHeatSink v1"). Pure and deterministic, SI units.
// Straight rectangular fins with the perimeter approximated as 2D (D ≫ t), so m depends on h, k
// and t only. The tip is handled by the corrected length L_c = H + t/2 with an adiabatic tip
// (HS-02); the exact convective-tip solution is a test benchmark only (test/fixtures).
// References: Bergman, Lavine, Incropera & DeWitt, Fundamentals of Heat and Mass Transfer,
// extended-surfaces chapter (the fin equation; uniform-cross-section fins with convective,
// adiabatic and corrected-length tips; fin efficiency; fin arrays and overall surface
// efficiency). Edition, equation numbers and the text's accuracy criterion for the corrected
// length are not transcribed here: they are pending owner engineering review (29.2), and the
// corrected-length error is instead measured against the exact tip in the tests.

/** Fin parameter m = √(2h/(k t)), 1/m (perimeter 2D, cross-section D t). */
export function finParameter(hWPerM2K: number, kWPerMK: number, thicknessM: number): number {
  return Math.sqrt((2 * hWPerM2K) / (kWPerMK * thicknessM))
}

/** Corrected fin length L_c = H + t/2, m: the tip area folded into an adiabatic-tip fin. */
export function correctedFinLength(heightM: number, thicknessM: number): number {
  return heightM + thicknessM / 2
}

/** Fin efficiency η_f = tanh(m L_c)/(m L_c) for mLc > 0. */
export function finEfficiency(mLc: number): number {
  return Math.tanh(mLc) / mLc
}

/** Overall surface efficiency η_o = 1 − (N A_f/A_t)(1 − η_f). */
export function overallSurfaceEfficiency(finCount: number, finAreaM2: number, totalAreaM2: number, etaF: number): number {
  return 1 - ((finCount * finAreaM2) / totalAreaM2) * (1 - etaF)
}

/** Adiabatic-tip excess profile θ(x)/θ_b = cosh(m(L_c − x))/cosh(m L_c) of the corrected-length fin. */
export function finExcessRatio(mPerM: number, correctedLengthM: number, xM: number): number {
  return Math.cosh(mPerM * (correctedLengthM - xM)) / Math.cosh(mPerM * correctedLengthM)
}
