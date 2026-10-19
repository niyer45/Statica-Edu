import fc from 'fast-check'
import pressureVesselJson from '../../src/challenge/challenges/pressure-vessel-1.json'
import { loadVesselChallenge } from '../../src/challenge/vessel/loader'
import type { VesselChallenge } from '../../src/challenge/vessel/types'
import type { VesselConstraintId } from '../../src/evaluation/vessel/types'
import type { VesselDesign } from '../../src/geometry/vessel/design'
import type { VesselApplicabilityCode } from '../../src/physics/vessel/constants'

// Pressure Vessel I worksheet fixtures (task 69, model `thinWallPressureVessel` v1). Every
// expected number is transcribed (Python repr, 17 significant digits) from the standalone script
// .kiro/specs/pressure-vessel-1/worksheet.py, written from the equations in design.md without
// reading the application code; nothing here is calculated through the implementation under test.
// Challenge constants: p = 4.0 MPa, σ_y = 250 MPa, n = 2 (σ_a = 125 MPa), ρ = 7850 kg/m³,
// V_min = 100 L, L_o,max = 1.0 m, m_max = 55 kg. SI units, unrounded. Assert at
// VESSEL_WORKSHEET_REL_TOL (1e-9 relative).

export const VESSEL_WORKSHEET_REL_TOL = 1e-9

export type VesselFixtureStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

export interface VesselFixture {
  name: string
  design: VesselDesign
  expected: {
    hoopStressPa: number
    longitudinalStressPa: number
    headStressPa: number
    volumeM3: number
    overallLengthM: number
    shellMassKg: number
    headsMassKg: number
    massKg: number
    /** max(σ_h, σ_head) / σ_y. */
    plasticityRatio: number
    /** t_s / r. */
    shellWallRatio: number
    /** t_h / r. */
    headWallRatio: number
    status: VesselFixtureStatus
    /** Failed constraints, in the fixed constraint order. */
    failures: readonly VesselConstraintId[]
    warningCodes: readonly VesselApplicabilityCode[]
    notApplicableCodes: readonly VesselApplicabilityCode[]
  }
}

