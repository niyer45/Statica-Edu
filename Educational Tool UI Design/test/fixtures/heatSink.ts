import fc from 'fast-check'
import heatSinkJson from '../../src/challenge/challenges/heat-sink-1.json'
import { loadHeatSinkChallenge } from '../../src/challenge/heatSink/loader'
import type { HeatSinkChallenge } from '../../src/challenge/heatSink/types'
import type { HeatSinkConstraintId } from '../../src/evaluation/heatSink/types'
import type { HeatSinkDesign } from '../../src/geometry/heatSink/design'
import type { HeatSinkApplicabilityCode } from '../../src/physics/heatSink/constants'

// Heat Sink I worksheet fixtures (task 48.2; heat-sink-1 design.md "Worksheet"). Every expected
// number is transcribed verbatim from the independently computed worksheet, not calculated
// through the implementation under test. SI units, unrounded. Assert at
// HEAT_SINK_WORKSHEET_REL_TOL (1e-9 relative, HSK-13).

export const HEAT_SINK_WORKSHEET_REL_TOL = 1e-9

export type HeatSinkFixtureStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

export interface HeatSinkFixture {
  name: string
  design: HeatSinkDesign
  expected: {
    // Geometry table.
    finGapM: number
    channelAspectRatio: number
    finAreaM2: number
    exposedBaseAreaM2: number
    totalAreaM2: number
    mLc: number
    finBiotNumber: number
    // Thermal results table.
    finEfficiency: number
    overallEfficiency: number
    convectionResistanceKPerW: number
    baseTemperatureK: number
    baseTemperatureC: number
    baseTemperatureRiseK: number
    massKg: number
    status: HeatSinkFixtureStatus
    /** Failed constraints, in the fixed constraint order. */
    failures: readonly HeatSinkConstraintId[]
    warningCodes: readonly HeatSinkApplicabilityCode[]
    notApplicableCodes: readonly HeatSinkApplicabilityCode[]
    /** Corrected-length (model) fin heat / exact convective-tip fin heat − 1, quoted to 3 significant figures. */
    correctedLengthError: number
  }
}

