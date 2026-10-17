import fc from 'fast-check'
import mountingBracketJson from '../../src/challenge/challenges/mounting-bracket-1.json'
import { loadBracketChallenge } from '../../src/challenge/bracket/loader'
import type { BracketChallenge } from '../../src/challenge/bracket/types'
import type { BracketConstraintId } from '../../src/evaluation/bracket/types'
import type { BracketDesign } from '../../src/geometry/bracket/design'
import type { BracketApplicabilityCode } from '../../src/physics/bracket/constants'
import type { BracketPeakLocation } from '../../src/physics/bracket/types'

// Mounting Bracket I worksheet fixtures (task 46.2; mounting-bracket-1 design.md "Worksheet",
// "K-4 fixtures", "Derived targets" and the Kt transcription record). Every expected number is
// transcribed verbatim from the independently computed worksheet, not calculated through the
// implementation under test. SI units, unrounded. Assert at BRACKET_WORKSHEET_REL_TOL (1e-9
// relative, MBR-17). Absent keys mean "absent in the analysis" for step terms, or "not quoted by
// the worksheet" where marked.

export const BRACKET_WORKSHEET_REL_TOL = 1e-9

export type BracketFixtureStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

export interface BracketFixture {
  name: string
  design: BracketDesign
  expected: {
    /** σ_root. Not quoted for the K-4 fixtures. */
    rootStressPa?: number
    /** σ_step,nom; absent (and asserted absent) for uniform bars. */
    stepNominalStressPa?: number
    /** Kt; absent for uniform bars and outside the fit range. */
    kt?: number
    /** σ_step = Kt σ_step,nom. */
    stepPeakStressPa?: number
    /** σ_peak; absent only when the Kt fit is undefined. */
    peakStressPa?: number
    peakLocation?: BracketPeakLocation
    /** σ_peak / σ_y. */
    plasticityRatio?: number
    tipDeflectionM?: number
    massKg?: number
    /** h / r, D / d and the KT_SHOULDER_LENGTH metric; absent for uniform bars. */
    heightToRadiusRatio?: number
    stepRatio?: number
    shoulderMetric?: number
    /** True when the worksheet row says the Kt fit is undefined (peak, Kt and step peak absent). */
    ktUndefined?: boolean
    /** True for d = D: every step term is absent. */
    uniform?: boolean
    status: BracketFixtureStatus
    /** Failed constraints, in the fixed constraint order. */
    failures: readonly BracketConstraintId[]
    warningCodes: readonly BracketApplicabilityCode[]
    notApplicableCodes: readonly BracketApplicabilityCode[]
  }
}

