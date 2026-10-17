import fc from 'fast-check'
import torsionShaftJson from '../../src/challenge/challenges/torsion-shaft-1.json'
import { loadTorsionChallenge } from '../../src/challenge/torsion/loader'
import type { TorsionChallenge } from '../../src/challenge/torsion/types'
import type { TorsionConstraintId } from '../../src/evaluation/torsion/types'
import type { TorsionDesign, TorsionSection } from '../../src/geometry/torsion/design'
import type { TorsionApplicabilityCode } from '../../src/physics/torsion/constants'

// Torsion Shaft I worksheet fixtures (task 47.2; torsion-shaft-1 design.md "Worksheet").
// Every expected number is transcribed verbatim from the independently computed worksheet, not
// calculated through the implementation under test. SI units, unrounded. Assert at
// TORSION_WORKSHEET_REL_TOL (1e-9 relative, TSH-13).

export const TORSION_WORKSHEET_REL_TOL = 1e-9

export type TorsionFixtureStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

export interface TorsionFixture {
  name: string
  design: TorsionDesign
  expected: {
    polarMomentM4: number
    twistRad: number
    twistDeg: number
    maxShearStressPa: number
    massKg: number
    plasticityRatio: number
    status: TorsionFixtureStatus
    /** Failed constraints, in the fixed constraint order. */
    failures: readonly TorsionConstraintId[]
    warningCodes: readonly TorsionApplicabilityCode[]
    notApplicableCodes: readonly TorsionApplicabilityCode[]
    /** D / t for tubes, where the worksheet quotes it. */
    slenderness?: number
  }
}