/** The bundled-format (unlinked) Heat Sink I config, loaded and frozen. Throws if it fails. */
export function heatSinkChallenge(): HeatSinkChallenge {
  const loaded = loadHeatSinkChallenge(heatSinkJson)
  if (!loaded.ok) throw new Error(`heat-sink-1 failed to load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}

// The locked material comes from the config so fixtures always pass the locked-field check.
const MATERIAL_ID: string = heatSinkJson.material.id

export function heatSink(id: string, finCount: number, finThicknessM: number, finHeightM: number): HeatSinkDesign {
  return { id, finCount, finThicknessM, finHeightM, materialId: MATERIAL_ID }
}

/** Worksheet input: R_base = t_b/(k W D) in every row, K/W. */
export const WORKSHEET_BASE_RESISTANCE_K_PER_W = 0.00555555555555556

const row = (
  name: string,
  [N, t, H]: [number, number, number],
  expected: HeatSinkFixture['expected'],
): HeatSinkFixture => ({ name, design: heatSink(name, N, t, H), expected })

export const HEAT_SINK_WORKSHEET: readonly HeatSinkFixture[] = [
  // Challenge v2 baseline (task 59): three thick, tall fins that fail base temperature, mass and
  // fin height, the most checks any applicable in-range design fails. Values from an independent
  // calculation of the same worksheet equations (it reproduces the shortFins row exactly).
  row('baseline', [3, 0.005, 0.04], {
    finGapM: 0.0225, channelAspectRatio: 1.77777777777778, finAreaM2: 0.0051, exposedBaseAreaM2: 0.0027, totalAreaM2: 0.018,
    mLc: 0.300520382004283, finBiotNumber: 3.125e-4,
    finEfficiency: 0.970944995769534, overallEfficiency: 0.975303246404104, convectionResistanceKPerW: 2.27849361766758,
    baseTemperatureK: 355.251229330578, baseTemperatureC: 82.1012293305784, baseTemperatureRiseK: 57.1012293305784, massKg: 0.13608,
    status: 'notAccepted', failures: ['baseTemperature', 'mass', 'finHeight'], warningCodes: [], notApplicableCodes: [],
    correctedLengthError: -5.77e-6,
  }),
  // The challenge v1 baseline (four short 3 mm fins), kept as a worksheet row.
  row('shortFins', [4, 0.003, 0.015], {
    finGapM: 0.016, channelAspectRatio: 0.9375, finAreaM2: 0.00198, exposedBaseAreaM2: 0.00288, totalAreaM2: 0.0108,
    mLc: 0.150623703313921, finBiotNumber: 1.875e-4,
    finEfficiency: 0.992505505199928, overallEfficiency: 0.994504037146614, convectionResistanceKPerW: 3.72417161254589,
    baseTemperatureK: 391.393179202536, baseTemperatureC: 118.243179202536, baseTemperatureRiseK: 93.2431792025361, massKg: 0.06804,
    status: 'notAccepted', failures: ['baseTemperature'], warningCodes: [], notApplicableCodes: [],
    correctedLengthError: -5.60e-6,
  }),
  row('reference', [10, 0.0015, 0.035], {
    finGapM: 0.005, channelAspectRatio: 7, finAreaM2: 0.00429, exposedBaseAreaM2: 0.0027, totalAreaM2: 0.0456,
    mLc: 0.461530515423051, finBiotNumber: 9.375e-5,
    finEfficiency: 0.934566161312288, overallEfficiency: 0.938440533339849, convectionResistanceKPerW: 0.934734755471683,
    baseTemperatureK: 321.657257775681, baseTemperatureC: 48.507257775681, baseTemperatureRiseK: 23.507257775681, massKg: 0.12393,
    status: 'accepted', failures: [], warningCodes: [], notApplicableCodes: [],
    correctedLengthError: -5.71e-7,
  }),
  row('eightFins', [8, 0.002, 0.030], {
    finGapM: 0.00628571428571429, channelAspectRatio: 4.77272727272727, finAreaM2: 0.00372, exposedBaseAreaM2: 0.00264, totalAreaM2: 0.0324,
    mLc: 0.346590536512467, finBiotNumber: 1.25e-4,
    finEfficiency: 0.96179312891893, overallEfficiency: 0.964906281377388, convectionResistanceKPerW: 1.27946923453772,
    baseTemperatureK: 330.275619752332, baseTemperatureC: 57.125619752332, baseTemperatureRiseK: 32.125619752332, massKg: 0.11664,
    status: 'notAccepted', failures: ['baseTemperature'], warningCodes: [], notApplicableCodes: [],
    correctedLengthError: -1.24e-6,
  }),
  row('thickerFins', [10, 0.002, 0.035], {
    finGapM: 0.00444444444444444, channelAspectRatio: 7.875, finAreaM2: 0.00432, exposedBaseAreaM2: 0.0024, totalAreaM2: 0.0456,
    mLc: 0.402492235949962, finBiotNumber: 1.25e-4,
    finEfficiency: 0.949283887008468, overallEfficiency: 0.951953156113286, convectionResistanceKPerW: 0.921466541523553,
    baseTemperatureK: 321.325552426978, baseTemperatureC: 48.1755524269777, baseTemperatureRiseK: 23.1755524269777, massKg: 0.15228,
    status: 'notAccepted', failures: ['mass'], warningCodes: [], notApplicableCodes: [],
    correctedLengthError: -1.04e-6,
  }),
  row('thickFins', [8, 0.004, 0.035], {
    finGapM: 0.004, channelAspectRatio: 8.75, finAreaM2: 0.00444, exposedBaseAreaM2: 0.00168, totalAreaM2: 0.0372,
    mLc: 0.292510683565575, finBiotNumber: 2.5e-4,
    finEfficiency: 0.972422619416602, overallEfficiency: 0.973668049507465, convectionResistanceKPerW: 1.10434846634665,
    baseTemperatureK: 325.897600547555, baseTemperatureC: 52.7476005475551, baseTemperatureRiseK: 27.7476005475551, massKg: 0.22032,
    // The gap is exactly at the 4 mm limit and passes inclusively.
    status: 'notAccepted', failures: ['mass'], warningCodes: ['CHANNEL_ASPECT'], notApplicableCodes: [],
    correctedLengthError: -4.26e-6,
  }),
  row('acceptedWarning', [12, 0.001, 0.035], {
    finGapM: 0.00436363636363636, channelAspectRatio: 8.02083333333333, finAreaM2: 0.00426, exposedBaseAreaM2: 0.00288, totalAreaM2: 0.054,
    mLc: 0.561304284679887, finBiotNumber: 6.25e-5,
    finEfficiency: 0.906717677316845, overallEfficiency: 0.911692734526613, convectionResistanceKPerW: 0.812489463487238,
    baseTemperatureK: 318.60112547607, baseTemperatureC: 45.4511254760698, baseTemperatureRiseK: 20.4511254760698, massKg: 0.10692,
    status: 'accepted', failures: [], warningCodes: ['CHANNEL_ASPECT'], notApplicableCodes: [],
    correctedLengthError: -2.40e-7,
  }),
  row('tallFins', [8, 0.0015, 0.045], {
    finGapM: 0.00685714285714286, channelAspectRatio: 6.5625, finAreaM2: 0.00549, exposedBaseAreaM2: 0.00288, totalAreaM2: 0.0468,
    mLc: 0.590629960296631, finBiotNumber: 9.375e-5,
    finEfficiency: 0.897937060559815, overallEfficiency: 0.904217856833057, convectionResistanceKPerW: 0.945237752431,
    baseTemperatureK: 321.919832699664, baseTemperatureC: 48.7698326996639, baseTemperatureRiseK: 23.7698326996639, massKg: 0.12636,
    status: 'notAccepted', failures: ['finHeight'], warningCodes: [], notApplicableCodes: [],
    correctedLengthError: -4.10e-7,
  }),
  row('denseFins', [14, 0.001, 0.035], {
    finGapM: 0.00353846153846154, channelAspectRatio: 9.89130434782609, finAreaM2: 0.00426, exposedBaseAreaM2: 0.00276, totalAreaM2: 0.0624,
    mLc: 0.561304284679887, finBiotNumber: 6.25e-5,
    finEfficiency: 0.906717677316845, overallEfficiency: 0.910843626204753, convectionResistanceKPerW: 0.703771341845611,
    baseTemperatureK: 315.883172435029, baseTemperatureC: 42.7331724350291, baseTemperatureRiseK: 17.7331724350292, massKg: 0.11826,
    status: 'notAccepted', failures: ['finGap'], warningCodes: ['CHANNEL_ASPECT'], notApplicableCodes: [],
    correctedLengthError: -2.40e-7,
  }),
  row('gapWarning', [16, 0.001, 0.030], {
    finGapM: 0.00293333333333333, channelAspectRatio: 10.2272727272727, finAreaM2: 0.00366, exposedBaseAreaM2: 0.00264, totalAreaM2: 0.0612,
    mLc: 0.482247343175678, finBiotNumber: 6.25e-5,
    finEfficiency: 0.929070180640558, overallEfficiency: 0.932129898338416, convectionResistanceKPerW: 0.70118421521175,
    baseTemperatureK: 315.818494269183, baseTemperatureC: 42.6684942691826, baseTemperatureRiseK: 17.6684942691826, massKg: 0.11664,
    status: 'notAccepted', failures: ['finGap'], warningCodes: ['FIN_GAP', 'CHANNEL_ASPECT'], notApplicableCodes: [],
    correctedLengthError: -2.94e-7,
  }),
  row('tooDense', [19, 0.0015, 0.010], {
    finGapM: 0.00175, channelAspectRatio: 5.71428571428571, finAreaM2: 0.00129, exposedBaseAreaM2: 0.00189, totalAreaM2: 0.0264,
    mLc: 0.138781903239099, finBiotNumber: 9.375e-5,
    finEfficiency: 0.993628940318814, overallEfficiency: 0.994085050273262, convectionResistanceKPerW: 1.52416688565532,
    baseTemperatureK: 336.393061030272, baseTemperatureC: 63.243061030272, baseTemperatureRiseK: 38.243061030272, massKg: 0.08505,
    // The model does not apply (FIN_GAP); temperature, gap and applicability all fail.
    status: 'modelNotApplicable', failures: ['baseTemperature', 'finGap', 'applicability'], warningCodes: [], notApplicableCodes: ['FIN_GAP'],
    correctedLengthError: -2.15e-6,
  }),
  row('deepChannels', [14, 0.001, 0.045], {
    finGapM: 0.00353846153846154, channelAspectRatio: 12.7173913043478, finAreaM2: 0.00546, exposedBaseAreaM2: 0.00276, totalAreaM2: 0.0792,
    mLc: 0.719418167688306, finBiotNumber: 6.25e-5,
    finEfficiency: 0.857010291005542, overallEfficiency: 0.861993265712924, convectionResistanceKPerW: 0.58591003565764,
    baseTemperatureK: 312.93663978033, baseTemperatureC: 39.7866397803299, baseTemperatureRiseK: 14.7866397803299, massKg: 0.14094,
    // The model does not apply (CHANNEL_ASPECT only); mass, height, gap and applicability fail.
    status: 'modelNotApplicable', failures: ['mass', 'finHeight', 'finGap', 'applicability'], warningCodes: [], notApplicableCodes: ['CHANNEL_ASPECT'],
    correctedLengthError: -1.66e-7,
  }),
]

export function worksheetFixture(name: string): HeatSinkFixture {
  const f = HEAT_SINK_WORKSHEET.find((x) => x.name === name)
  if (!f) throw new Error(`unknown heat sink fixture ${name}`)
  return f
}

/** Derived targets (worksheet "Derived targets and solvability"). */
export const HEAT_SINK_DERIVED = {
  /** Prediction fixture: v2 baseline → reference base temperature rise ratio (a decrease). */
  baselineToReferenceRiseRatio: 0.411676912235803,
  /** Prediction fixture: shortFins (the v1 baseline) → reference rise ratio (a decrease). */
  shortFinsToReferenceRiseRatio: 0.252106995672254,
  /** Reference fin parameter, 1/m. */
  referenceFinParameterPerM: 12.9099444873581,
  /** Reference corrected length, m. */
  referenceCorrectedLengthM: 0.03575,
  /** Reference fin root excess θ_b, K. */
  referenceRootExcessK: 23.3683688867921,
  /** Reference profile at x/H = 0, 0.25, 0.5, 0.75, 1. */
  referenceProfile: [
    { xOverH: 0, excessRatio: 1, temperatureK: 321.518368886792 },
    { xOverH: 0.25, excessRatio: 0.95755931029089, temperatureK: 320.52659919386 },
    { xOverH: 0.5, excessRatio: 0.927350475032907, temperatureK: 319.820667987911 },
    { xOverH: 0.75, excessRatio: 0.908987606822482, temperatureK: 319.39155770975 },
    { xOverH: 1, excessRatio: 0.902236138537931, temperatureK: 319.233786908349 },
  ],
  /** Tip excess ratios θ(H)/θ_b for other rows. */
  tipRatios: { baseline: 0.956632239814936, shortFins: 0.98885520147097, acceptedWarning: 0.860826225361443, deepChannels: 0.787341319087578 },
  /** Grid enumeration (N 2–20, t 1.0–5.0 mm by 0.5, H 5–45 mm by 1). */
  grid: { valid: 5289, accepted: 80, notAccepted: 3894, modelNotApplicable: 1315 },
  /** With N = 7 at H = 35 mm the best base temperature over all thicknesses, °C. */
  sevenFinsBestTemperatureC: 56.115991901609,
  /**
   * Designs with t ≥ 2.5 mm that meet temperature, height and gap: the worksheet count (designs
   * with s strictly above 4 mm; see the worksheet test) and the minimum mass (g).
   */
  thickFinsMeetingOthers: { count: 23, minMassG: 144.585 },
  /** reference → thickerFins: T_base drop (K, quoted to 8 decimals) and mass added (g). */
  thickerTrade: { temperatureDropK: 0.33170535, massAddedG: 28.35 },
  /** Fin heat share N η_f h A_f θ_b / Q. */
  finHeatShare: { baseline: 0.846201680807438, shortFins: 0.731859643896696, reference: 0.936905404005661 },
} as const

/** |actual − expected| ≤ rel · |expected|. */
export function relClose(actual: number, expected: number, rel: number = HEAT_SINK_WORKSHEET_REL_TOL): boolean {
  return Math.abs(actual - expected) <= rel * Math.abs(expected)
}

/** Grid value min + k·step quantized to whole nanometres (equals the decimal literal). */
const gridValue = (minM: number, stepM: number, k: number): number => Math.round((minM + k * stepM) * 1e9) / 1e9

/**
 * Valid-by-construction designs for `ch`: any fin count, any on-step thickness whose gap stays at
 * or above the geometric floor for that count, and any on-step height (range edges included).
 */
export function arbHeatSinkDesign(ch: HeatSinkChallenge): fc.Arbitrary<HeatSinkDesign> {
  const L = ch.designLimits
  const W = ch.base.widthM
  const g = L.minGeometricGapM
  const tSteps = Math.round((L.finThicknessM.maxM - L.finThicknessM.minM) / L.finThicknessM.stepM)
  const hSteps = Math.round((L.finHeightM.maxM - L.finHeightM.minM) / L.finHeightM.stepM)
  return fc.integer({ min: L.finCount.min, max: L.finCount.max }).chain((N) => {
    let kMax = tSteps
    while (kMax > 0 && (W - N * gridValue(L.finThicknessM.minM, L.finThicknessM.stepM, kMax)) / (N - 1) < g) kMax--
    return fc
      .tuple(fc.integer({ min: 0, max: kMax }), fc.integer({ min: 0, max: hSteps }))
      .map(([kt, kh]) =>
        heatSink('d', N, gridValue(L.finThicknessM.minM, L.finThicknessM.stepM, kt), gridValue(L.finHeightM.minM, L.finHeightM.stepM, kh)),
      )
  })
}

/** Every on-grid (N, t, H) combination of the configured ranges, valid or not. */
export function gridDesigns(ch: HeatSinkChallenge): HeatSinkDesign[] {
  const L = ch.designLimits
  const tSteps = Math.round((L.finThicknessM.maxM - L.finThicknessM.minM) / L.finThicknessM.stepM)
  const hSteps = Math.round((L.finHeightM.maxM - L.finHeightM.minM) / L.finHeightM.stepM)
  const out: HeatSinkDesign[] = []
  for (let N = L.finCount.min; N <= L.finCount.max; N++) {
    for (let kt = 0; kt <= tSteps; kt++) {
      for (let kh = 0; kh <= hSteps; kh++) {
        out.push(heatSink(`g-${N}-${kt}-${kh}`, N, gridValue(L.finThicknessM.minM, L.finThicknessM.stepM, kt), gridValue(L.finHeightM.minM, L.finHeightM.stepM, kh)))
      }
    }
  }
  return out
}