/** The bundled-format (unlinked) Mounting Bracket I config, loaded and frozen. Throws if it fails. */
export function bracketChallenge(): BracketChallenge {
  const loaded = loadBracketChallenge(mountingBracketJson)
  if (!loaded.ok) throw new Error(`mounting-bracket-1 failed to load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}

// The locked material comes from the config so fixtures always pass the locked-field check.
const MATERIAL_ID: string = mountingBracketJson.material.id

/** A bracket design from D, d, a, r in metres. */
export function bracket(id: string, rootDepthM: number, armDepthM: number, stepLocationM: number, filletRadiusM: number): BracketDesign {
  return { id, rootDepthM, armDepthM, stepLocationM, filletRadiusM, materialId: MATERIAL_ID }
}

const row = (name: string, dims: [number, number, number, number], expected: BracketFixture['expected']): BracketFixture => ({
  name,
  design: bracket(name, ...dims),
  expected,
})

export const BRACKET_WORKSHEET: readonly BracketFixture[] = [
  row('baseline', [0.03, 0.02, 0.15, 0.001], {
    rootStressPa: 60000000,
    stepNominalStressPa: 67500000,
    kt: 2.33927144795256,
    stepPeakStressPa: 157900822.736798,
    peakStressPa: 157900822.736798,
    peakLocation: 'step',
    plasticityRatio: 0.657920094736658,
    tipDeflectionM: 0.0022554347826087,
    massKg: 0.2025,
    heightToRadiusRatio: 5,
    stepRatio: 1.5,
    shoulderMetric: 0.38975,
    status: 'notAccepted',
    failures: ['peakStress'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('reference', [0.03, 0.02, 0.175, 0.003], {
    rootStressPa: 60000000,
    stepNominalStressPa: 56250000,
    kt: 1.61457742912574,
    stepPeakStressPa: 90819980.3883229,
    peakStressPa: 90819980.3883229,
    peakLocation: 'step',
    plasticityRatio: 0.378416584951346,
    tipDeflectionM: 0.00203791767310789,
    massKg: 0.20925,
    heightToRadiusRatio: 1.66666666666667,
    stepRatio: 1.5,
    shoulderMetric: 0.298928571428571,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('filletOnly', [0.03, 0.02, 0.15, 0.0025], {
    rootStressPa: 60000000,
    stepNominalStressPa: 67500000,
    kt: 1.70018315638838,
    stepPeakStressPa: 114762363.056215,
    peakStressPa: 114762363.056215,
    peakLocation: 'step',
    plasticityRatio: 0.478176512734231,
    tipDeflectionM: 0.0022554347826087,
    massKg: 0.2025,
    // Lower branch; computed 1.9999999999999996.
    heightToRadiusRatio: 2,
    stepRatio: 1.5,
    shoulderMetric: 0.359,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('stepOnly', [0.03, 0.02, 0.19, 0.001], {
    rootStressPa: 60000000,
    stepNominalStressPa: 49500000,
    kt: 2.33927144795256,
    stepPeakStressPa: 115793936.673652,
    peakStressPa: 115793936.673652,
    peakLocation: 'step',
    plasticityRatio: 0.482474736140216,
    tipDeflectionM: 0.00194274557165862,
    massKg: 0.2133,
    heightToRadiusRatio: 5,
    stepRatio: 1.5,
    shoulderMetric: 0.307697368421053,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('thickAll', [0.034, 0.024, 0.15, 0.001], {
    rootStressPa: 46712802.7681661,
    stepNominalStressPa: 46875000,
    kt: 2.43210519738864,
    stepPeakStressPa: 114004931.127592,
    peakStressPa: 114004931.127592,
    peakLocation: 'step',
    plasticityRatio: 0.475020546364969,
    tipDeflectionM: 0.0014699556246073,
    massKg: 0.2349,
    heightToRadiusRatio: 5,
    stepRatio: 1.41666666666667,
    shoulderMetric: 0.445588888888889,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: ['DEPTH_SPAN'],
    notApplicableCodes: [],
  }),
  row('uniformDeep', [0.03, 0.03, 0.15, 0.001], {
    rootStressPa: 60000000,
    peakStressPa: 60000000,
    peakLocation: 'root',
    plasticityRatio: 0.25,
    tipDeflectionM: 0.00173913043478261,
    massKg: 0.243,
    uniform: true,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('uniformLimit', [0.027, 0.027, 0.15, 0.001], {
    rootStressPa: 74074074.0740741,
    peakStressPa: 74074074.0740741,
    peakLocation: 'root',
    plasticityRatio: 0.308641975308642,
    tipDeflectionM: 0.00238563845649192,
    massKg: 0.2187,
    uniform: true,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('rootGoverned', [0.028, 0.024, 0.17, 0.004], {
    rootStressPa: 68877551.0204082,
    stepNominalStressPa: 40625000,
    kt: 1.48864636949367,
    stepPeakStressPa: 60476258.7606805,
    peakStressPa: 68877551.0204082,
    peakLocation: 'root',
    plasticityRatio: 0.286989795918367,
    tipDeflectionM: 0.00224139265350723,
    massKg: 0.21276,
    heightToRadiusRatio: 0.5,
    stepRatio: 1.16666666666667,
    shoulderMetric: 0.281578431372549,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('rootToStep', [0.028, 0.024, 0.17, 0.001], {
    rootStressPa: 68877551.0204082,
    stepNominalStressPa: 40625000,
    kt: 2.09256387601359,
    stepPeakStressPa: 85010407.463052,
    peakStressPa: 85010407.463052,
    peakLocation: 'step',
    plasticityRatio: 0.35421003109605,
    tipDeflectionM: 0.00224139265350723,
    massKg: 0.21276,
    // Exact; lower branch.
    heightToRadiusRatio: 2,
    stepRatio: 1.16666666666667,
    shoulderMetric: 0.32378431372549,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('ratioWarning', [0.032, 0.02, 0.15, 0.003], {
    rootStressPa: 52734375,
    stepNominalStressPa: 67500000,
    kt: 1.61528593463814,
    stepPeakStressPa: 109031800.588074,
    peakStressPa: 109031800.588074,
    peakLocation: 'step',
    plasticityRatio: 0.454299169116976,
    tipDeflectionM: 0.00198757005774456,
    massKg: 0.2106,
    // Lower branch.
    heightToRadiusRatio: 2,
    stepRatio: 1.6,
    shoulderMetric: 0.372,
    status: 'accepted',
    failures: [],
    warningCodes: ['KT_STEP_RATIO', 'DEPTH_SPAN'],
    notApplicableCodes: [],
  }),
  row('ratioNA', [0.034, 0.02, 0.15, 0.003], {
    rootStressPa: 46712802.7681661,
    stepNominalStressPa: 67500000,
    kt: 1.67829015445689,
    stepPeakStressPa: 113284585.42584,
    peakStressPa: 113284585.42584,
    peakLocation: 'step',
    plasticityRatio: 0.472019105941,
    tipDeflectionM: 0.00177905888547686,
    massKg: 0.2187,
    heightToRadiusRatio: 2.33333333333333,
    stepRatio: 1.7,
    shoulderMetric: 0.39525,
    status: 'modelNotApplicable',
    failures: ['mass', 'applicability'],
    warningCodes: ['DEPTH_SPAN'],
    notApplicableCodes: ['KT_STEP_RATIO'],
  }),
  row('fitShallowNA', [0.03, 0.0295, 0.15, 0.005], {
    rootStressPa: 60000000,
    stepNominalStressPa: 31025567.3656995,
    tipDeflectionM: 0.00175037264086735,
    massKg: 0.240975,
    // Computed 0.0499999999999997.
    heightToRadiusRatio: 0.05,
    stepRatio: 1.01694915254237,
    shoulderMetric: 0.340758474576271,
    ktUndefined: true,
    status: 'modelNotApplicable',
    // peakStress is unevaluated and does not pass (MBR-08).
    failures: ['peakStress', 'mass', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['KT_FIT_SHALLOW', 'KT_SMALL_STEP'],
  }),
  row('shoulderNA', [0.04, 0.03, 0.06, 0.001], {
    rootStressPa: 33750000,
    stepNominalStressPa: 48000000,
    kt: 2.53648754078688,
    stepPeakStressPa: 121751401.95777,
    peakStressPa: 121751401.95777,
    peakLocation: 'step',
    plasticityRatio: 0.507297508157376,
    tipDeflectionM: 0.00124847826086957,
    massKg: 0.2592,
    heightToRadiusRatio: 5,
    stepRatio: 1.33333333333333,
    shoulderMetric: 1.32194444444444,
    status: 'modelNotApplicable',
    // Envelope 40 mm equals its limit and passes (inclusive).
    failures: ['peakStress', 'mass', 'applicability'],
    warningCodes: ['DEPTH_SPAN'],
    notApplicableCodes: ['KT_SHOULDER_LENGTH'],
  }),
  row('plasticWarning', [0.03, 0.02, 0.15, 0.0005], {
    rootStressPa: 60000000,
    stepNominalStressPa: 67500000,
    kt: 2.89887763615108,
    stepPeakStressPa: 195674240.440198,
    peakStressPa: 195674240.440198,
    peakLocation: 'step',
    plasticityRatio: 0.815309335167492,
    tipDeflectionM: 0.0022554347826087,
    massKg: 0.2025,
    heightToRadiusRatio: 10,
    stepRatio: 1.5,
    shoulderMetric: 0.4,
    status: 'notAccepted',
    failures: ['peakStress'],
    warningCodes: ['PLASTICITY'],
    notApplicableCodes: [],
  }),
  row('plasticNA', [0.024, 0.016, 0.15, 0.0005], {
    rootStressPa: 93750000,
    stepNominalStressPa: 105468750,
    kt: 2.71274036284062,
    stepPeakStressPa: 286109335.143346,
    peakStressPa: 286109335.143346,
    peakLocation: 'step',
    plasticityRatio: 1.19212222976394,
    tipDeflectionM: 0.00440514605978261,
    massKg: 0.162,
    heightToRadiusRatio: 8,
    stepRatio: 1.5,
    shoulderMetric: 0.31795,
    status: 'modelNotApplicable',
    failures: ['peakStress', 'tipDeflection', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['PLASTICITY'],
  }),
  row('oversize', [0.045, 0.03, 0.15, 0.003], {
    rootStressPa: 26666666.6666667,
    stepNominalStressPa: 30000000,
    kt: 1.86203141066813,
    stepPeakStressPa: 55860942.320044,
    peakStressPa: 55860942.320044,
    peakLocation: 'step',
    plasticityRatio: 0.232753926333517,
    tipDeflectionM: 0.000668276972624799,
    massKg: 0.30375,
    heightToRadiusRatio: 2.5,
    stepRatio: 1.5,
    shoulderMetric: 0.553875,
    status: 'notAccepted',
    failures: ['mass', 'envelopeDepth'],
    warningCodes: ['DEPTH_SPAN'],
    notApplicableCodes: [],
  }),
  // K-4 fixtures (coordinator, standalone script). Only the quoted values are asserted.
  row('smallStepNA', [0.03, 0.028, 0.15, 0.001], {
    kt: 1.86101007407407,
    peakStressPa: 64090908.1632653,
    tipDeflectionM: 0.00178912092787426,
    massKg: 0.2349,
    heightToRadiusRatio: 1,
    stepRatio: 1.07142857142857,
    status: 'modelNotApplicable',
    failures: ['mass', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['KT_SMALL_STEP'],
  }),
  row('smallStepBoundary', [0.033, 0.03, 0.15, 0.001], {
    kt: 2.0233540715698,
    peakStressPa: 60700622.1470941,
    // D/d = 1.1, inclusive under REL_TOL: no KT_SMALL_STEP issue.
    stepRatio: 1.1,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: ['DEPTH_SPAN'],
    notApplicableCodes: [],
  }),
]

export function worksheetFixture(name: string): BracketFixture {
  const f = BRACKET_WORKSHEET.find((x) => x.name === name)
  if (!f) throw new Error(`unknown bracket fixture ${name}`)
  return f
}

/** Branch-boundary references: Kt with the upper branch instead (worksheet). */
export const BRACKET_UPPER_BRANCH_KT: Readonly<Record<string, number>> = Object.freeze({
  filletOnly: 1.72959240364253,
  rootToStep: 2.09464015921861,
  ratioWarning: 1.65721825357834,
})

/** Derived targets (worksheet "Derived targets"). */
export const BRACKET_DERIVED = {
  /** Uniform depth meeting the deflection limit, m. */
  uniformDeflectionDepthM: 0.0269460364293674,
  /** Mass of that uniform bar, above 0.215 kg, kg. */
  uniformDeflectionMassKg: 0.218262895077876,
  /** Largest uniform depth within the mass limit, m. */
  uniformMassDepthM: 0.0265432098765432,
  /** Uniform depth meeting the stress limit alone, m. */
  uniformStressDepthM: 0.0212132034355964,
  /** Smallest passing fillet radius at a = 150 mm (from the baseline), m. */
  minPassingRadiusM: 0.0025,
  /** Smallest passing step location at r = 1 mm (from the baseline), m. */
  minPassingStepM: 0.19,
  /** Prediction fixture: baseline → reference peak stress ratio (a decrease). */
  baselineToReferencePeakRatio: 0.575171039733651,
  /** Both fillets add at most 2 b ρ r² (1 − π/4) at r = 10 mm, g. */
  maxFilletMassG: 1.15884991765378,
} as const

/** Kt fit vs external worked values (design.md sources 3 and 4), asserted at 1e-3 relative. */
export const BRACKET_KT_EXTERNAL = [
  // EES worked example: H = 0.24 m, shoulder depth t = 0.025 m (= h), r = 0.075 m.
  { name: 'EES', D: 0.24, d: 0.24 - 2 * 0.025, r: 0.075, published: 1.318, fit: 1.31786431300713 },
  // Mechsimulator: r/h = 0.1, D/d = 1.5.
  { name: 'Mechsimulator', D: 0.03, d: 0.02, r: 0.0005, published: 2.9, fit: 2.89887763615108 },
] as const

/** Digitized Peterson 1951 chart readings (Shigley Fig. A–15–6) and the quoted fit (4 decimals). */
export const BRACKET_KT_CHART: readonly { stepRatio: number; rOverD: number; hOverR: number; chart: number; fit: number }[] = [
  { stepRatio: 1.3, rOverD: 0.03, hOverR: 5, chart: 2.507, fit: 2.5819 },
  { stepRatio: 1.3, rOverD: 0.05, hOverR: 3, chart: 2.17, fit: 2.1893 },
  { stepRatio: 1.3, rOverD: 0.1, hOverR: 1.5, chart: 1.742, fit: 1.7555 },
  { stepRatio: 1.3, rOverD: 0.15, hOverR: 1, chart: 1.564, fit: 1.5838 },
  { stepRatio: 1.3, rOverD: 0.2, hOverR: 0.75, chart: 1.463, fit: 1.4876 },
  { stepRatio: 1.3, rOverD: 0.25, hOverR: 0.6, chart: 1.404, fit: 1.4244 },
  { stepRatio: 1.1, rOverD: 0.05, hOverR: 1, chart: 1.909, fit: 1.8174 },
  { stepRatio: 1.1, rOverD: 0.1, hOverR: 0.5, chart: 1.599, fit: 1.5597 },
  { stepRatio: 1.1, rOverD: 0.2, hOverR: 0.25, chart: 1.409, fit: 1.3846 },
  // Recorded for review only, not asserted against the chart (design.md (c)).
  { stepRatio: 3, rOverD: 0.05, hOverR: 20, chart: 2.43, fit: 2.4249 },
  { stepRatio: 3, rOverD: 0.1, hOverR: 10, chart: 1.904, fit: 1.9512 },
  { stepRatio: 3, rOverD: 0.2, hOverR: 5, chart: 1.517, fit: 1.587 },
  { stepRatio: 1.05, rOverD: 0.05, hOverR: 0.5, chart: 1.79, fit: 1.6227 },
  { stepRatio: 1.05, rOverD: 0.1, hOverR: 0.25, chart: 1.535, fit: 1.4341 },
  { stepRatio: 1.02, rOverD: 0.05, hOverR: 0.2, chart: 1.642, fit: 1.4181 },
  { stepRatio: 1.02, rOverD: 0.1, hOverR: 0.1, chart: 1.424, fit: 1.2948 },
]

/** Stated tolerance for digitized-chart comparisons (D/d = 1.1 and 1.3 rows), relative. */
export const BRACKET_CHART_REL_TOL = 0.05

/** |actual − expected| ≤ rel · |expected|. */
export function relClose(actual: number, expected: number, rel: number = BRACKET_WORKSHEET_REL_TOL): boolean {
  return Math.abs(actual - expected) <= rel * Math.abs(expected)
}

/** Finite double in [lo, hi] (inclusive). */
const between = (lo: number, hi: number): fc.Arbitrary<number> =>
  fc.double({ min: lo, max: hi, noNaN: true, noDefaultInfinity: true })

/**
 * Valid-by-construction bracket designs for `ch`: stepped bars (d < D, range edges included)
 * and uniform bars (d = D as stored values) with arbitrary a and r.
 */
export function arbBracketDesign(ch: BracketChallenge): fc.Arbitrary<BracketDesign> {
  const L = ch.designLimits
  const a = between(L.stepLocationM.minM, L.stepLocationM.maxM)
  const r = between(L.filletRadiusM.minM, L.filletRadiusM.maxM)
  const rootD = between(Math.max(L.rootDepthM.minM, L.armDepthM.minM), L.rootDepthM.maxM)
  const stepped = rootD.chain((D) =>
    fc.tuple(between(L.armDepthM.minM, Math.min(L.armDepthM.maxM, D)), a, r).map(([dArm, ai, ri]) => bracket('d', D, dArm, ai, ri)),
  )
  const uniform = fc.tuple(rootD, a, r).map(([D, ai, ri]) => bracket('u', D, D, ai, ri))
  return fc.oneof({ arbitrary: stepped, weight: 4 }, { arbitrary: uniform, weight: 1 })
}

/** Every configured-grid value of a range (index-based, so 0.5 mm steps stay exact multiples). */
export function gridValues(r: { minM: number; maxM: number; stepM: number }): number[] {
  const n = Math.round((r.maxM - r.minM) / r.stepM)
  return Array.from({ length: n + 1 }, (_, i) => Number((r.minM + i * r.stepM).toFixed(6)))
}
