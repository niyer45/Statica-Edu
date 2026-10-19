import type { SurfaceFinishId } from '../../geometry/fatigue/design'
import type { ApplicabilityThreshold } from '../constants'

// Fatigue Analysis I model constants (task 70, model `steppedShaftFatigue` v1; FAT-07, FAT-12,
// FAT-13). These are constants of the model, never challenge configuration; any change after
// release requires a model version change (MM-04). Coefficients are the published correlations
// listed in .kiro/specs/fatigue-analysis-1/design.md; edition and equation numbers are pending
// owner engineering review (29.2). They are educational screening correlations with scatter, not
// a certification method.

// ---------------------------------------------------------------------------
// Stress concentration: Roark's polynomial fit for a shoulder fillet in a stepped circular shaft
// in bending (Young, Budynas & Sadegh, Roark's Formulas for Stress and Strain, stress-concentration
// table; Roark takes these fits from the Peterson collection). Kt = C1 + C2 x + C3 x² + C4 x³,
// x = 2h/D, each C_i = c0 + c1 √(h/r) + c2 (h/r). Nominal stress 32M/(πd³).

/** [c0, c1, c2] for C1…C4 when 0.1 ≤ h/r ≤ 2.0. */
export const KT_COEFFICIENTS_LOW: readonly (readonly [number, number, number])[] = Object.freeze([
  Object.freeze([0.947, 1.206, -0.131] as const),
  Object.freeze([0.022, -3.405, 0.915] as const),
  Object.freeze([0.869, 1.777, -0.555] as const),
  Object.freeze([-0.81, 0.422, -0.26] as const),
])

/** [c0, c1, c2] for C1…C4 when 2.0 < h/r ≤ 20.0. */
export const KT_COEFFICIENTS_HIGH: readonly (readonly [number, number, number])[] = Object.freeze([
  Object.freeze([1.232, 0.832, -0.008] as const),
  Object.freeze([-3.813, 0.968, -0.26] as const),
  Object.freeze([7.423, -4.868, 0.869] as const),
  Object.freeze([-3.839, 3.07, -0.6] as const),
])

/** The h/r value separating the two coefficient sets (the low set includes it). */
export const KT_RANGE_SPLIT = 2

/** Range of the fit and of the chart it reproduces: 0.1 ≤ h/r ≤ 20, r/d ≤ 0.3, D/d ≤ 3. */
export const KT_FIT_LIMITS = Object.freeze({ minShoulderToFillet: 0.1, maxShoulderToFillet: 20, maxFilletToNeck: 0.3, maxCollarToNeck: 3 })

// ---------------------------------------------------------------------------
// Notch sensitivity (Neuber form, Shigley's fit of the Neuber constant for steels in bending):
// √a = 1.24 − 2.25e−3 Sut + 1.60e−6 Sut² − 4.11e−10 Sut³ (Sut in MPa, √a in √mm), valid for
// 340 ≤ Sut ≤ 1700 MPa; q = 1 / (1 + √a / √r), r in mm.

export const NEUBER_COEFFICIENTS = Object.freeze([1.24, -2.25e-3, 1.6e-6, -4.11e-10] as const)
export const NEUBER_SUT_RANGE_MPA = Object.freeze({ min: 340, max: 1700 })

// ---------------------------------------------------------------------------
// Endurance limit (Marin): Se = ka kb kc kd ke Se′, Se′ = 0.5 Sut for Sut ≤ 1400 MPa.

export const ENDURANCE_RATIO = 0.5
export const ENDURANCE_RATIO_MAX_SUT_MPA = 1400

export interface SurfaceFinishCoefficients {
  /** Student-facing name. Contains no digits. */
  name: string
  /** ka = a · Sut^b with Sut in MPa. */
  aMpa: number
  b: number
}

/**
 * Shigley's surface factor ka = a Sut^b (Sut in MPa), coefficients of the current edition as used
 * in its worked solutions. As-forged: the published kpsi form 12.7 Sut^−0.758 converted to MPa,
 * a = 12.7 × 6.894757^0.758. Hot-rolled is not offered (its current coefficients were not verified).
 */
export const SURFACE_FINISHES: Readonly<Record<SurfaceFinishId, SurfaceFinishCoefficients>> = Object.freeze({
  ground: Object.freeze({ name: 'Ground', aMpa: 1.38, b: -0.067 }),
  machined: Object.freeze({ name: 'Machined', aMpa: 3.04, b: -0.217 }),
  asForged: Object.freeze({ name: 'As-forged', aMpa: 12.7 * 6.894757 ** 0.758, b: -0.758 }),
})

/**
 * Size factor for a non-rotating solid round in bending: equivalent diameter d_e = 0.370 d, then
 * kb = 1.24 d_e^−0.107 for 2.79 ≤ d_e ≤ 51 mm and 1.51 d_e^−0.157 for 51 < d_e ≤ 254 mm.
 */