/** The bundled Pressure Vessel I config, loaded and frozen. Throws if it fails. */
export function vesselChallenge(): VesselChallenge {
  const loaded = loadVesselChallenge(pressureVesselJson)
  if (!loaded.ok) throw new Error(`pressure-vessel-1 failed to load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}

// The locked material comes from the config so fixtures always pass the locked-field check.
const MATERIAL_ID: string = pressureVesselJson.material.id

/** A vessel design from D_i, L, t_s, t_h in metres. */
export function vessel(id: string, innerDiameterM: number, shellLengthM: number, shellThicknessM: number, headThicknessM: number): VesselDesign {
  return { id, innerDiameterM, shellLengthM, shellThicknessM, headThicknessM, materialId: MATERIAL_ID }
}

const row = (name: string, dims: [number, number, number, number], expected: VesselFixture['expected']): VesselFixture => ({
  name,
  design: vessel(name, ...dims),
  expected,
})

export const VESSEL_WORKSHEET: readonly VesselFixture[] = [
  // The challenge baseline: long, narrow and thin-walled. Fails hoop, head, volume and overall
  // length; applicable with no warning (σ/σ_y 0.768).
  row('baseline', [0.24, 1.2, 0.0025, 0.0015], {
    hoopStressPa: 192000000.0,
    longitudinalStressPa: 96000000.0,
    headStressPa: 160000000.0,
    volumeM3: 0.0615249505279025,
    overallLengthM: 1.443,
    shellMassKg: 17.941242945569584,
    headsMassKg: 2.15749920064837,
    massKg: 20.098742146217955,
    plasticityRatio: 0.768,
    shellWallRatio: 0.020833333333333336,
    headWallRatio: 0.0125,
    status: 'notAccepted',
    failures: ['hoopStress', 'headStress', 'volume', 'overallLength'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  // The internal reference (never shown to students): passes every check.
  row('reference', [0.4, 0.53, 0.0065, 0.0035], {
    hoopStressPa: 123076923.07692309,
    longitudinalStressPa: 61538461.53846154,
    headStressPa: 114285714.28571428,
    volumeM3: 0.10011208589439474,
    overallLengthM: 0.937,
    shellMassKg: 34.5357829026166,
    headsMassKg: 14.053533843904628,
    massKg: 48.589316746521234,
    plasticityRatio: 0.49230769230769234,
    shellWallRatio: 0.032499999999999994,
    headWallRatio: 0.017499999999999998,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  // The reference with heads as thick as the shell: only the mass fails.
  row('equalHeads', [0.4, 0.53, 0.0065, 0.0065], {
    hoopStressPa: 123076923.07692309,
    longitudinalStressPa: 61538461.53846154,
    headStressPa: 61538461.53846154,
    volumeM3: 0.10011208589439474,
    overallLengthM: 0.9430000000000001,
    shellMassKg: 34.5357829026166,
    headsMassKg: 26.4905514227875,
    massKg: 61.02633432540411,
    plasticityRatio: 0.49230769230769234,
    shellWallRatio: 0.032499999999999994,
    headWallRatio: 0.032499999999999994,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  // The reference with heads slightly too thin: only the head stress fails.
  row('thinHeads', [0.4, 0.53, 0.0065, 0.003], {
    hoopStressPa: 123076923.07692309,
    longitudinalStressPa: 61538461.53846154,
    headStressPa: 133333333.33333333,
    volumeM3: 0.10011208589439474,
    overallLengthM: 0.936,
    shellMassKg: 34.5357829026166,
    headsMassKg: 12.015971749591133,
    massKg: 46.551754652207734,
    plasticityRatio: 0.5333333333333333,
    shellWallRatio: 0.032499999999999994,
    headWallRatio: 0.015,
    status: 'notAccepted',
    failures: ['headStress'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  // Wide and short: Accepted with hoop and head stress exactly at the allowable (inclusive).
  row('wide', [0.5, 0.18, 0.008, 0.004], {
    hoopStressPa: 125000000.0,
    longitudinalStressPa: 62500000.0,
    headStressPa: 125000000.0,
    volumeM3: 0.10079276430267253,
    overallLengthM: 0.688,
    shellMassKg: 18.040382184938935,
    headsMassKg: 25.05819081616963,
    massKg: 43.09857300110856,
    plasticityRatio: 0.5,
    shellWallRatio: 0.032,
    headWallRatio: 0.016,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  // Narrow walls sized to the allowable at the longest shell: still too small and too long.
  row('narrowAtAllowable', [0.3, 1.2, 0.005, 0.0025], {
    hoopStressPa: 120000000.0,
    longitudinalStressPa: 60000000.0,
    headStressPa: 120000000.0,
    volumeM3: 0.09896016858807848,
    overallLengthM: 1.505,
    shellMassKg: 45.13054926514423,
    headsMassKg: 5.641832439441587,
    massKg: 50.77238170458582,
    plasticityRatio: 0.48,
    shellWallRatio: 0.03333333333333333,
    headWallRatio: 0.016666666666666666,
    status: 'notAccepted',
    failures: ['volume', 'overallLength'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  // r/t_s below 20: thin-wall caution for the shell.
  row('thickShellWarning', [0.2, 1.2, 0.006, 0.003], {
    hoopStressPa: 66666666.666666664,
    longitudinalStressPa: 33333333.333333332,
    headStressPa: 66666666.666666664,
    volumeM3: 0.04188790204786391,
    overallLengthM: 1.406,
    shellMassKg: 36.57794025686442,
    headsMassKg: 3.0490495021559414,
    massKg: 39.62698975902036,
    plasticityRatio: 0.26666666666666666,
    shellWallRatio: 0.06,
    headWallRatio: 0.03,
    status: 'notAccepted',
    failures: ['volume', 'overallLength'],
    warningCodes: ['THIN_WALL_SHELL'],
    notApplicableCodes: [],
  }),
  // r/t below 10 for both walls: outside the thin-wall model.
  row('thickWallNotApplicable', [0.2, 0.6, 0.012, 0.012], {
    hoopStressPa: 33333333.333333332,
    longitudinalStressPa: 16666666.666666666,
    headStressPa: 16666666.666666666,
    volumeM3: 0.02303834612632515,
    overallLengthM: 0.824,
    shellMassKg: 37.64331715754975,
    headsMassKg: 13.314843754343386,
    massKg: 50.95816091189314,
    plasticityRatio: 0.13333333333333333,
    shellWallRatio: 0.12,
    headWallRatio: 0.12,
    status: 'modelNotApplicable',
    failures: ['volume', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['THIN_WALL_SHELL', 'THIN_WALL_HEAD'],
  }),
  // The baseline with a 2 mm shell: the hoop stress nears yield (caution).
  row('plasticityWarning', [0.24, 1.2, 0.002, 0.0015], {
    hoopStressPa: 240000000.0,
    longitudinalStressPa: 120000000.0,
    headStressPa: 160000000.0,
    volumeM3: 0.0615249505279025,
    overallLengthM: 1.443,
    shellMassKg: 14.323400553658873,
    headsMassKg: 2.15749920064837,
    massKg: 16.48089975430724,
    plasticityRatio: 0.96,
    shellWallRatio: 0.016666666666666666,
    headWallRatio: 0.0125,
    status: 'notAccepted',
    failures: ['hoopStress', 'headStress', 'volume', 'overallLength'],
    warningCodes: ['PLASTICITY'],
    notApplicableCodes: [],
  }),
  // 1 mm walls: past yield, outside the model; the only row where the longitudinal stress fails.
  row('plasticityNotApplicable', [0.3, 0.8, 0.001, 0.001], {
    hoopStressPa: 600000000.0,
    longitudinalStressPa: 300000000.0,
    headStressPa: 300000000.0,
    volumeM3: 0.07068583470577035,
    overallLengthM: 1.102,
    shellMassKg: 5.938489761227698,
    headsMassKg: 2.2343649931627083,
    massKg: 8.172854754390407,
    plasticityRatio: 2.4,
    shellWallRatio: 0.006666666666666667,
    headWallRatio: 0.006666666666666667,
    status: 'modelNotApplicable',
    failures: ['hoopStress', 'longitudinalStress', 'headStress', 'volume', 'overallLength', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['PLASTICITY'],
  }),
  // Everything at its maximum: strong and roomy, but too long and far too heavy.
  row('oversize', [0.5, 1.2, 0.012, 0.012], {
    hoopStressPa: 83333333.33333333,
    longitudinalStressPa: 41666666.666666664,
    headStressPa: 41666666.666666664,
    volumeM3: 0.3010692959690218,
    overallLengthM: 1.724,
    shellMassKg: 181.8243243836369,
    headsMassKg: 77.59258342902748,
    massKg: 259.41690781266436,
    plasticityRatio: 0.3333333333333333,
    shellWallRatio: 0.048,
    headWallRatio: 0.048,
    status: 'notAccepted',
    failures: ['overallLength', 'mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
]

export function vesselFixture(name: string): VesselFixture {
  const f = VESSEL_WORKSHEET.find((x) => x.name === name)
  if (!f) throw new Error(`unknown vessel fixture ${name}`)
  return f
}

/** Derived values from the standalone worksheet. */
export const VESSEL_DERIVED = {
  /** Prediction fixture: baseline → reference hoop-stress ratio (a decrease). */
  baselineToReferenceHoopRatio: 0.6410256410256411,
  /** Lamé thick-wall cylinder: peak hoop ÷ p r/t at t/r = 0.01, 0.025, 0.05, 0.1. */
  lameCylinder: [
    { k: 0.01, ratio: 1.0050248756218902 },
    { k: 0.025, ratio: 1.012654320987656 },
    { k: 0.05, ratio: 1.0256097560975606 },
    { k: 0.1, ratio: 1.0523809523809515 },
  ],
  /** Lamé thick-wall sphere: peak tangential ÷ p r/(2t) at the same ratios. */
  lameSphere: [
    { k: 0.01, ratio: 1.0000663344444034 },
    { k: 0.025, ratio: 1.0004115017272956 },
    { k: 0.05, ratio: 1.0016256938937345 },
    { k: 0.1, ratio: 1.006344410876132 },
  ],
  /** Exact annulus axial equilibrium σ_l (Pa) and thin ÷ exact for the baseline and reference. */
  exactAxial: [
    { name: 'baseline', exactPa: 95010309.27835065, thinOverExact: 1.0104166666666652 },
    { name: 'reference', exactPa: 60554451.69836318, thinOverExact: 1.0162499999999994 },
  ],
  /** Grid search (D-47): most design checks failed by a valid, applicable, warning-free design. */
  gridMaxFailed: 4,
  /** Grid search: Accepted designs on the configured step grid. */
  gridAccepted: 514,
} as const

/** |actual − expected| ≤ rel · |expected|. */
export function relClose(actual: number, expected: number, rel: number = VESSEL_WORKSHEET_REL_TOL): boolean {
  return Math.abs(actual - expected) <= rel * Math.abs(expected)
}

/** Finite double in [lo, hi] (inclusive). */
const between = (lo: number, hi: number): fc.Arbitrary<number> =>
  fc.double({ min: lo, max: hi, noNaN: true, noDefaultInfinity: true })

/** Valid-by-construction vessel designs for `ch` (range edges included). */
export function arbVesselDesign(ch: VesselChallenge): fc.Arbitrary<VesselDesign> {
  const L = ch.designLimits
  return fc
    .tuple(
      between(L.innerDiameterM.minM, L.innerDiameterM.maxM),
      between(L.shellLengthM.minM, L.shellLengthM.maxM),
      between(L.shellThicknessM.minM, L.shellThicknessM.maxM),
      between(L.headThicknessM.minM, L.headThicknessM.maxM),
    )
    .map(([D, len, ts, th]) => vessel('d', D, len, ts, th))
}

/** Every configured-grid value of a range (index-based, so 0.5 mm steps stay exact multiples). */
export function gridValues(r: { minM: number; maxM: number; stepM: number }): number[] {
  const n = Math.round((r.maxM - r.minM) / r.stepM)
  return Array.from({ length: n + 1 }, (_, i) => Number((r.minM + i * r.stepM).toFixed(6)))
}