/** The bundled-format (unlinked) Torsion Shaft I config, loaded and frozen. Throws if it fails. */
export function torsionChallenge(): TorsionChallenge {
  const loaded = loadTorsionChallenge(torsionShaftJson)
  if (!loaded.ok) throw new Error(`torsion-shaft-1 failed to load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}

// Locked fields come from the config so fixtures always pass the locked-field check.
const LENGTH_M: number = torsionShaftJson.lengthM
const MATERIAL_ID: string = torsionShaftJson.material.id

export function shaft(id: string, section: TorsionSection): TorsionDesign {
  return { id, section, lengthM: LENGTH_M, materialId: MATERIAL_ID }
}

export const solid = (diameterM: number): TorsionSection => ({ kind: 'circle', diameterM })
export const tube = (outerDiameterM: number, innerDiameterM: number): TorsionSection => ({
  kind: 'tube',
  outerDiameterM,
  innerDiameterM,
})

const row = (
  name: string,
  section: TorsionSection,
  expected: TorsionFixture['expected'],
): TorsionFixture => ({ name, design: shaft(name, section), expected })

export const TORSION_WORKSHEET: readonly TorsionFixture[] = [
  row('baseline', solid(0.03), {
    polarMomentM4: 7.95215640439916e-8,
    twistRad: 0.0509375407801534,
    twistDeg: 2.91850610547831,
    maxShearStressPa: 75451232.2806022,
    massKg: 4.43907041952238,
    plasticityRatio: 0.520353326073119,
    status: 'notAccepted',
    failures: ['twist'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('reference', tube(0.05, 0.044), {
    polarMomentM4: 2.45623850824591e-7,
    twistRad: 0.0164912035121748,
    twistDeg: 0.944876360338937,
    maxShearStressPa: 40712658.6706816,
    massKg: 2.78181746290069,
    plasticityRatio: 0.280776956349528,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
    slenderness: 50 / 3,
  }),
  row('tubeEqualMass', tube(0.05, 0.04), {
    polarMomentM4: 3.62264902867073e-7,
    twistRad: 0.0111814113907654,
    twistDeg: 0.64064768169036,
    maxShearStressPa: 27604109.370952,
    massKg: 4.43907041952238,
    plasticityRatio: 0.190373168075531,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('heavySolid', solid(0.0395), {
    polarMomentM4: 2.38994703762358e-7,
    twistRad: 0.0169486304408658,
    twistDeg: 0.971084992788562,
    maxShearStressPa: 33055125.8067011,
    massKg: 7.69562180228866,
    plasticityRatio: 0.2279663848738,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('oversizeSolid', solid(0.06), {
    polarMomentM4: 1.27234502470387e-6,
    twistRad: 0.00318359629875959,
    twistDeg: 0.182406631592394,
    maxShearStressPa: 9431404.03507528,
    massKg: 17.7562816780895,
    plasticityRatio: 0.0650441657591399,
    status: 'notAccepted',
    failures: ['mass', 'outerDiameter'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('oversizeTube', tube(0.06, 0.056), {
    polarMomentM4: 3.06845637661422e-7,
    twistRad: 0.0132008815320423,
    twistDeg: 0.756354797638215,
    maxShearStressPa: 39107611.5386753,
    massKg: 2.28858741628709,
    plasticityRatio: 0.269707665783967,
    status: 'notAccepted',
    failures: ['outerDiameter'],
    warningCodes: [],
    notApplicableCodes: [],
    slenderness: 30,
  }),
  row('warningSolid', solid(0.025), {
    polarMomentM4: 3.8349519697141e-8,
    twistRad: 0.105624084561726,
    twistDeg: 6.05181426031982,
    maxShearStressPa: 130379729.380881,
    massKg: 3.08268779133499,
    plasticityRatio: 0.899170547454349,
    status: 'notAccepted',
    failures: ['twist', 'shearStress'],
    warningCodes: ['PLASTICITY_SHEAR'],
    notApplicableCodes: [],
  }),
  row('tinySolid', solid(0.01), {
    polarMomentM4: 9.8174770424681e-10,
    twistRad: 4.12594080319243,
    twistDeg: 236.398994543743,
    maxShearStressPa: 2037183271.57626,
    massKg: 0.493230046613597,
    plasticityRatio: 14.0495398039742,
    status: 'modelNotApplicable',
    // The model does not apply; twist, stress and applicability all fail.
    failures: ['twist', 'shearStress', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['PLASTICITY_SHEAR'],
  }),
]

export function worksheetFixture(name: string): TorsionFixture {
  const f = TORSION_WORKSHEET.find((x) => x.name === name)
  if (!f) throw new Error(`unknown torsion fixture ${name}`)
  return f
}

/** Derived targets (worksheet "Derived targets"). */
export const TORSION_DERIVED = {
  /** J ≥ T L / (G φ_lim) meets the twist limit, m⁴. */
  minPolarMomentM4: 2.32084170179574e-7,
  /** Smallest solid diameter meeting the twist limit (quoted to 0.1 µm), m. */
  minSolidDiameterM: 0.0392113,
  /** Mass of that solid (quoted to 0.01 kg) exceeds the 4.5 kg limit, kg. */
  minSolidMassKg: 7.58,
  /** Prediction fixture: baseline → reference twist ratio (a decrease). */
  baselineToReferenceTwistRatio: 0.3237534293881777,
} as const

/** Thin-wall check (worksheet): 2π r_m³ t / J − 1 for D = 50 mm at t = 4, 2, 1, 0.5 mm. */
export const THIN_WALL_ERRORS: readonly { wallM: number; error: number }[] = [
  { wallM: 0.004, error: -7.5e-3 },
  { wallM: 0.002, error: -1.73e-3 },
  { wallM: 0.001, error: -4.16e-4 },
  { wallM: 0.0005, error: -1.02e-4 },
]

/** |actual − expected| ≤ rel · |expected|. */
export function relClose(actual: number, expected: number, rel: number = TORSION_WORKSHEET_REL_TOL): boolean {
  return Math.abs(actual - expected) <= rel * Math.abs(expected)
}

/** Finite double in [lo, hi] (inclusive). */
const between = (lo: number, hi: number): fc.Arbitrary<number> =>
  fc.double({ min: lo, max: hi, noNaN: true, noDefaultInfinity: true })

/** Valid-by-construction shaft sections for `ch` (range edges, minimum wall and d = 0 included). */
export function arbTorsionSection(ch: TorsionChallenge): fc.Arbitrary<TorsionSection> {
  const L = ch.sectionLimits
  const circle = between(L.circle.diameterM.minM, L.circle.diameterM.maxM).map(solid)
  const minD = Math.max(L.tube.outerDiameterM.minM, 2 * L.tube.minWallM)
  const tubes = between(minD, L.tube.outerDiameterM.maxM).chain((D) =>
    between(0, Math.max(0, D - 2 * L.tube.minWallM)).map((d) => tube(D, d)),
  )
  return fc.oneof(circle, tubes)
}

/** Valid-by-construction shaft designs for `ch`. */
export function arbTorsionDesign(ch: TorsionChallenge): fc.Arbitrary<TorsionDesign> {
  return arbTorsionSection(ch).map((s) => shaft('d', s))
}
