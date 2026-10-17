import fc from 'fast-check'
import vibrationJson from '../../src/challenge/challenges/vibration-isolation-1.json'
import { loadVibrationChallenge } from '../../src/challenge/vibration/loader'
import type { VibrationChallenge } from '../../src/challenge/vibration/types'
import type { VibrationConstraintId } from '../../src/evaluation/vibration/types'
import type { VibrationDesign } from '../../src/geometry/vibration/design'
import type { VibrationApplicabilityCode } from '../../src/physics/vibration/constants'

// Vibration Isolation I worksheet fixtures (task 50.2; vibration-isolation-1 design.md
// "Worksheet"). Every expected number is transcribed verbatim from the independently computed
// worksheet, not calculated through the implementation under test. SI units, unrounded. Assert
// at VIBRATION_WORKSHEET_REL_TOL (1e-9 relative, VIB-13).

export const VIBRATION_WORKSHEET_REL_TOL = 1e-9

export type VibrationFixtureStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

/** Worksheet material ids by ζ, as in the config. */
export const MATERIAL_BY_ZETA = {
  0.02: 'steelSpring',
  0.05: 'naturalRubber',
  0.1: 'neoprene',
  0.2: 'butylRubber',
  0.3: 'highDampingElastomer',
} as const

export type WorksheetZeta = keyof typeof MATERIAL_BY_ZETA

export interface VibrationFixture {
  name: string
  design: VibrationDesign
  expected: {
    naturalFrequencyHz: number
    worstInBandTransmissibility: number
    worstInBandFrequencyHz: number
    peakTransmissibility: number
    staticDeflectionM: number
    peakRelativeDisplacementM: number
    strokeRatio: number
    status: VibrationFixtureStatus
    /** Failed constraints, in the fixed constraint order. */
    failures: readonly VibrationConstraintId[]
    warningCodes: readonly VibrationApplicabilityCode[]
    notApplicableCodes: readonly VibrationApplicabilityCode[]
    /** Secondary outputs, where the worksheet quotes them. */
    secondary?: {
      dampingCoefficientNsPerM: number
      frequencyRatioAtBandMin: number
      frequencyRatioAtBandMax: number
      peakTransmissibilityFrequencyHz: number
      peakRelativeDisplacementFrequencyHz: number
    }
  }
}