export const NONROTATING_EQUIVALENT_DIAMETER_RATIO = 0.37
export const SIZE_FACTOR_SMALL = Object.freeze({ coefficient: 1.24, exponent: -0.107, minMm: 2.79, maxMm: 51 })
export const SIZE_FACTOR_LARGE = Object.freeze({ coefficient: 1.51, exponent: -0.157, maxMm: 254 })

/** kc for bending and kd at room temperature (temperature is not modeled). */
export const LOAD_FACTOR_BENDING = 1
export const TEMPERATURE_FACTOR_ROOM = 1

/** Shigley's reliability factors ke by reliability percent; the config must use one of these pairs. */
export const RELIABILITY_FACTORS: Readonly<Record<string, number>> = Object.freeze({ '50': 1, '90': 0.897, '95': 0.868, '99': 0.814, '99.9': 0.753 })

// ---------------------------------------------------------------------------
// S-N line (Basquin) between 10³ and 10⁶ cycles. Fraction of Sut at 10³ cycles (Shigley's fit,
// Sut in kpsi, 70 ≤ Sut ≤ 200 kpsi): f = 1.06 − 2.8e−3 S + 6.9e−6 S².

export const FATIGUE_FRACTION_COEFFICIENTS = Object.freeze([1.06, -2.8e-3, 6.9e-6] as const)
export const FATIGUE_FRACTION_SUT_RANGE_KPSI = Object.freeze({ min: 70, max: 200 })
export const MPA_PER_KPSI = 6.894757
export const LOW_CYCLE_LIMIT_CYCLES = 1e3
export const ENDURANCE_CYCLES = 1e6

/** Disclosure wherever the model limits are listed. No digits. */
export const FATIGUE_SOURCE_NOTE =
  "stress-life screening with Roark's stress-concentration fit for a shoulder fillet, Neuber notch sensitivity, Marin endurance-limit factors, a Basquin S-N line and the modified Goodman line (Shigley; Roark; Peterson), used only inside the correlations' ranges; edition and equation numbers pending engineering review"

// ---------------------------------------------------------------------------
// Applicability screens. No warning bands (warning = not applicable), inclusive at 1.

export type FatigueApplicabilityCode = 'KT_FIT_RANGE' | 'LOCAL_YIELD' | 'LOW_CYCLE'

/** Fixed issue order. */
export const FATIGUE_APPLICABILITY_CODES: readonly FatigueApplicabilityCode[] = Object.freeze(['KT_FIT_RANGE', 'LOCAL_YIELD', 'LOW_CYCLE'] as const)

const t = (warning: number, notApplicable: number, metric: string, effect: string): ApplicabilityThreshold => Object.freeze({ warning, notApplicable, metric, effect })

/**
 *   KT_FIT_RANGE  max((h/r)/20, 0.1/(h/r), (r/d)/0.3, (D/d)/3): outside the stress-concentration fit.
 *   LOCAL_YIELD   Kf (σa,0 + σm,0) / Sy: the notch yields on the first cycle, so the elastic Kf and
 *                 the Goodman line no longer describe it.
 *   LOW_CYCLE     σa / (f Sut) + σm / Sut: the predicted life is below 10³ cycles, outside the
 *                 stress-life method.
 */
export const FATIGUE_THRESHOLDS: Readonly<Record<FatigueApplicabilityCode, ApplicabilityThreshold>> = Object.freeze({
  KT_FIT_RANGE: t(1, 1, 'largest fillet-geometry ratio over its fit limit', 'stress concentrations outside the fitted fillet range'),
  LOCAL_YIELD: t(1, 1, 'peak local stress / yield strength', 'yielding at the fillet'),
  LOW_CYCLE: t(1, 1, 'Goodman ratio at a thousand cycles', 'low-cycle (strain-life) fatigue'),
})

/** Effects the model never accounts for, listed on every analysis (FAT-14). */
export const FATIGUE_UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'corrosion, and fretting at the wheel hub fit',
  'temperature (room temperature assumed)',
  'residual stresses from forging, rolling or shot peening',
  'variable-amplitude loading and cumulative damage',
  'yielding at the fillet and crack growth (screened only)',
  'scatter beyond the fixed reliability factor',
  'the fillet volume and the hub stiffening the fillet',
  'shear from the transverse load',
  'other stress raisers such as keyways, threads or holes',
])

/** Model assumptions listed on every analysis. */
export const FATIGUE_ASSUMPTIONS: readonly string[] = Object.freeze([
  'linear elastic stresses; the spindle does not rotate, so the wheel load gives a mean and an alternating bending stress at the shoulder',
  'bending moment at the fillet = wheel load × its distance from the shoulder; nominal stress on the neck diameter',
  'stress-concentration factor from a fitted chart; fatigue notch factor from the notch sensitivity, applied to both the mean and the alternating stress',
  'endurance limit from the ultimate strength with surface, size (non-rotating equivalent diameter), load, temperature and reliability factors',
  'straight S-N line on log-log axes from a thousand to a million cycles; infinite life below the endurance limit',
  'modified Goodman line for the mean stress; first-cycle yield checked with the fatigue notch factor',
  'mass of the collar and neck cylinders',
  FATIGUE_SOURCE_NOTE,
])
