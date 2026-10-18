import fc from 'fast-check'
import bracedFrameJson from '../../src/challenge/challenges/braced-frame-1.json'
import { loadBracedFrameChallenge } from '../../src/challenge/bracedFrame/loader'
import type { BracedFrameChallenge } from '../../src/challenge/bracedFrame/types'
import type { BracedFrameConstraintId } from '../../src/evaluation/bracedFrame/types'
import type { BracedFrameDesign, BracedFrameMembers } from '../../src/geometry/bracedFrame/design'
import type { DiagonalId, FrameMemberId } from '../../src/geometry/bracedFrame/template'
import type { BracedFrameApplicabilityCode } from '../../src/physics/bracedFrame/constants'

// Braced Frame I worksheet fixtures (task 49.2; braced-frame-1 design.md "Worksheet"). Every
// expected number is transcribed verbatim from the independently computed worksheet, not
// calculated through the implementation under test. SI units, unrounded. Tolerances (BFR-15):
// displacements, drift, mass and ratios 1e-9 relative; forces and reactions 1e-9 × max|N|;
// utilizations 1e-9 absolute.

export const BRACED_FRAME_WORKSHEET_REL_TOL = 1e-9
export const BRACED_FRAME_UTILIZATION_ABS_TOL = 1e-9

/** The bundled-format (unlinked) Braced Frame I config, loaded and frozen. Throws if it fails. */
export function bracedFrameChallenge(): BracedFrameChallenge {
  const loaded = loadBracedFrameChallenge(bracedFrameJson)
  if (!loaded.ok) throw new Error(`braced-frame-1 failed to load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}

/** Worksheet section shorthand (48 = CHS48.3x3.2, 60 = CHS60.3x4.0, 76 = CHS76.1x4.0, 89 = CHS88.9x5.0). */
export type SectionShorthand = 48 | 60 | 76 | 89
export const SECTION_IDS: Readonly<Record<SectionShorthand, string>> = {
  48: 'CHS48.3x3.2',
  60: 'CHS60.3x4.0',
  76: 'CHS76.1x4.0',
  89: 'CHS88.9x5.0',
}

/** Worksheet "Section catalog" row (ideal annulus). P_E and λ at 3, 4 and 5 m. */
export interface SectionRow {
  id: string
  areaM2: number
  secondMomentM4: number
  radiusOfGyrationM: number
  kgPerM: number
  squashN: number
  eulerN: readonly [number, number, number]
  slenderness: readonly [number, number, number]
}

export const SECTION_TABLE: Readonly<Record<SectionShorthand, SectionRow>> = {
  48: {
    id: 'CHS48.3x3.2',
    areaM2: 4.53394651766079e-4,
    secondMomentM4: 1.15856502109101e-7,
    radiusOfGyrationM: 0.0159853448508313,
    kgPerM: 3.55914801636372,
    squashN: 113348.66294152,
    eulerN: [25410.1742913511, 14293.223038885, 9147.66274488641],
    slenderness: [187.671897478269, 250.229196637692, 312.786495797116],
  },
  60: {
    id: 'CHS60.3x4.0',
    areaM2: 7.07486665588421e-4,
    secondMomentM4: 2.81729149462297e-7,
    radiusOfGyrationM: 0.0199552311437377,
    kgPerM: 5.55377032486911,
    squashN: 176871.666397105,
    eulerN: [61790.1167432945, 34756.9406681031, 22244.442027586],
    slenderness: [150.336519702076, 200.448692936101, 250.560866170126],
  },
  76: {
    id: 'CHS76.1x4.0',
    areaM2: 9.06035321295297e-4,
    secondMomentM4: 5.90554954964426e-7,
    radiusOfGyrationM: 0.0255303985476138,
    kgPerM: 7.11237727216808,
    squashN: 226508.830323824,
    eulerN: [129523.195168934, 72856.7972825253, 46628.3502608162],
    slenderness: [117.506978765139, 156.675971686853, 195.844964608566],
  },
  89: {
    id: 'CHS88.9x5.0',
    areaM2: 1.31789811818092e-3,
    secondMomentM4: 1.16373863317935e-6,
    radiusOfGyrationM: 0.0297157576043418,
    kgPerM: 10.3455002277202,
    squashN: 329474.529545229,
    eulerN: [255236.443016548, 143570.499196808, 91885.1194859573],
    slenderness: [100.956537603526, 134.608716804701, 168.260896005877],
  },
}

/** Worksheet constants: λ_y = π√(E/f_y), λ_c = π√(2E/f_y). */
export const LAMBDA_Y = 88.8576587631673
export const LAMBDA_C = 125.663706143592

/** Member lengths of the template (design.md member table), m. */
export const MEMBER_LENGTH_M: Readonly<Record<FrameMemberId, number>> = {
  col1L: 3, col1R: 3, col2L: 3, col2R: 3, beam1: 4, beam2: 4, diag1a: 5, diag1b: 5, diag2a: 5, diag2b: 5,
}

/** Section shorthands in member order col1L, col1R, col2L, col2R, beam1, beam2. */
export type FixedSizes = readonly [SectionShorthand, SectionShorthand, SectionShorthand, SectionShorthand, SectionShorthand, SectionShorthand]

/** Builds a design; diagonals not listed are absent and keep `absentSection`. */
export function frameDesign(
  id: string,
  fixed: FixedSizes,
  diagonals: Partial<Record<DiagonalId, SectionShorthand>>,
  absentSection: SectionShorthand = 60,
): BracedFrameDesign {
  const [col1L, col1R, col2L, col2R, beam1, beam2] = fixed.map((s) => ({ sectionId: SECTION_IDS[s] }))
  const diag = (d: DiagonalId) => ({ present: diagonals[d] !== undefined, sectionId: SECTION_IDS[diagonals[d] ?? absentSection] })
  const members: BracedFrameMembers = {
    col1L, col1R, col2L, col2R, beam1, beam2,
    diag1a: diag('diag1a'), diag1b: diag('diag1b'), diag2a: diag('diag2a'), diag2b: diag('diag2b'),
  }
  return { id, materialId: bracedFrameJson.material.id, members }
}

export type FixtureStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

export interface SolvedExpectation {
  roofDriftM: number
  floorDriftM: number
  maxStoreyDriftRatio: number
  maxUtilization: number
  governingMemberId: FrameMemberId
  /** 'none': no compression member has λ < λ_c, so the key is absent. */
  maxInelasticRatio: number | 'none'
  /** j3 ux, j3 uy, j4 ux, j4 uy, j5 ux, j5 uy, j6 ux, j6 uy (m). */
  displacementsM: readonly [number, number, number, number, number, number, number, number]
  forcesN: Partial<Record<FrameMemberId, number>>
  utilizations: Partial<Record<FrameMemberId, number>>
  /** (R_j1x, R_j1y, R_j2x, R_j2y), N. */
  reactionsN: readonly [number, number, number, number]
}

export interface BracedFrameFixture {
  name: string
  design: BracedFrameDesign
  expected: {
    status: 'solved' | 'mechanism'
    massKg: number
    evaluation: FixtureStatus
    failures: readonly BracedFrameConstraintId[]
    warningCodes: readonly BracedFrameApplicabilityCode[]
    notApplicableCodes: readonly BracedFrameApplicabilityCode[]
    solved?: SolvedExpectation
  }
}

// Reactions: R_j1y = −35000 and R_j2y = 115000 for every solved fixture; horizontal split per topology.
const reactions = (r1x: number, r2x: number) => [r1x, -35000, r2x, 115000] as const

// Determinate forces (worksheet "Member axial forces"); identical rows share one table.
const TENSION_FORCES = { col1L: -10000, col1R: -115000, col2L: -40000, col2R: -70000, beam1: -60000, beam2: -40000, diag1a: 75000, diag2a: 50000 }

const REFERENCE_FIXED: FixedSizes = [48, 89, 60, 76, 76, 76]

export const BRACED_FRAME_WORKSHEET: readonly BracedFrameFixture[] = [
  {
    // Challenge v2 baseline (task 59): light lower columns and compression diagonals under heavy
    // upper columns and beams. It fails roof drift, utilization and mass, the most checks any
    // applicable design fails (exhaustive search). Values from an independent direct-stiffness
    // calculation that reproduces the uniform60 row exactly; the topology matches uniform60, so
    // the determinate forces and reactions are the same.
    name: 'baseline',
    design: frameDesign('baseline', [48, 48, 89, 89, 89, 89], { diag1b: 48, diag2b: 48 }),
    expected: {
      status: 'solved', massKg: 201.783371449902, evaluation: 'notAccepted', failures: ['roofDrift', 'utilization', 'mass'], warningCodes: [], notApplicableCodes: [],
      solved: {
        roofDriftM: 0.0126110214225009, floorDriftM: 0.00634129986093538, maxStoreyDriftRatio: 0.00211376662031179,
        maxUtilization: 8.19881559821664, governingMemberId: 'diag1b', maxInelasticRatio: 0.179253108943073,
        displacementsM: [0.00603778626266716, 0.00115793161201836, 0.00664481345920359, -0.00231586322403672, 0.0126110214225009, 0.00104411401266778, 0.0126110214225009, -0.00277113362143905],
        forcesN: { col1L: 35000, col1R: -70000, col2L: -10000, col2R: -40000, beam1: 40000, beam2: 0, diag1b: -75000, diag2b: -50000 },
        utilizations: { col1L: 0.308781763204896, col1R: 2.75480204100079, col2L: 0.0391793580956294, col2R: 0.156717432382517, beam1: 0.121405439307286, beam2: 0, diag1b: 8.19881559821664, diag2b: 5.46587706547775 },
        reactionsN: reactions(0, -60000),
      },
    },
  },
  {
    // The challenge v1 baseline (every member CHS60.3x4.0), kept as a worksheet row.
    name: 'uniform60',
    design: frameDesign('uniform60', [60, 60, 60, 60, 60, 60], { diag1b: 60, diag2b: 60 }),
    expected: {
      status: 'solved', massKg: 166.613109746073, evaluation: 'notAccepted', failures: ['utilization'], warningCodes: [], notApplicableCodes: [],
      solved: {
        roofDriftM: 0.00871924560566722, floorDriftM: 0.00443471255728971, maxStoreyDriftRatio: 0.00147823751909657,
        maxUtilization: 3.37162873795576, governingMemberId: 'diag1b', maxInelasticRatio: 'none',
        displacementsM: [0.00386933087667907, 0.000742063455801465, 0.00500009423790035, -0.00148412691160293, 0.00871924560566722, 0.000530045325572474, 0.00871924560566722, -0.00233219943251889],
        forcesN: { col1L: 35000, col1R: -70000, col2L: -10000, col2R: -40000, beam1: 40000, beam2: 0, diag1b: -75000, diag2b: -50000 },
        utilizations: { col1L: 0.197883588213724, col1R: 1.13286725595314, col2L: 0.161838179421877, col2R: 0.647352717687507, beam1: 0.226152672244256, beam2: 0, diag1b: 3.37162873795576, diag2b: 2.24775249197051 },
        reactionsN: reactions(0, -60000),
      },
    },
  },
  {
    name: 'reference',
    design: frameDesign('reference', REFERENCE_FIXED, { diag1a: 76, diag2a: 48 }),
    expected: {
      status: 'solved', massKg: 189.969032143367, evaluation: 'accepted', failures: [], warningCodes: [], notApplicableCodes: [],
      solved: {
        roofDriftM: 0.0103833770829032, floorDriftM: 0.0042307223126149, maxStoreyDriftRatio: 0.00205088492342945,
        maxUtilization: 0.823533317932313, governingMemberId: 'beam1', maxInelasticRatio: 0.549106807468971,
        displacementsM: [0.00489294815072264, -0.000330837603433816, 0.00356849647450715, -0.00130890239253168, 0.0108248609749751, -0.00117891012434978, 0.0099418931908314, -0.00246779760922024],
        forcesN: TENSION_FORCES,
        utilizations: { col1L: 0.393543148714396, col1R: 0.450562618099737, col2L: 0.647352717687507, col2R: 0.540443739893081, beam1: 0.823533317932313, beam2: 0.549022211954875, diag1a: 0.331112919053874, diag2a: 0.441116804578425 },
        reactionsN: reactions(-60000, 0),
      },
    },
  },
  {
    name: 'uniformS3Tension',
    design: frameDesign('uniformS3Tension', [76, 76, 76, 76, 76, 76], { diag1a: 76, diag2a: 76 }, 76),
    expected: {
      status: 'solved', massKg: 213.371318165042, evaluation: 'notAccepted', failures: ['mass'], warningCodes: ['INELASTIC_BUCKLING'], notApplicableCodes: [],
      solved: {
        roofDriftM: 0.00967815469651219, floorDriftM: 0.00467696998163597, maxStoreyDriftRatio: 0.00166706157162541,
        maxUtilization: 0.887871858395775, governingMemberId: 'col1R', maxInelasticRatio: 0.902104040841882,
        displacementsM: [0.00533919581974372, -0.000165556459526936, 0.00401474414352822, -0.00190389928455978, 0.010119638588584, -0.000827782297634684, 0.00923667080444036, -0.00306279450124833],
        forcesN: TENSION_FORCES,
        utilizations: { col1L: 0.0772062485561539, col1R: 0.887871858395775, col2L: 0.308824994224617, col2R: 0.54044373989308, beam1: 0.823533317932313, beam2: 0.549022211954876, diag1a: 0.331112919053874, diag2a: 0.220741946035916 },
        reactionsN: reactions(-60000, 0),
      },
    },
  },
  {
    name: 'bucklingBeam',
    design: frameDesign('bucklingBeam', [48, 89, 60, 76, 76, 60], { diag1a: 76, diag2a: 48 }),
    expected: {
      status: 'solved', massKg: 183.734604354171, evaluation: 'notAccepted', failures: ['utilization'], warningCodes: [], notApplicableCodes: [],
      solved: {
        roofDriftM: 0.010507274871442, floorDriftM: 0.00423072231261489, maxStoreyDriftRatio: 0.00209218418627571,
        maxUtilization: 1.1508492758889, governingMemberId: 'beam2', maxInelasticRatio: 0.549106807468971,
        displacementsM: [0.00489294815072264, -0.000330837603433818, 0.00356849647450715, -0.00130890239253168, 0.0110726565520527, -0.00117891012434978, 0.00994189319083139, -0.00246779760922024],
        forcesN: TENSION_FORCES,
        utilizations: { col1L: 0.3935431487144, col1R: 0.450562618099736, col2L: 0.647352717687507, col2R: 0.54044373989308, beam1: 0.823533317932313, beam2: 1.1508492758889, diag1a: 0.331112919053874, diag2a: 0.441116804578423 },
        reactionsN: reactions(-60000, 0),
      },
    },
  },
  {
    name: 'lightLowerDiagonal',
    design: frameDesign('lightLowerDiagonal', REFERENCE_FIXED, { diag1a: 48, diag2a: 48 }),
    expected: {
      status: 'solved', massKg: 172.202885864345, evaluation: 'notAccepted', failures: ['roofDrift'], warningCodes: [], notApplicableCodes: [],
      solved: {
        roofDriftM: 0.0129658949564483, floorDriftM: 0.00681324018615991, maxStoreyDriftRatio: 0.0022710800620533,
        maxUtilization: 0.823533317932313, governingMemberId: 'beam1', maxInelasticRatio: 0.549106807468972,
        displacementsM: [0.00747546602426766, -0.000330837603433815, 0.00615101434805217, -0.00130890239253168, 0.0134073788485201, -0.00117891012434978, 0.0125244110643764, -0.00246779760922024],
        forcesN: TENSION_FORCES,
        utilizations: { col1L: 0.393543148714396, col1R: 0.450562618099737, col2L: 0.647352717687507, col2R: 0.540443739893081, beam1: 0.823533317932313, beam2: 0.549022211954875, diag1a: 0.661675206867636, diag2a: 0.441116804578425 },
        reactionsN: reactions(-60000, 0),
      },
    },
  },
  {
    name: 'xBracedLight',
    design: frameDesign('xBracedLight', [48, 76, 48, 60, 48, 48], { diag1a: 60, diag1b: 76, diag2a: 48, diag2b: 76 }),
    expected: {
      status: 'solved', massKg: 204.514879448049, evaluation: 'notAccepted', failures: ['mass'], warningCodes: [], notApplicableCodes: [],
      solved: {
        roofDriftM: 0.00488079468697318, floorDriftM: 0.00219573515244064, maxStoreyDriftRatio: 0.000895019844844177,
        maxUtilization: 0.967234281408341, governingMemberId: 'diag1b', maxInelasticRatio: 0.689832501636244,
        displacementsM: [0.00197887422261948, 0.000564419647923024, 0.00241259608226181, -0.00145589815239674, 0.00501860117600189, 7.8549744331901e-5, 0.00474298819794446, -0.0024033235221524],
        forcesN: { col1L: 17060.3233146662, col1R: -87939.6766853337, col2L: -14686.054382821, col2R: -44686.054382821, beam1: 9832.35857579365, beam2: -6248.07251042798, diag1a: 29899.4611422229, diag1b: -45100.538857777, diag2a: 7810.09063803497, diag2b: -42189.9093619649 },
        utilizations: { col1L: 0.150511906112806, col1R: 0.678949253611572, col2L: 0.57795960840063, col2R: 0.723190968686273, beam1: 0.0867443719284671, beam2: 0.437135311848837, diag1a: 0.169046075899425, diag1b: 0.967234281408341, diag2a: 0.068903244514357, diag2b: 0.904812396878191 },
        reactionsN: reactions(-23919.5689137783, -36080.4310862216),
      },
    },
  },
  {
    name: 'lowerXUpperSingle',
    design: frameDesign('lowerXUpperSingle', REFERENCE_FIXED, { diag1a: 76, diag1b: 76, diag2a: 48 }),
    expected: {
      status: 'solved', massKg: 225.530918504207, evaluation: 'notAccepted', failures: ['utilization', 'mass'], warningCodes: [], notApplicableCodes: [],
      solved: {
        roofDriftM: 0.00809335099266114, floorDriftM: 0.00189556580467987, maxStoreyDriftRatio: 0.00206592839599376,
        maxUtilization: 1.03380898377513, governingMemberId: 'diag1b', maxInelasticRatio: 0.549106807468971,
        displacementsM: [0.00213215872305261, 0.000626040173783641, 0.00165897288630713, -0.000979709065218155, 0.00853483488473298, -0.00022203234713232, 0.00765186710058931, -0.00213860428190671],
        forcesN: { col1L: 18922.8844389473, col1R: -86077.1155610528, col2L: -40000, col2R: -70000, beam1: -21436.1540814037, beam2: -40000, diag1a: 26795.1926017546, diag1b: -48204.8073982455, diag2a: 50000.0000000001 },
        utilizations: { col1L: 0.166944046342304, col1R: 0.337244613440535, col2L: 0.647352717687507, col2R: 0.54044373989308, beam1: 0.294223118239444, beam2: 0.549022211954875, diag1a: 0.11829645918637, diag1b: 1.03380898377513, diag2a: 0.441116804578424 },
        reactionsN: reactions(-21436.1540814037, -38563.8459185964),
      },
    },
  },
  {
    name: 'mixedLight',
    design: frameDesign('mixedLight', [48, 76, 48, 60, 60, 48], { diag1a: 48, diag2b: 89 }),
    expected: {
      status: 'solved', massKg: 165.328245474645, evaluation: 'accepted', failures: [], warningCodes: ['INELASTIC_BUCKLING'], notApplicableCodes: [],
      solved: {
        roofDriftM: 0.00871453006857754, floorDriftM: 0.00687995285737854, maxStoreyDriftRatio: 0.00229331761912618,
        maxUtilization: 0.887871858395774, governingMemberId: 'col1R', maxInelasticRatio: 0.90210404084188,
        displacementsM: [0.00716264369768387, -0.00033083760343382, 0.00659726201707322, -0.00190389928455977, 0.00871453006857754, -0.00066167520686764, 0.00871453006857754, -0.00275197180547573],
        forcesN: { col1L: -10000, col1R: -115000, col2L: -10000, col2R: -40000, beam1: -20000, beam2: 0, diag1a: 75000, diag2b: -50000 },
        utilizations: { col1L: 0.393543148714402, col1R: 0.887871858395774, col2L: 0.393543148714402, col2R: 0.647352717687507, beam1: 0.575424637944451, beam2: 0, diag1a: 0.661675206867635, diag2b: 0.544157751328183 },
        reactionsN: reactions(-60000, 0),
      },
    },
  },
  {
    name: 'bruteForce',
    design: frameDesign('bruteForce', [89, 89, 89, 89, 89, 89], { diag1a: 89, diag1b: 89, diag2a: 89, diag2b: 89 }),
    expected: {
      status: 'solved', massKg: 413.820009108808, evaluation: 'notAccepted', failures: ['mass'], warningCodes: [], notApplicableCodes: [],
      solved: {
        roofDriftM: 0.00295451518314216, floorDriftM: 0.00133735679236932, maxStoreyDriftRatio: 0.000539052796924279,
        maxUtilization: 0.514701278012485, governingMemberId: 'diag1b', maxInelasticRatio: 0.388190384584055,
        displacementsM: [0.00127828451766506, 0.000209151596823154, 0.00139642906707359, -0.000985933196357944, 0.00303076983923599, 9.54750936701193e-6, 0.00287826052704833, -0.00152699008186583],
        forcesN: { col1L: 18376.0330578513, col1R: -86623.9669421488, col2L: -17537.1900826446, col2R: -47537.1900826446, beam1: 7785.12396694214, beam2: -10049.5867768595, diag1a: 27706.6115702479, diag1b: -47293.3884297521, diag2a: 12561.9834710744, diag2b: -37438.0165289256 },
        utilizations: { col1L: 0.0557737591528411, col1R: 0.33938714204904, col2L: 0.0687095850239051, col2R: 0.186247659310793, beam1: 0.0236289098817073, beam2: 0.0699975749410985, diag1a: 0.0840933337350572, diag1b: 0.514701278012485, diag2a: 0.0381273280469163, diag2b: 0.407443737771351 },
        reactionsN: reactions(-22165.2892561983, -37834.7107438017),
      },
    },
  },
  // Mechanisms use the reference sections (diag1b = 76 and diag2b = 48 where present).
  {
    name: 'upperUnbraced',
    design: frameDesign('upperUnbraced', REFERENCE_FIXED, { diag1a: 76 }),
    expected: { status: 'mechanism', massKg: 172.173292061548, evaluation: 'modelNotApplicable', failures: ['stability', 'applicability'], warningCodes: [], notApplicableCodes: ['MECHANISM'] },
  },
  {
    name: 'unbraced',
    design: frameDesign('unbraced', REFERENCE_FIXED, {}),
    expected: { status: 'mechanism', massKg: 136.611405700708, evaluation: 'modelNotApplicable', failures: ['stability', 'applicability'], warningCodes: [], notApplicableCodes: ['MECHANISM'] },
  },
  {
    name: 'lowerXOnly',
    design: frameDesign('lowerXOnly', REFERENCE_FIXED, { diag1a: 76, diag1b: 76 }),
    expected: { status: 'mechanism', massKg: 207.735178422389, evaluation: 'modelNotApplicable', failures: ['stability', 'mass', 'applicability'], warningCodes: [], notApplicableCodes: ['MECHANISM'] },
  },
  {
    name: 'upperXOnly',
    design: frameDesign('upperXOnly', REFERENCE_FIXED, { diag2a: 48, diag2b: 48 }),
    expected: { status: 'mechanism', massKg: 172.202885864345, evaluation: 'modelNotApplicable', failures: ['stability', 'applicability'], warningCodes: [], notApplicableCodes: ['MECHANISM'] },
  },
]

export function worksheetFixture(name: string): BracedFrameFixture {
  const f = BRACED_FRAME_WORKSHEET.find((x) => x.name === name)
  if (!f) throw new Error(`unknown braced-frame fixture ${name}`)
  return f
}

/** Test-only screen fixtures (constructed configs, never bundled). */
export const SCREEN_FIXTURES = {
  /** mixedLight with every load × 1.12: modelNotApplicable (INELASTIC_BUCKLING) although every constraint passes. */
  mixedLightLoads112: { loadFactor: 1.12, maxUtilization: 0.994416481403267, governingMemberId: 'col1R', maxInelasticRatio: 1.01035652574291, roofDriftM: 0.00976027367680685 },
  /** uniformS3Tension with loads × 1.12: u_J 1.01035652574291, modelNotApplicable (mass also fails). */
  uniformLoads112: { loadFactor: 1.12, maxInelasticRatio: 1.01035652574291 },
  /** uniform60 with E = 20 GPa: LARGE_DRIFT warning. */
  uniform60E20: { elasticModulusPa: 20e9, maxStoreyDriftRatio: 0.0147823751909657 },
  /** uniform60 with E = 10 GPa: modelNotApplicable (LARGE_DRIFT). */
  uniform60E10: { elasticModulusPa: 10e9, maxStoreyDriftRatio: 0.0295647503819314 },
} as const

/** Prediction fixtures: |roof drift| ratios (band 0.98/1.02). */
export const PREDICTION_FIXTURES = [
  { prev: 'baseline', next: 'reference', ratio: 0.823357342362207, actual: 'decrease' },
  { prev: 'uniform60', next: 'reference', ratio: 1.19085727739501, actual: 'increase' },
  { prev: 'reference', next: 'bucklingBeam', ratio: 1.01193232101171, actual: 'same' },
  { prev: 'reference', next: 'lightLowerDiagonal', ratio: 1.24871656426668, actual: 'increase' },
  { prev: 'reference', next: 'bruteForce', ratio: 0.284542799471949, actual: 'decrease' },
] as const

/** Force-method fixtures (design.md check (c)): flexibility f, δ₀ and redundants X. */
export const FORCE_METHOD_FIXTURES = {
  xBracedLight: {
    f: [[1.09030760052261e-7, 2.82314754930191e-8], [2.82314754930191e-8, 1.58738101224692e-7]],
    delta0: [0.00610842942263497, 0.00797040086044546],
    X: [-45100.5388577771, -42189.909361965],
  },
  bruteForce: {
    f: [[5.58465020813516e-8, 9.7124351445829e-9], [9.7124351445829e-9, 6.55589372259345e-8]],
    delta0: [0.00300478462285533, 0.00291373054337487],
    X: [-47293.3884297521, -37438.0165289256],
  },
  lowerXUpperSingle: { f11: 8.53205583555159e-8, delta10: 0.0041128610826384, X1: -48204.8073982454 },
} as const

/** Gravity only: the X-braced design (xBracedLight) develops diagonal compression from column shortening, N. */
export const GRAVITY_ONLY_X_DIAGONAL_N = -9226.37973977006

/** Worksheet design-space findings used as bounds. */
export const DESIGN_SPACE = {
  /** Largest |pivot ratio| over all mechanism designs. */
  maxMechanismPivotRatio: 8.4e-16,
  /** Smallest pivot ratio over all stable designs. */
  minStablePivotRatio: 1.52423315467957e-2,
  /** Largest storey drift ratio of any stable design. */
  maxStableStoreyDriftRatio: 0.00338560586893078,
  /** Roof drift range over stable designs, m. */
  minStableRoofDriftM: 0.00281880446108180,
  maxStableRoofDriftM: 0.0195029799037977,
} as const

/** |actual − expected| ≤ rel · |expected|. */
export function relClose(actual: number, expected: number, rel: number = BRACED_FRAME_WORKSHEET_REL_TOL): boolean {
  return Math.abs(actual - expected) <= rel * Math.abs(expected)
}

const SHORTHANDS: readonly SectionShorthand[] = [48, 60, 76, 89]
const arbSize = fc.constantFrom(...SHORTHANDS)
const arbFixed: fc.Arbitrary<FixedSizes> = fc.tuple(arbSize, arbSize, arbSize, arbSize, arbSize, arbSize)
const arbDiagSizes = fc.tuple(arbSize, arbSize, arbSize, arbSize)

/** Any of the 16 diagonal sets with random sections for all 10 members (mechanisms included). */
export function arbBracedFrameDesign(): fc.Arbitrary<BracedFrameDesign> {
  return fc.tuple(arbFixed, fc.tuple(fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean()), arbDiagSizes).map(([fixed, present, sizes]) => {
    const d = frameDesign('d', fixed, {})
    const ids: DiagonalId[] = ['diag1a', 'diag1b', 'diag2a', 'diag2b']
    ids.forEach((id, k) => (d.members[id] = { present: present[k], sectionId: SECTION_IDS[sizes[k]] }))
    return d
  })
}

/** Storey bracing options with at least one diagonal. */
type StoreyBracing = 'a' | 'b' | 'x'
const arbBracing = fc.constantFrom<StoreyBracing>('a', 'b', 'x')

/** One of the 9 stable topologies with random sections. */
export function arbStableBracedFrameDesign(): fc.Arbitrary<BracedFrameDesign> {
  return fc.tuple(arbFixed, arbBracing, arbBracing, arbDiagSizes).map(([fixed, s1, s2, sizes]) => {
    const diagonals: Partial<Record<DiagonalId, SectionShorthand>> = {}
    if (s1 !== 'b') diagonals.diag1a = sizes[0]
    if (s1 !== 'a') diagonals.diag1b = sizes[1]
    if (s2 !== 'b') diagonals.diag2a = sizes[2]
    if (s2 !== 'a') diagonals.diag2b = sizes[3]
    return frameDesign('d', fixed, diagonals)
  })
}

/** Topology rule used as a test oracle only: a mechanism iff some storey has no diagonal. */
export function hasUnbracedStorey(d: BracedFrameDesign): boolean {
  const m = d.members
  return !(m.diag1a.present || m.diag1b.present) || !(m.diag2a.present || m.diag2b.present)
}