/** The bundled-format (unlinked) Vibration Isolation I config, loaded and frozen. Throws if it fails. */
export function vibrationChallenge(): VibrationChallenge {
  const loaded = loadVibrationChallenge(vibrationJson)
  if (!loaded.ok) throw new Error(`vibration-isolation-1 failed to load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}

export function isolator(id: string, stiffnessNPerM: number, zeta: WorksheetZeta): VibrationDesign {
  return { id, stiffnessNPerM, materialId: MATERIAL_BY_ZETA[zeta] }
}

const row = (
  name: string,
  k: number,
  zeta: WorksheetZeta,
  expected: VibrationFixture['expected'],
): VibrationFixture => ({ name, design: isolator(name, k, zeta), expected })

const none: readonly VibrationApplicabilityCode[] = []

export const VIBRATION_WORKSHEET: readonly VibrationFixture[] = [
  row('baseline', 1800000, 0.05, {
    naturalFrequencyHz: 30.1975272626922,
    worstInBandTransmissibility: 10.0622137253413,
    worstInBandFrequencyHz: 30.1226863340461,
    peakTransmissibility: 10.0622137253413,
    staticDeflectionM: 0.000272406944444444,
    peakRelativeDisplacementM: 0.00200250469728704,
    strokeRatio: 0.113745582086574,
    status: 'notAccepted',
    failures: ['worstInBandTransmissibility', 'peakTransmissibility', 'relativeDisplacement'],
    warningCodes: none,
    notApplicableCodes: none,
    secondary: {
      dampingCoefficientNsPerM: 948.683298050514,
      frequencyRatioAtBandMin: 0.827882355483008,
      frequencyRatioAtBandMax: 1.65576471096602,
      peakTransmissibilityFrequencyHz: 30.1226863340461,
      peakRelativeDisplacementFrequencyHz: 30.273305367442,
    },
  }),
  row('reference', 85000, 0.1, {
    naturalFrequencyHz: 6.56212641207052,
    worstInBandTransmissibility: 0.0928814700836484,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 5.12277357963917,
    staticDeflectionM: 0.00576861764705882,
    peakRelativeDisplacementM: 0.00100503781525921,
    strokeRatio: 0.338682773115902,
    status: 'accepted',
    failures: [],
    warningCodes: none,
    notApplicableCodes: none,
    secondary: {
      dampingCoefficientNsPerM: 412.310562561766,
      frequencyRatioAtBandMin: 3.80974068923976,
      frequencyRatioAtBandMax: 7.61948137847952,
      peakTransmissibilityFrequencyHz: 6.49869915762107,
      peakRelativeDisplacementFrequencyHz: 6.62874869282631,
    },
  }),
  row('lightSpring', 85000, 0.02, {
    naturalFrequencyHz: 6.56212641207052,
    worstInBandTransmissibility: 0.0748461642949341,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 25.0249815288429,
    staticDeflectionM: 0.00576861764705882,
    peakRelativeDisplacementM: 0.00500100030010004,
    strokeRatio: 0.538480897357943,
    status: 'notAccepted',
    failures: ['peakTransmissibility', 'relativeDisplacement'],
    warningCodes: none,
    notApplicableCodes: none,
    secondary: {
      dampingCoefficientNsPerM: 82.4621125123532,
      frequencyRatioAtBandMin: 3.80974068923976,
      frequencyRatioAtBandMax: 7.61948137847952,
      peakTransmissibilityFrequencyHz: 6.55950522938173,
      peakRelativeDisplacementFrequencyHz: 6.56475283859637,
    },
  }),
  row('lightRubber', 85000, 0.05, {
    naturalFrequencyHz: 6.56212641207052,
    worstInBandTransmissibility: 0.0791533174164501,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 10.0622137253413,
    staticDeflectionM: 0.00576861764705882,
    peakRelativeDisplacementM: 0.00200250469728704,
    strokeRatio: 0.388556117217293,
    status: 'notAccepted',
    failures: ['peakTransmissibility', 'relativeDisplacement'],
    warningCodes: none,
    notApplicableCodes: none,
    secondary: {
      dampingCoefficientNsPerM: 206.155281280883,
      frequencyRatioAtBandMin: 3.80974068923976,
      frequencyRatioAtBandMax: 7.61948137847952,
      peakTransmissibilityFrequencyHz: 6.54586297333594,
      peakRelativeDisplacementFrequencyHz: 6.5785935054954,
    },
  }),
  row('dampedReference', 85000, 0.2, {
    naturalFrequencyHz: 6.56212641207052,
    worstInBandTransmissibility: 0.134024796888312,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 2.73392111072598,
    staticDeflectionM: 0.00576861764705882,
    peakRelativeDisplacementM: 0.000510310363079829,
    strokeRatio: 0.313946400506933,
    status: 'notAccepted',
    failures: ['worstInBandTransmissibility'],
    warningCodes: none,
    notApplicableCodes: none,
    secondary: {
      dampingCoefficientNsPerM: 824.621125123532,
      frequencyRatioAtBandMin: 3.80974068923976,
      frequencyRatioAtBandMax: 7.61948137847952,
      peakTransmissibilityFrequencyHz: 6.33067795276693,
      peakRelativeDisplacementFrequencyHz: 6.8414897189067,
    },
  }),
  row('heavyAtSag', 61500, 0.3, {
    naturalFrequencyHz: 5.58177964183636,
    worstInBandTransmissibility: 0.148963126967583,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 1.99460800359476,
    staticDeflectionM: 0.00797288617886179,
    peakRelativeDisplacementM: 0.000349428278907306,
    strokeRatio: 0.416115722888455,
    status: 'notAccepted',
    failures: ['worstInBandTransmissibility'],
    warningCodes: none,
    notApplicableCodes: none,
    secondary: {
      dampingCoefficientNsPerM: 1052.14067500501,
      frequencyRatioAtBandMin: 4.47885828609587,
      frequencyRatioAtBandMax: 8.95771657219173,
      peakTransmissibilityFrequencyHz: 5.19208616711956,
      peakRelativeDisplacementFrequencyHz: 6.164044440615,
    },
  }),
  row('heavySoft', 40000, 0.3, {
    naturalFrequencyHz: 4.50158158078553,
    worstInBandTransmissibility: 0.115857999858954,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 1.99460800359476,
    staticDeflectionM: 0.0122583125,
    peakRelativeDisplacementM: 0.000349428278907306,
    strokeRatio: 0.630387038945365,
    status: 'notAccepted',
    failures: ['staticDeflection'],
    warningCodes: none,
    notApplicableCodes: none,
  }),
  row('stiffHeavy', 2000000, 0.3, {
    naturalFrequencyHz: 31.8309886183791,
    worstInBandTransmissibility: 1.99460800359476,
    worstInBandFrequencyHz: 29.6086994284952,
    peakTransmissibility: 1.99460800359476,
    staticDeflectionM: 0.00024516625,
    peakRelativeDisplacementM: 0.000349428278907306,
    strokeRatio: 0.0297297264453653,
    status: 'notAccepted',
    failures: ['worstInBandTransmissibility'],
    warningCodes: none,
    notApplicableCodes: none,
    secondary: {
      dampingCoefficientNsPerM: 6000,
      frequencyRatioAtBandMin: 0.785398163397448,
      frequencyRatioAtBandMax: 1.5707963267949,
      peakTransmissibilityFrequencyHz: 29.6086994284952,
      peakRelativeDisplacementFrequencyHz: 35.1514464959867,
    },
  }),
  row('sagBoundary', 61291.5625, 0.2, {
    naturalFrequencyHz: 5.57231265265523,
    worstInBandTransmissibility: 0.106930788872695,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 2.73392111072598,
    staticDeflectionM: 0.008,
    peakRelativeDisplacementM: 0.000510310363079829,
    strokeRatio: 0.425515518153991,
    status: 'accepted',
    failures: [],
    warningCodes: none,
    notApplicableCodes: none,
    secondary: {
      dampingCoefficientNsPerM: 700.237459723486,
      frequencyRatioAtBandMin: 4.48646756891636,
      frequencyRatioAtBandMax: 8.97293513783272,
      peakTransmissibilityFrequencyHz: 5.37577526565174,
      peakRelativeDisplacementFrequencyHz: 5.80953753855615,
    },
  }),
  row('sagOnGridFail', 61000, 0.2, {
    naturalFrequencyHz: 5.5590431740465,
    worstInBandTransmissibility: 0.106591952520594,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 2.73392111072598,
    staticDeflectionM: 0.00803823770491803,
    peakRelativeDisplacementM: 0.000510310363079829,
    strokeRatio: 0.427427403399893,
    status: 'notAccepted',
    failures: ['staticDeflection'],
    warningCodes: none,
    notApplicableCodes: none,
  }),
  row('isoBoundary', 72649.1928025733, 0.2, {
    naturalFrequencyHz: 6.06667215424451,
    worstInBandTransmissibility: 0.12,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 2.73392111072598,
    staticDeflectionM: 0.00674931793574769,
    peakRelativeDisplacementM: 0.000510310363079829,
    strokeRatio: 0.362981414941376,
    status: 'accepted',
    failures: [],
    warningCodes: none,
    notApplicableCodes: none,
  }),
  row('isoOnGridFail', 73000, 0.2, {
    naturalFrequencyHz: 6.08130183673309,
    worstInBandTransmissibility: 0.120400420753212,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 2.73392111072598,
    staticDeflectionM: 0.00671688356164384,
    peakRelativeDisplacementM: 0.000510310363079829,
    strokeRatio: 0.361359696236183,
    status: 'notAccepted',
    failures: ['worstInBandTransmissibility'],
    warningCodes: none,
    notApplicableCodes: none,
  }),
  row('softWarning', 28000, 0.1, {
    naturalFrequencyHz: 3.76629336482533,
    worstInBandTransmissibility: 0.0385796127287654,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 5.12277357963917,
    staticDeflectionM: 0.017511875,
    peakRelativeDisplacementM: 0.00100503781525921,
    strokeRatio: 0.92584564076296,
    status: 'notAccepted',
    failures: ['staticDeflection'],
    warningCodes: ['SPRING_STROKE'],
    notApplicableCodes: none,
  }),
  row('tooSoftLight', 20000, 0.02, {
    naturalFrequencyHz: 3.18309886183791,
    worstInBandTransmissibility: 0.01727234912448,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 25.0249815288429,
    staticDeflectionM: 0.024516625,
    peakRelativeDisplacementM: 0.00500100030010004,
    strokeRatio: 1.475881265005,
    status: 'modelNotApplicable',
    // The model does not apply; sag, resonance peak, clearance and applicability all fail.
    failures: ['staticDeflection', 'peakTransmissibility', 'relativeDisplacement', 'applicability'],
    warningCodes: none,
    notApplicableCodes: ['SPRING_STROKE'],
  }),
  row('tooSoftHeavy', 20000, 0.3, {
    naturalFrequencyHz: 3.18309886183791,
    worstInBandTransmissibility: 0.0791441513302915,
    worstInBandFrequencyHz: 25,
    peakTransmissibility: 1.99460800359476,
    staticDeflectionM: 0.024516625,
    peakRelativeDisplacementM: 0.000349428278907306,
    strokeRatio: 1.24330266394537,
    status: 'modelNotApplicable',
    failures: ['staticDeflection', 'applicability'],
    warningCodes: none,
    notApplicableCodes: ['SPRING_STROKE'],
  }),
]

export function worksheetFixture(name: string): VibrationFixture {
  const f = VIBRATION_WORKSHEET.find((x) => x.name === name)
  if (!f) throw new Error(`unknown vibration fixture ${name}`)
  return f
}

/** Per-material values and feasible windows (worksheet third table), keyed by ζ. */
export interface MaterialRow {
  zeta: WorksheetZeta
  rP: number
  peakTransmissibility: number
  rZ: number
  zPeakOverY: number
  /** r where TR = 0.12 on r > √2. */
  rIso: number
  /** f_n,max = 25/r_iso, Hz. */
  fnMaxHz: number
  /** k_max = m(2π f_n,max)², N/m. */
  kMaxNPerM: number
  /** Accepted designs on the 0.5 kN/m grid (0 when no window). */
  gridCount: number
  /** Grid window, kN/m, when one exists. */
  gridWindowKNPerM?: readonly [number, number]
}

export const VIBRATION_MATERIAL_TABLE: readonly MaterialRow[] = [
  { zeta: 0.02, rP: 0.999600558946264, peakTransmissibility: 25.0249815288429, rZ: 1.00040024016011, zPeakOverY: 25.0050015005002, rIso: 3.0650997885581, fnMaxHz: 8.15634130194521, kMaxNPerM: 131316.86986337, gridCount: 0 },
  { zeta: 0.05, rP: 0.997521620628236, peakTransmissibility: 10.0622137253413, rZ: 1.00250941423417, zPeakOverY: 10.0125234864352, rIso: 3.11825451183061, fnMaxHz: 8.01730580526714, kMaxNPerM: 126878.092151129, gridCount: 0 },
  { zeta: 0.1, rP: 0.990334344316687, peakTransmissibility: 5.12277357963917, rZ: 1.01015254455221, zPeakOverY: 5.02518907629606, rIso: 3.31277422487744, fnMaxHz: 7.54654507157817, kMaxNPerM: 112415.470230578, gridCount: 102, gridWindowKNPerM: [61.5, 112] },
  { zeta: 0.2, rP: 0.96472965548517, peakTransmissibility: 2.73392111072598, rZ: 1.04257207028537, zPeakOverY: 2.55155181539914, rIso: 4.1208753933586, fnMaxHz: 6.06667215424451, kMaxNPerM: 72649.1928025733, gridCount: 23, gridWindowKNPerM: [61.5, 72.5] },
  { zeta: 0.3, rP: 0.930184726069087, peakTransmissibility: 1.99460800359476, rZ: 1.10431526074847, zPeakOverY: 1.74714139453653, rIso: 5.38517796574222, fnMaxHz: 4.64237211082667, kMaxNPerM: 42541.1903821775, gridCount: 0 },
]

/** Derived targets and prediction fixtures (worksheet "Derived targets", "Prediction fixtures"). */
export const VIBRATION_DERIVED = {
  /** k ≥ m g/δ_lim meets the sag limit, N/m. */
  sagFloorNPerM: 61291.5625,
  /** f_n ≥ (1/2π)√(g/δ_lim), Hz. */
  sagFloorHz: 5.57231265265523,
  /** f_n range over the stiffness range, Hz. */
  fnRangeHz: [3.18309886183791, 31.8309886183791] as const,
  /** SPRING_STROKE warning boundary (ratio 0.8) for ζ = 0.02 and ζ = 0.30, N/m. */
  strokeWarningNPerM: { 0.02: 44579.7357376471, 0.3: 31330.0056214027 } as const,
  /** SPRING_STROKE not-applicable boundary (ratio 1.0) for ζ = 0.30 and ζ = 0.02, N/m. */
  strokeNotApplicableNPerM: { 0.3: 24952.5818871561, 0.02: 32691.0133882642 } as const,
  /** Accepted grid designs in total (102 neoprene + 23 butyl). */
  acceptedGridDesigns: 125,
  /** Prediction ratios of the primary metric. */
  prediction: {
    baselineToReference: 0.00923071926505895,
    referenceToDampedReference: 1.44296593031538,
    referenceToLightSpring: 0.805824501135999,
  },
} as const

/** |actual − expected| ≤ rel · |expected|. */
export function relClose(actual: number, expected: number, rel: number = VIBRATION_WORKSHEET_REL_TOL): boolean {
  return Math.abs(actual - expected) <= rel * Math.abs(expected)
}

/** Valid-by-construction isolator designs for `ch` (range edges and every material included). */
export function arbVibrationDesign(ch: VibrationChallenge): fc.Arbitrary<VibrationDesign> {
  const k = ch.stiffnessLimits
  const stiffness = fc.oneof(
    fc.double({ min: k.minNPerM, max: k.maxNPerM, noNaN: true, noDefaultInfinity: true }),
    fc.constantFrom(k.minNPerM, k.maxNPerM),
  )
  return fc
    .tuple(stiffness, fc.constantFrom(...ch.materials.map((m) => m.id)))
    .map(([stiffnessNPerM, materialId]) => ({ id: 'd', stiffnessNPerM, materialId }))
}
