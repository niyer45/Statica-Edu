import fc from 'fast-check'
import fatigueJson from '../../src/challenge/challenges/fatigue-analysis-1.json'
import { loadFatigueChallenge } from '../../src/challenge/fatigue/loader'
import type { FatigueChallenge } from '../../src/challenge/fatigue/types'
import type { FatigueConstraintId } from '../../src/evaluation/fatigue/types'
import type { FatigueDesign, SurfaceFinishId } from '../../src/geometry/fatigue/design'
import type { FatigueApplicabilityCode } from '../../src/physics/fatigue/constants'

// Fatigue Analysis I worksheet fixtures (task 70, `steppedShaftFatigue` v1). Every expected number
// is transcribed (15 significant figures) from the standalone script
// .kiro/specs/fatigue-analysis-1/worksheet.py (run `python3 -I worksheet.py` in that folder), which
// was written from design.md without application code. Stresses in MPa as printed by the script
// (converted to Pa in the tests), lengths in m. Assert at FATIGUE_WORKSHEET_REL_TOL.

export const FATIGUE_WORKSHEET_REL_TOL = 1e-9

export type FatigueFixtureStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

export interface FatigueFixture {
  name: string
  design: FatigueDesign
  expected: {
    kt: number
    q: number
    kf: number
    saNomMpa: number
    smNomMpa: number
    saMpa: number
    smMpa: number
    ka: number
    kb: number
    seMpa: number
    a: number
    b: number
    sfMpa: number
    nf: number
    ny: number
    srevMpa: number
    /** Cycles in the finite-life regime; 'inf' at or below the endurance limit; 'none' below 10³ cycles. */
    life: number | 'inf' | 'none'
    faceM: number
    massKg: number
    screens: Record<FatigueApplicabilityCode, number>
    status: FatigueFixtureStatus
    failures: readonly FatigueConstraintId[]
    notApplicableCodes: readonly FatigueApplicabilityCode[]
  }
}

