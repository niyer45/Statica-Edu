import fc from 'fast-check'
import mountingBracketJson from '../../src/challenge/challenges/mounting-bracket-1.json'
import { loadBracketChallenge } from '../../src/challenge/bracket/loader'
import type { BracketChallenge } from '../../src/challenge/bracket/types'
import type { BracketConstraintId } from '../../src/evaluation/bracket/types'
import type { BracketDesign } from '../../src/geometry/bracket/design'
import type { BracketApplicabilityCode } from '../../src/physics/bracket/constants'

// Mounting Bracket I worksheet fixtures (task 55, bolted L-bracket `boltedLBracket` v1). Every
// expected number is transcribed (15 significant figures) from a standalone hand-calculation
// script written separately from the application code (the formulas are restated in
// .kiro/specs/mounting-bracket-1/l-bracket-design.md), not calculated through the implementation
// under test. Challenge constants: P = 200 N, a = 120 mm, overhang 15 mm, 2 bolts 15 mm below the
// flange top, E = 69 GPa, ρ = 2700 kg/m³, σ_y = 240 MPa. SI units, unrounded. Assert at
// BRACKET_WORKSHEET_REL_TOL (1e-9 relative).

export const BRACKET_WORKSHEET_REL_TOL = 1e-9

export type BracketFixtureStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

export interface BracketFixture {
  name: string
  design: BracketDesign
  expected: {
    nominalBendStressPa: number
    curvedBeamFactor: number
    bendStressPa: number
    bendRadiusRatio: number
    armDeflectionM: number
    flangeRotationDeflectionM: number
    deflectionM: number
    boltLeverArmM: number
    boltTensionN: number
    massKg: number
    /** σ_bend / σ_y. */
    plasticityRatio: number
    /** δ / a. */
    deflectionRatio: number
    /** t / h_b. */
    legSpanRatio: number
    status: BracketFixtureStatus
    /** Failed constraints, in the fixed constraint order. */
    failures: readonly BracketConstraintId[]
    warningCodes: readonly BracketApplicabilityCode[]
    notApplicableCodes: readonly BracketApplicabilityCode[]
  }
}

