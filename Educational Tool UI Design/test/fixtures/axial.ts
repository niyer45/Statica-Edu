import fc from 'fast-check'
import stressStrainJson from '../../src/challenge/challenges/stress-strain-1.json'
import { loadAxialChallenge } from '../../src/challenge/axial/loader'
import type { AxialChallenge } from '../../src/challenge/axial/types'
import type { AxialConstraintId } from '../../src/evaluation/axial/types'
import type { AxialDesign } from '../../src/geometry/axial/design'
import type { AxialApplicabilityCode } from '../../src/physics/axial/constants'

// Stress and Strain I worksheet fixtures (task 72; .kiro/specs/stress-strain-1/design.md
// "Worksheet", produced by worksheet.py with 40-digit decimals and no application code). Every
// expected number is transcribed verbatim, not calculated through the implementation under test.
// SI units, unrounded. Assert at AXIAL_WORKSHEET_REL_TOL (1e-9 relative, SSR-13).

export const AXIAL_WORKSHEET_REL_TOL = 1e-9

export type AxialFixtureStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

export interface AxialFixture {
  name: string
  design: AxialDesign
  expected: {
    areaM2: number
    stressPa: number
    strain: number
    elongationM: number
    massKg: number
    axialStiffnessNPerM: number
    allowableStressPa: number
    yieldRatio: number
    status: AxialFixtureStatus
    /** Failed checks, in the fixed order. */
    failures: readonly AxialConstraintId[]
    warningCodes: readonly AxialApplicabilityCode[]
    notApplicableCodes: readonly AxialApplicabilityCode[]
  }
}