/** The bundled Fatigue Analysis I config, loaded and frozen. Throws if it fails. */
export function fatigueChallenge(): FatigueChallenge {
  const loaded = loadFatigueChallenge(fatigueJson)
  if (!loaded.ok) throw new Error(`fatigue-analysis-1 failed to load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}

const MATERIAL_ID: string = fatigueJson.material.id

/** A spindle design from d, D, r in metres and a finish. */
export function spindle(id: string, neckDiameterM: number, collarDiameterM: number, filletRadiusM: number, surfaceFinish: SurfaceFinishId): FatigueDesign {
  return { id, neckDiameterM, collarDiameterM, filletRadiusM, surfaceFinish, materialId: MATERIAL_ID }
}

/** Common values printed by the script. */
export const FATIGUE_COMMON = Object.freeze({ f: 0.861762675002838, sqrtAMm: 0.354770683, sePrimeMpa: 315, asForgedAMpa: 54.8783564212633 })

type Row = [string, FatigueDesign, Omit<FatigueFixture['expected'], 'screens'> & { screens: [number, number, number] }]

const ROWS: Row[] = [
  ['baseline', spindle('baseline', 0.022, 0.045, 0.001, 'asForged'), { kt: 2.35562875537179, q: 0.738132299841035, kf: 2.00063337093322, saNomMpa: 95.6603715052715, smNomMpa: 143.490557257907, saMpa: 191.381331509315, smMpa: 287.071997263973, ka: 0.414477499764025, kb: 0.990797435537805, seMpa: 116.034952867257, a: 2540.19834293832, b: -0.223379799700228, sfMpa: 166.235819897718, nf: 0.622303118562314, ny: 1.1077360489034, srevMpa: 351.590531799407, life: 6993.74165928361, faceM: 0.0105, massKg: 0.678437929117003, screens: [0.681818181818182, 0.90274212976092, 0.808179756532854], status: 'notAccepted', failures: ['fatigueSafetyFactor', 'yieldSafetyFactor', 'mass'], notApplicableCodes: [] }],
  ['reference', spindle('reference', 0.0245, 0.034, 0.002, 'machined'), { kt: 1.81741860174942, q: 0.79944949542206, kf: 1.65348488871718, saNomMpa: 69.2630883926344, smNomMpa: 103.894632588952, saMpa: 114.525470003103, smMpa: 171.788205004655, ka: 0.750614041524979, kb: 0.979452388528414, seMpa: 207.731812712647, a: 1418.90542015371, b: -0.139075072804064, sfMpa: 259.843773858506, nf: 1.40168491090465, ny: 1.85111661182665, srevMpa: 157.462219196449, life: 'inf', faceM: 0.00275, massKg: 0.507132968552518, screens: [0.462585034013605, 0.540214481146714, 0.483626933379413], status: 'accepted', failures: [], notApplicableCodes: [] }],
  ['filletOnly', spindle('filletOnly', 0.022, 0.045, 0.005, 'asForged'), { kt: 1.42868687110224, q: 0.863067242121683, kf: 1.36998559557598, saNomMpa: 95.6603715052715, smNomMpa: 143.490557257907, saMpa: 131.053331029669, smMpa: 196.579996544504, ka: 0.414477499764025, kb: 0.990797435537805, seMpa: 116.034952867257, a: 2540.19834293832, b: -0.223379799700228, sfMpa: 166.235819897718, nf: 0.908768960675195, ny: 1.6176620489868, srevMpa: 190.493281090958, life: 108695.539878229, faceM: 0.0065, massKg: 0.678437929117003, screens: [0.757575757575758, 0.618176089762591, 0.553422051822345], status: 'notAccepted', failures: ['fatigueSafetyFactor', 'mass'], notApplicableCodes: [] }],
  ['finishOnly', spindle('finishOnly', 0.022, 0.045, 0.001, 'ground'), { kt: 2.35562875537179, q: 0.738132299841035, kf: 2.00063337093322, saNomMpa: 95.6603715052715, smNomMpa: 143.490557257907, saMpa: 191.381331509315, smMpa: 287.071997263973, ka: 0.896031483553748, kb: 0.990797435537805, seMpa: 250.848287351982, a: 1175.02016102165, b: -0.111772363007547, sfMpa: 300.287095523025, nf: 0.914915012384168, ny: 1.1077360489034, srevMpa: 351.590531799407, life: 48772.2460469185, faceM: 0.0105, massKg: 0.678437929117003, screens: [0.681818181818182, 0.90274212976092, 0.808179756532854], status: 'notAccepted', failures: ['fatigueSafetyFactor', 'yieldSafetyFactor', 'mass'], notApplicableCodes: [] }],
  ['neckOnly', spindle('neckOnly', 0.03, 0.045, 0.001, 'asForged'), { kt: 2.48338268046601, q: 0.738132299841035, kf: 2.09493266947674, saNomMpa: 37.7256161403011, smNomMpa: 56.5884242104517, saMpa: 79.0326257284557, smMpa: 118.548938592684, ka: 0.414477499764025, kb: 0.95845588080353, seMpa: 112.247346395296, a: 2625.9132573016, b: -0.228184048835904, sfMpa: 162.057781152642, nf: 1.47960799203776, ny: 2.68243650069783, srevMpa: 97.3515512352691, life: 'inf', faceM: 0.0065, massKg: 0.832325703660446, screens: [0.5, 0.372795404379508, 0.333745029965301], status: 'notAccepted', failures: ['mass'], notApplicableCodes: [] }],
  ['collarOnly', spindle('collarOnly', 0.022, 0.034, 0.001, 'asForged'), { kt: 2.25484388281574, q: 0.738132299841035, kf: 1.92624080116424, saNomMpa: 95.6603715052715, smNomMpa: 143.490557257907, saMpa: 184.264910647983, smMpa: 276.397365971974, ka: 0.414477499764025, kb: 0.990797435537805, seMpa: 116.034952867257, a: 2540.19834293832, b: -0.223379799700228, sfMpa: 166.235819897718, nf: 0.646336836536266, ny: 1.15051747646627, srevMpa: 328.297593221628, life: 9505.56646499732, faceM: 0.005, massKg: 0.464129473863395, screens: [0.515151515151515, 0.869174106830107, 0.778127989028995], status: 'notAccepted', failures: ['fatigueSafetyFactor', 'yieldSafetyFactor'], notApplicableCodes: [] }],
  ['referenceGround', spindle('referenceGround', 0.0245, 0.034, 0.002, 'ground'), { kt: 1.81741860174942, q: 0.79944949542206, kf: 1.65348488871718, saNomMpa: 69.2630883926344, smNomMpa: 103.894632588952, saMpa: 114.525470003103, smMpa: 171.788205004655, ka: 0.896031483553748, kb: 0.979452388528414, seMpa: 247.975969045376, a: 1188.63047952198, b: -0.113439544400557, sfMpa: 297.646263440692, nf: 1.521028020035, ny: 1.85111661182665, srevMpa: 157.462219196449, life: 'inf', faceM: 0.00275, massKg: 0.507132968552518, screens: [0.462585034013605, 0.540214481146714, 0.483626933379413], status: 'accepted', failures: [], notApplicableCodes: [] }],
  ['referenceForged', spindle('referenceForged', 0.0245, 0.034, 0.002, 'asForged'), { kt: 1.81741860174942, q: 0.79944949542206, kf: 1.65348488871718, saNomMpa: 69.2630883926344, smNomMpa: 103.894632588952, saMpa: 114.525470003103, smMpa: 171.788205004655, ka: 0.414477499764025, kb: 0.979452388528414, seMpa: 114.706303894425, a: 2569.62159000101, b: -0.225046981093237, sfMpa: 164.773882661774, nf: 1.03335040778922, ny: 1.85111661182665, srevMpa: 157.462219196449, life: 244692.483252917, faceM: 0.00275, massKg: 0.507132968552518, screens: [0.462585034013605, 0.540214481146714, 0.483626933379413], status: 'notAccepted', failures: ['fatigueSafetyFactor'], notApplicableCodes: [] }],
  ['referenceSharp', spindle('referenceSharp', 0.0245, 0.034, 0.0005, 'machined'), { kt: 2.84947147100343, q: 0.665902427572684, kf: 2.23156754226761, saNomMpa: 69.2630883926344, smNomMpa: 103.894632588952, saMpa: 154.565259934215, smMpa: 231.847889901322, ka: 0.750614041524979, kb: 0.979452388528414, seMpa: 207.731812712647, a: 1418.90542015371, b: -0.139075072804064, sfMpa: 259.843773858506, nf: 1.03858152398499, ny: 1.37158893331031, srevMpa: 244.570131084881, life: 309172.230609304, faceM: 0.00425, massKg: 0.507132968552518, screens: [0.475, 0.729081414784033, 0.652710027445864], status: 'notAccepted', failures: ['fatigueSafetyFactor', 'yieldSafetyFactor'], notApplicableCodes: [] }],
  ['crowdedShoulder', spindle('crowdedShoulder', 0.0245, 0.034, 0.004, 'machined'), { kt: 1.53182688918085, q: 0.849339604250543, kf: 1.45170163958666, saNomMpa: 69.2630883926344, smNomMpa: 103.894632588952, saMpa: 100.549338982423, smMpa: 150.824008473634, ka: 0.750614041524979, kb: 0.979452388528414, seMpa: 207.731812712647, a: 1418.90542015371, b: -0.139075072804064, sfMpa: 259.843773858506, nf: 1.59651594771474, ny: 2.10841763999125, srevMpa: 132.197949561588, life: 'inf', faceM: 0.000750000000000001, massKg: 0.507132968552518, screens: [0.54421768707483, 0.474289334822749, 0.42460745600152], status: 'notAccepted', failures: ['shoulderFace'], notApplicableCodes: [] }],
  ['allMax', spindle('allMax', 0.04, 0.06, 0.005, 'ground'), { kt: 1.62803770457043, q: 0.863067242121683, kf: 1.54203876963203, saNomMpa: 15.9154943091895, smNomMpa: 23.8732414637843, saMpa: 24.5423092626283, smMpa: 36.8134638939424, ka: 0.896031483553748, kb: 0.929402168855768, seMpa: 235.304345728488, a: 1252.6406772633, b: -0.121032760415586, sfMpa: 285.909257128207, nf: 6.93127621249692, ny: 8.63814393875406, srevMpa: 26.0654176963507, life: 'inf', faceM: 0.005, massKg: 1.47969013984079, screens: [0.5, 0.115765609729379, 0.103639144780741], status: 'notAccepted', failures: ['mass'], notApplicableCodes: [] }],
  ['fitRangeNA', spindle('fitRangeNA', 0.02, 0.06, 0.0005, 'machined'), { kt: 3.34902658119523, q: 0.665902427572684, kf: 2.56422250285067, saNomMpa: 127.323954473516, smNomMpa: 190.985931710274, saMpa: 326.486949212924, smMpa: 489.730423819386, ka: 0.750614041524979, kb: 1.00095347386193, seMpa: 212.291972536579, a: 1388.4264745128, b: -0.135931552307077, sfMpa: 264.207809285913, nf: 0.49675367415262, ny: 0.649336828044972, srevMpa: 1466.36771568551, life: 'none', faceM: 0.0195, massKg: 1.03578309788855, screens: [2, 1.54003277930625, 1.37871411513935], status: 'modelNotApplicable', failures: ['fatigueSafetyFactor', 'yieldSafetyFactor', 'mass', 'applicability'], notApplicableCodes: ['KT_FIT_RANGE', 'LOCAL_YIELD', 'LOW_CYCLE'] }],
  ['localYieldNA', spindle('localYieldNA', 0.02, 0.04, 0.0005, 'machined'), { kt: 2.94529863227605, q: 0.665902427572684, kf: 2.29537908158644, saNomMpa: 127.323954473516, smNomMpa: 190.985931710274, saMpa: 292.256741683373, smMpa: 438.38511252506, ka: 0.750614041524979, kb: 1.00095347386193, seMpa: 212.291972536579, a: 1388.4264745128, b: -0.135931552307077, sfMpa: 264.207809285913, nf: 0.554935330662473, ny: 0.725389596759679, srevMpa: 960.89479104073, life: 'none', faceM: 0.0095, massKg: 0.542553051274957, screens: [1, 1.37856953624233, 1.23416417095655], status: 'modelNotApplicable', failures: ['fatigueSafetyFactor', 'yieldSafetyFactor', 'mass', 'applicability'], notApplicableCodes: ['LOCAL_YIELD', 'LOW_CYCLE'] }],
]

export const FATIGUE_WORKSHEET: readonly FatigueFixture[] = ROWS.map(([name, design, e]) => ({
  name,
  design,
  expected: { ...e, screens: { KT_FIT_RANGE: e.screens[0], LOCAL_YIELD: e.screens[1], LOW_CYCLE: e.screens[2] } },
}))

export function worksheetFixture(name: string): FatigueFixture {
  const f = FATIGUE_WORKSHEET.find((x) => x.name === name)
  if (!f) throw new Error(`no fatigue worksheet row ${name}`)
  return f
}

export function relClose(actual: number, expected: number, tol = FATIGUE_WORKSHEET_REL_TOL): boolean {
  if (expected === 0) return Math.abs(actual) <= tol
  return Math.abs(actual - expected) <= tol * Math.abs(expected)
}

/** Values of a ParamRange grid, rounded to nanometres. */
export function gridValues(r: { minM: number; maxM: number; stepM: number }): number[] {
  return Array.from({ length: Math.round((r.maxM - r.minM) / r.stepM) + 1 }, (_, i) => Math.round((r.minM + i * r.stepM) * 1e9) / 1e9)
}

/** Valid designs on the configured ranges (any real values, not only grid points). */
export function arbFatigueDesign(ch: FatigueChallenge): fc.Arbitrary<FatigueDesign> {
  const L = ch.designLimits
  const between = (lo: number, hi: number) => fc.double({ min: lo, max: hi, noNaN: true, noDefaultInfinity: true })
  return fc
    .tuple(between(L.neckDiameterM.minM, L.neckDiameterM.maxM), between(L.collarDiameterM.minM, L.collarDiameterM.maxM), fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom(...ch.allowedFinishes))
    .filter(([d, D]) => (D - d) / 2 > L.filletRadiusM.minM + 1e-6)
    .map(([d, D, u, finish]) => {
      const hi = Math.min(L.filletRadiusM.maxM, (D - d) / 2 - 1e-6)
      return spindle('arb', d, D, L.filletRadiusM.minM + u * (hi - L.filletRadiusM.minM), finish)
    })
}