/** The bundled Mounting Bracket I config, loaded and frozen. Throws if it fails. */
export function bracketChallenge(): BracketChallenge {
  const loaded = loadBracketChallenge(mountingBracketJson)
  if (!loaded.ok) throw new Error(`mounting-bracket-1 failed to load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}

// The locked material comes from the config so fixtures always pass the locked-field check.
const MATERIAL_ID: string = mountingBracketJson.material.id

/** A bracket design from t, w, H, r_i in metres. */
export function bracket(id: string, thicknessM: number, widthM: number, flangeHeightM: number, innerRadiusM: number): BracketDesign {
  return { id, thicknessM, widthM, flangeHeightM, innerRadiusM, materialId: MATERIAL_ID }
}

const row = (name: string, dims: [number, number, number, number], expected: BracketFixture['expected']): BracketFixture => ({
  name,
  design: bracket(name, ...dims),
  expected,
})

/** Bend moment M = P a for every row, N·m. */
export const BRACKET_BEND_MOMENT_NM = 24

export const BRACKET_WORKSHEET: readonly BracketFixture[] = [
  // The challenge baseline: wide thin sheet, sharp bend, short flange. Fails all four checks and
  // stays applicable (two warnings).
  row('baseline', [0.003, 0.12, 0.055, 0.001], {
    nominalBendStressPa: 133333333.333333,
    curvedBeamFactor: 1.73242563991682,
    bendStressPa: 230990085.322243,
    bendRadiusRatio: 1.66666666666667,
    armDeflectionM: 0.00618357487922705,
    flangeRotationDeflectionM: 0.00185507246376812,
    deflectionM: 0.00803864734299517,
    boltLeverArmM: 0.036,
    boltTensionN: 333.333333333333,
    massKg: 0.180721035074112,
    plasticityRatio: 0.962458688842678,
    deflectionRatio: 0.0669887278582931,
    legSpanRatio: 0.0833333333333333,
    status: 'notAccepted',
    failures: ['bendStress', 'deflection', 'boltTension', 'mass'],
    warningCodes: ['PLASTICITY', 'LARGE_DEFLECTION'],
    notApplicableCodes: [],
  }),
  // The internal reference (never shown to students): passes every check.
  row('reference', [0.007, 0.04, 0.08, 0.006], {
    nominalBendStressPa: 73469387.755102,
    curvedBeamFactor: 1.32942660276138,
    bendStressPa: 97672158.5702235,
    bendRadiusRatio: 2.71428571428571,
    armDeflectionM: 0.00146026112308277,
    flangeRotationDeflectionM: 0.000632779820002535,
    deflectionM: 0.00209304094308531,
    boltLeverArmM: 0.052,
    boltTensionN: 230.769230769231,
    massKg: 0.154165459219041,
    plasticityRatio: 0.406967327375931,
    deflectionRatio: 0.0174420078590442,
    legSpanRatio: 0.134615384615385,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  // Baseline with only the thickness changed: stress and deflection pass, the sharper relative
  // bend raises the curved-beam factor, the larger outer radius shortens the bolt lever arm.
  row('thicknessOnly', [0.007, 0.12, 0.055, 0.001], {
    nominalBendStressPa: 24489795.9183673,
    curvedBeamFactor: 2.43507246773983,
    bendStressPa: 59634427.7813837,
    bendRadiusRatio: 1.28571428571429,
    armDeflectionM: 0.000486753707694258,
    flangeRotationDeflectionM: 0.000129800988718469,
    deflectionM: 0.000616554696412726,
    boltLeverArmM: 0.032,
    boltTensionN: 375,
    massKg: 0.410663547311269,
    plasticityRatio: 0.248476782422432,
    deflectionRatio: 0.00513795580343939,
    legSpanRatio: 0.21875,
    status: 'notAccepted',
    failures: ['boltTension', 'mass'],
    warningCodes: ['LEG_SPAN'],
    notApplicableCodes: [],
  }),
  // Baseline with only the inner radius changed: lower factor, but a higher heel and more bolt tension.
  row('radiusOnly', [0.003, 0.12, 0.055, 0.006], {
    nominalBendStressPa: 133333333.333333,
    curvedBeamFactor: 1.15319331317656,
    bendStressPa: 153759108.423542,
    bendRadiusRatio: 5,
    armDeflectionM: 0.00618357487922705,
    flangeRotationDeflectionM: 0.00159742351046699,
    deflectionM: 0.00778099838969404,
    boltLeverArmM: 0.031,
    boltTensionN: 387.096774193548,
    massKg: 0.178635105222335,
    plasticityRatio: 0.640662951764758,
    deflectionRatio: 0.0648416532474503,
    legSpanRatio: 0.0967741935483871,
    status: 'notAccepted',
    failures: ['bendStress', 'deflection', 'boltTension', 'mass'],
    warningCodes: ['LARGE_DEFLECTION'],
    notApplicableCodes: [],
  }),
  // Baseline with only a taller flange: the bolts pass, deflection and mass get worse.
  row('flangeOnly', [0.003, 0.12, 0.085, 0.001], {
    nominalBendStressPa: 133333333.333333,
    curvedBeamFactor: 1.73242563991682,
    bendStressPa: 230990085.322243,
    bendRadiusRatio: 1.66666666666667,
    armDeflectionM: 0.00618357487922705,
    flangeRotationDeflectionM: 0.00340096618357488,
    deflectionM: 0.00958454106280193,
    boltLeverArmM: 0.066,
    boltTensionN: 181.818181818182,
    massKg: 0.209881035074112,
    plasticityRatio: 0.962458688842678,
    deflectionRatio: 0.0798711755233494,
    legSpanRatio: 0.0454545454545455,
    status: 'notAccepted',
    failures: ['bendStress', 'deflection', 'mass'],
    warningCodes: ['PLASTICITY', 'LARGE_DEFLECTION'],
    notApplicableCodes: [],
  }),
  // Baseline with only a narrower width: light, but plastic and floppy, so not applicable.
  row('widthOnly', [0.003, 0.04, 0.055, 0.001], {
    nominalBendStressPa: 400000000,
    curvedBeamFactor: 1.73242563991682,
    bendStressPa: 692970255.966728,
    bendRadiusRatio: 1.66666666666667,
    armDeflectionM: 0.0185507246376812,
    flangeRotationDeflectionM: 0.00556521739130435,
    deflectionM: 0.0241159420289855,
    boltLeverArmM: 0.036,
    boltTensionN: 333.333333333333,
    massKg: 0.0602403450247039,
    plasticityRatio: 2.88737606652804,
    deflectionRatio: 0.200966183574879,
    legSpanRatio: 0.0833333333333333,
    status: 'modelNotApplicable',
    failures: ['bendStress', 'deflection', 'boltTension', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['PLASTICITY', 'LARGE_DEFLECTION'],
  }),
  // Adding material everywhere: every strength and stiffness check passes, mass fails.
  row('oversized', [0.008, 0.06, 0.1, 0.006], {
    nominalBendStressPa: 37500000,
    curvedBeamFactor: 1.37014083080349,
    bendStressPa: 51380281.1551308,
    bendRadiusRatio: 2.5,
    armDeflectionM: 0.000652173913043478,
    flangeRotationDeflectionM: 0.000385869565217391,
    deflectionM: 0.00103804347826087,
    boltLeverArmM: 0.071,
    boltTensionN: 169.014084507042,
    massKg: 0.288629520395262,
    plasticityRatio: 0.214084504813045,
    deflectionRatio: 0.00865036231884058,
    legSpanRatio: 0.112676056338028,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  // The reference with a sharp 1 mm bend: only the bend stress fails.
  row('sharpThick', [0.007, 0.04, 0.08, 0.001], {
    nominalBendStressPa: 73469387.755102,
    curvedBeamFactor: 2.43507246773984,
    bendStressPa: 178903283.344151,
    bendRadiusRatio: 1.28571428571429,
    armDeflectionM: 0.00146026112308277,
    flangeRotationDeflectionM: 0.000693624033464317,
    deflectionM: 0.00215388515654709,
    boltLeverArmM: 0.057,
    boltTensionN: 210.526315789474,
    massKg: 0.155787849103756,
    plasticityRatio: 0.745430347267296,
    deflectionRatio: 0.0179490429712258,
    legSpanRatio: 0.12280701754386,
    status: 'notAccepted',
    failures: ['bendStress'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  // R/c = 1.2 exactly (r_i = 0.1 t): the curved-beam screen is inclusive, so no issue.
  row('curvedBoundary', [0.01, 0.04, 0.08, 0.001], {
    nominalBendStressPa: 36000000,
    curvedBeamFactor: 2.88787355944286,
    bendStressPa: 103963448.139943,
    bendRadiusRatio: 1.2,
    armDeflectionM: 0.000500869565217391,
    flangeRotationDeflectionM: 0.000225391304347826,
    deflectionM: 0.000726260869565217,
    boltLeverArmM: 0.054,
    boltTensionN: 222.222222222222,
    massKg: 0.218618760197631,
    plasticityRatio: 0.43318103391643,
    deflectionRatio: 0.00605217391304348,
    legSpanRatio: 0.185185185185185,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('legSpanWarning', [0.01, 0.04, 0.07, 0.006], {
    nominalBendStressPa: 36000000,
    curvedBeamFactor: 1.44852465174533,
    bendStressPa: 52146887.4628317,
    bendRadiusRatio: 2.2,
    armDeflectionM: 0.000500869565217391,
    flangeRotationDeflectionM: 0.000162782608695652,
    deflectionM: 0.000663652173913043,
    boltLeverArmM: 0.039,
    boltTensionN: 307.692307692308,
    massKg: 0.205501060362323,
    plasticityRatio: 0.217278697761799,
    deflectionRatio: 0.00553043478260869,
    legSpanRatio: 0.256410256410256,
    status: 'notAccepted',
    failures: ['boltTension', 'mass'],
    warningCodes: ['LEG_SPAN'],
    notApplicableCodes: [],
  }),
  row('legSpanNA', [0.01, 0.04, 0.05, 0.012], {
    nominalBendStressPa: 36000000,
    curvedBeamFactor: 1.24433707782014,
    bendStressPa: 44796134.8015251,
    bendRadiusRatio: 3.4,
    armDeflectionM: 0.000500869565217391,
    flangeRotationDeflectionM: 0.0000542608695652174,
    deflectionM: 0.000555130434782609,
    boltLeverArmM: 0.013,
    boltTensionN: 923.076923076923,
    massKg: 0.181119820559954,
    plasticityRatio: 0.186650561673021,
    deflectionRatio: 0.00462608695652174,
    legSpanRatio: 0.769230769230769,
    status: 'modelNotApplicable',
    failures: ['boltTension', 'mass', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['LEG_SPAN'],
  }),
  row('plasticNA', [0.003, 0.04, 0.08, 0.001], {
    nominalBendStressPa: 400000000,
    curvedBeamFactor: 1.73242563991682,
    bendStressPa: 692970255.966728,
    bendRadiusRatio: 1.66666666666667,
    armDeflectionM: 0.0185507246376812,
    flangeRotationDeflectionM: 0.00942995169082126,
    deflectionM: 0.0279806763285024,
    boltLeverArmM: 0.061,
    boltTensionN: 196.72131147541,
    massKg: 0.0683403450247039,
    plasticityRatio: 2.88737606652804,
    deflectionRatio: 0.23317230273752,
    legSpanRatio: 0.0491803278688525,
    status: 'modelNotApplicable',
    failures: ['bendStress', 'deflection', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['PLASTICITY', 'LARGE_DEFLECTION'],
  }),
]

export function worksheetFixture(name: string): BracketFixture {
  const f = BRACKET_WORKSHEET.find((x) => x.name === name)
  if (!f) throw new Error(`unknown bracket fixture ${name}`)
  return f
}

/** Derived targets (standalone worksheet). */
export const BRACKET_DERIVED = {
  /** Prediction fixture: baseline → reference bend-stress ratio (a decrease). */
  baselineToReferenceStressRatio: 0.422841345913033,
} as const

/**
 * Inner-fibre curved-beam factor k_i for a solid rectangle at the R/c values tabulated in Roark's
 * Formulas for Stress and Strain, Table 9.1 case 1, to three decimals. Recalled from the widely
 * reproduced table, not yet checked against a printed edition (owner review 29.2).
 */
export const ROARK_RECTANGLE_KI: readonly { rOverC: number; ki: number }[] = [
  { rOverC: 1.2, ki: 2.888 },
  { rOverC: 1.4, ki: 2.103 },
  { rOverC: 1.6, ki: 1.798 },
  { rOverC: 2, ki: 1.523 },
  { rOverC: 3, ki: 1.288 },
  { rOverC: 4, ki: 1.2 },
  { rOverC: 6, ki: 1.124 },
  { rOverC: 8, ki: 1.09 },
  { rOverC: 10, ki: 1.071 },
]

/** |actual − expected| ≤ rel · |expected|. */
export function relClose(actual: number, expected: number, rel: number = BRACKET_WORKSHEET_REL_TOL): boolean {
  return Math.abs(actual - expected) <= rel * Math.abs(expected)
}

/** Finite double in [lo, hi] (inclusive). */
const between = (lo: number, hi: number): fc.Arbitrary<number> =>
  fc.double({ min: lo, max: hi, noNaN: true, noDefaultInfinity: true })

/** Valid-by-construction bracket designs for `ch` (range edges included). */
export function arbBracketDesign(ch: BracketChallenge): fc.Arbitrary<BracketDesign> {
  const L = ch.designLimits
  return fc
    .tuple(
      between(L.thicknessM.minM, L.thicknessM.maxM),
      between(L.widthM.minM, L.widthM.maxM),
      between(L.flangeHeightM.minM, L.flangeHeightM.maxM),
      between(L.innerRadiusM.minM, L.innerRadiusM.maxM),
    )
    .map(([t, w, H, r]) => bracket('d', t, w, H, r))
}

/** Every configured-grid value of a range (index-based, so 0.5 mm steps stay exact multiples). */
export function gridValues(r: { minM: number; maxM: number; stepM: number }): number[] {
  const n = Math.round((r.maxM - r.minM) / r.stepM)
  return Array.from({ length: n + 1 }, (_, i) => Number((r.minM + i * r.stepM).toFixed(6)))
}