/** The bundled Stress and Strain I config, loaded and frozen. Throws if it fails. */
export function axialChallenge(): AxialChallenge {
  const loaded = loadAxialChallenge(stressStrainJson)
  if (!loaded.ok) throw new Error(`stress-strain-1 failed to load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}

export const rod = (id: string, diameterM: number, materialId: string): AxialDesign => ({ id, diameterM, materialId })

type Expected = AxialFixture['expected']
const row = (name: string, materialId: string, diameterM: number, expected: Expected): AxialFixture => ({ name, design: rod(name, diameterM, materialId), expected })
const ok = { warningCodes: [], notApplicableCodes: [] } as const

export const AXIAL_WORKSHEET: readonly AxialFixture[] = [
  row('baseline', 'steel', 0.013, {
    areaM2: 0.000132732289614169, stressPa: 150679236.063333, strain: 0.000753396180316664, elongationM: 0.00150679236063333,
    massKg: 2.08389694694245, axialStiffnessNPerM: 13273228.9614169, allowableStressPa: 1.25e8, yieldRatio: 0.602716944253331,
    status: 'notAccepted', failures: ['stress', 'mass'], ...ok,
  }),
  row('reference', 'aluminium', 0.02, {
    areaM2: 0.000314159265358979, stressPa: 63661977.2367581, strain: 0.000922637351257364, elongationM: 0.00184527470251473,
    massKg: 1.69646003293849, axialStiffnessNPerM: 10838494.6548848, allowableStressPa: 1.38e8, yieldRatio: 0.230659337814341,
    status: 'accepted', failures: [], ...ok,
  }),
  row('titaniumSlim', 'titanium', 0.015, {
    areaM2: 0.000176714586764426, stressPa: 113176848.420903, strain: 0.000992779372113187, elongationM: 0.00198555874422637,
    massKg: 1.56569123873281, axialStiffnessNPerM: 10072731.4455723, allowableStressPa: 4.15e8, yieldRatio: 0.136357648699884,
    status: 'accepted', failures: [], ...ok,
  }),
  row('titaniumMargin', 'titanium', 0.0155, {
    areaM2: 0.000188691908756237, stressPa: 105992886.138203, strain: 0.000929762159107043, elongationM: 0.00185952431821409,
    massKg: 1.67181031158026, axialStiffnessNPerM: 10755438.7991055, allowableStressPa: 4.15e8, yieldRatio: 0.127702272455666,
    status: 'accepted', failures: [], ...ok,
  }),
  row('steelStrong', 'steel', 0.0145, {
    areaM2: 0.000165129963854314, stressPa: 121116722.448054, strain: 0.000605583612240268, elongationM: 0.00121116722448054,
    massKg: 2.59254043251272, axialStiffnessNPerM: 16512996.3854314, allowableStressPa: 1.25e8, yieldRatio: 0.484466889792214,
    status: 'notAccepted', failures: ['mass'], ...ok,
  }),
  row('aluminiumSameDiameter', 'aluminium', 0.0145, {
    areaM2: 0.000165129963854314, stressPa: 121116722.448054, strain: 0.00175531481808773, elongationM: 0.00351062963617546,
    massKg: 0.891701804813293, axialStiffnessNPerM: 5696983.75297382, allowableStressPa: 1.38e8, yieldRatio: 0.438828704521933,
    status: 'notAccepted', failures: ['elongation'], ...ok,
  }),
  row('titaniumSameDiameter', 'titanium', 0.0145, {
    areaM2: 0.000165129963854314, stressPa: 121116722.448054, strain: 0.00106242738989521, elongationM: 0.00212485477979041,
    massKg: 1.46305147974922, axialStiffnessNPerM: 9412407.93969587, allowableStressPa: 4.15e8, yieldRatio: 0.145923761985607,
    status: 'notAccepted', failures: ['elongation'], ...ok,
  }),
  row('aluminiumThin', 'aluminium', 0.011, {
    areaM2: 0.0000950331777710912, stressPa: 210452817.311597, strain: 0.00305004083060286, elongationM: 0.00610008166120571,
    massKg: 0.513179159963893, axialStiffnessNPerM: 3278644.63310265, allowableStressPa: 1.38e8, yieldRatio: 0.762510207650714,
    status: 'notAccepted', failures: ['stress', 'elongation'], ...ok,
  }),
  row('titaniumThin', 'titanium', 0.0065, {
    areaM2: 0.0000331830724035422, stressPa: 602716944.253331, strain: 0.00528699073906431, elongationM: 0.0105739814781286,
    massKg: 0.294002021495384, axialStiffnessNPerM: 1891435.1270019, allowableStressPa: 4.15e8, yieldRatio: 0.726164993076303,
    status: 'notAccepted', failures: ['stress', 'elongation'], ...ok,
  }),
  row('aluminiumHeavy', 'aluminium', 0.022, {
    areaM2: 0.000380132711084365, stressPa: 52613204.3278993, strain: 0.000762510207650714, elongationM: 0.00152502041530143,
    massKg: 2.05271663985557, axialStiffnessNPerM: 13114578.5324106, allowableStressPa: 1.38e8, yieldRatio: 0.190627551912679,
    status: 'notAccepted', failures: ['mass'], ...ok,
  }),
  row('steelMax', 'steel', 0.03, {
    areaM2: 0.000706858347057703, stressPa: 28294212.1052258, strain: 0.000141471060526129, elongationM: 0.000282942121052258,
    massKg: 11.0976760488059, axialStiffnessNPerM: 70685834.7057703, allowableStressPa: 1.25e8, yieldRatio: 0.113176848420903,
    status: 'notAccepted', failures: ['mass'], ...ok,
  }),
  row('warningAluminium', 'aluminium', 0.0105, {
    areaM2: 0.0000865901475145687, stressPa: 230973160.04266, strain: 0.00334743710206753, elongationM: 0.00669487420413507,
    massKg: 0.467586796578671, axialStiffnessNPerM: 2987360.08925262, allowableStressPa: 1.38e8, yieldRatio: 0.836859275516884,
    status: 'notAccepted', failures: ['stress', 'elongation'], warningCodes: ['PLASTICITY'], notApplicableCodes: [],
  }),
  row('tinySteel', 'steel', 0.006, {
    areaM2: 0.0000282743338823081, stressPa: 707355302.630646, strain: 0.00353677651315323, elongationM: 0.00707355302630646,
    massKg: 0.443907041952238, axialStiffnessNPerM: 2827433.38823081, allowableStressPa: 1.25e8, yieldRatio: 2.82942121052258,
    status: 'modelNotApplicable', failures: ['stress', 'elongation', 'applicability'], warningCodes: [], notApplicableCodes: ['PLASTICITY'],
  }),
]

export function worksheetFixture(name: string): AxialFixture {
  const f = AXIAL_WORKSHEET.find((x) => x.name === name)
  if (!f) throw new Error(`unknown axial fixture ${name}`)
  return f
}

/** Derived limits (worksheet "Derived limits"), transcribed. */
export const AXIAL_DERIVED = {
  /** Smallest diameters meeting the stress and stretch checks, and largest meeting the mass check, m. */
  steel: { stressMinD: 0.0142729929292222, stretchMinD: 0.0112837916709551, massMaxD: 0.0127356240659195, lightestPassingKg: 2.512 },
  aluminium: { stressMinD: 0.0135840888635003, stretchMinD: 0.0192108027032434, massMaxD: 0.0217156671956853, lightestPassingKg: 1.56521739130435 },
  titanium: { stressMinD: 0.00783332253357077, stretchMinD: 0.0149457471785611, massMaxD: 0.0169532589723098, lightestPassingKg: 1.55438596491228 },
  /** Accepted grid designs (step 0.5 mm), in millimetres. */
  acceptedGridMm: { aluminium: [19.5, 20, 20.5, 21, 21.5], titanium: [15, 15.5, 16, 16.5], steel: [] as number[] },
  /** Prediction fixture: baseline → reference elongation ratio (an increase). */
  baselineToReferenceElongationRatio: 1.22463768115942,
  /** Strain energy of the baseline, J (Castigliano / work check). */
  baselineStrainEnergyJ: 15.0679236063333,
} as const

/** |actual − expected| ≤ rel · |expected|. */
export function relClose(actual: number, expected: number, rel: number = AXIAL_WORKSHEET_REL_TOL): boolean {
  return Math.abs(actual - expected) <= rel * Math.abs(expected)
}

/** Valid-by-construction rod designs for `ch` (range edges included). */
export function arbAxialDesign(ch: AxialChallenge): fc.Arbitrary<AxialDesign> {
  const r = ch.diameterLimits
  return fc
    .tuple(fc.double({ min: r.minM, max: r.maxM, noNaN: true, noDefaultInfinity: true }), fc.constantFrom(...ch.materials.map((m) => m.id)))
    .map(([d, m]) => rod('d', d, m))
}

/** Every grid design: 49 diameters × 3 materials. */
export function gridDesigns(ch: AxialChallenge): AxialDesign[] {
  const r = ch.diameterLimits
  const n = Math.round((r.maxM - r.minM) / r.stepM) + 1
  return ch.materials.flatMap((m) => Array.from({ length: n }, (_, i) => rod('g', Math.round((r.minM + i * r.stepM) * 1e9) / 1e9, m.id)))
}
