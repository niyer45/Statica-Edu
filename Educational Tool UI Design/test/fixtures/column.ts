import fc from 'fast-check'
import columnJson from '../../src/challenge/challenges/column-buckling-1.json'
import { loadColumnChallenge } from '../../src/challenge/column/loader'
import type { ColumnChallenge } from '../../src/challenge/column/types'
import type { ColumnConstraintId } from '../../src/evaluation/column/types'
import type { ColumnDesign, ColumnSection } from '../../src/geometry/column/design'
import type { ColumnApplicabilityCode } from '../../src/physics/column/constants'

// Column Buckling I worksheet fixtures (task 68, model `eulerColumnBuckling` v1; CBK-17). Every
// expected number is copied (full double precision) from the standalone script
// .kiro/specs/column-buckling-1/worksheet.py, written from the equations in design.md without
// application code; it is not calculated through the implementation under test. Challenge
// constants: E 69 GPa, ρ 2700 kg/m³, σ_y 240 MPa, L = KL = 2 m, P = 10 kN, n_req 2, m_max 2.5 kg.
// SI units, unrounded. Assert at COLUMN_WORKSHEET_REL_TOL.

export const COLUMN_WORKSHEET_REL_TOL = 1e-9

/** λ_c = √(2π²E/σ_y) for the bundled material. */
export const COLUMN_TRANSITION_SLENDERNESS = 75.33274540746793

/** Required second moment n_req P (KL)² / (π² E), m⁴. */
export const COLUMN_REQUIRED_I_M4 = 1.174738361070583e-7

export interface ColumnFixture {
  name: string
  design: ColumnDesign
  expected: {
    areaM2: number
    secondMomentM4: number
    radiusOfGyrationM: number
    slenderness: number
    criticalLoadN: number
    bucklingSafetyFactor: number
    eulerStressPa: number
    /** σ_E / σ_y. */
    eulerRatio: number
    axialStressPa: number
    massKg: number
    criticalLoadPerMassNPerKg: number
    diameterToWall: number
    status: 'accepted' | 'notAccepted' | 'modelNotApplicable'
    failures: readonly ColumnConstraintId[]
    warningCodes: readonly ColumnApplicabilityCode[]
    notApplicableCodes: readonly ColumnApplicabilityCode[]
  }
}

/** The bundled Column Buckling I config, loaded and frozen. Throws if it fails. */
export function columnChallenge(): ColumnChallenge {
  const loaded = loadColumnChallenge(columnJson)
  if (!loaded.ok) throw new Error(`column-buckling-1 failed to load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}

const MATERIAL_ID: string = columnJson.material.id
const LENGTH_M: number = columnJson.lengthM

export const solid = (diameterM: number): ColumnSection => ({ kind: 'solid', diameterM })
export const tube = (outerDiameterM: number, wallThicknessM: number): ColumnSection => ({ kind: 'tube', outerDiameterM, wallThicknessM })

/** A column design with the locked length and material of the bundled challenge. */
export function column(id: string, section: ColumnSection): ColumnDesign {
  return { id, section, lengthM: LENGTH_M, materialId: MATERIAL_ID }
}

const row = (name: string, section: ColumnSection, expected: ColumnFixture['expected']): ColumnFixture => ({ name, design: column(name, section), expected })

export const COLUMN_WORKSHEET: readonly ColumnFixture[] = [
  row('baseline', solid(0.0245), {
    areaM2: 0.0004714352475793184,
    secondMomentM4: 1.7686187959967867e-8,
    radiusOfGyrationM: 0.006125,
    slenderness: 326.53061224489795,
    criticalLoadN: 3011.08545461132,
    bucklingSafetyFactor: 0.301108545461132,
    eulerStressPa: 6387060.51376591,
    eulerRatio: 0.026612752140691292,
    axialStressPa: 21211820.820244275,
    massKg: 2.5457503369283194,
    criticalLoadPerMassNPerKg: 1182.788984030724,
    diameterToWall: 2,
    status: 'notAccepted',
    failures: ['buckling', 'mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('reference', tube(0.06, 0.002), {
    areaM2: 0.00036442474781641634,
    secondMomentM4: 1.5342281883071122e-7,
    radiusOfGyrationM: 0.020518284528683185,
    slenderness: 97.4740357657159,
    criticalLoadN: 26120.338607294863,
    bucklingSafetyFactor: 2.612033860729486,
    eulerStressPa: 71675534.56181115,
    eulerRatio: 0.2986480606742131,
    axialStressPa: 27440507.4296371,
    massKg: 1.9678936382086483,
    criticalLoadPerMassNPerKg: 13273.247141076139,
    diameterToWall: 30,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('solid30', solid(0.03), {
    areaM2: 0.0007068583470577034,
    secondMomentM4: 3.9760782021995816e-8,
    radiusOfGyrationM: 0.0075,
    slenderness: 266.6666666666667,
    criticalLoadN: 6769.300014304517,
    bucklingSafetyFactor: 0.6769300014304518,
    eulerStressPa: 9576600.520432016,
    eulerRatio: 0.03990250216846673,
    axialStressPa: 14147106.05261292,
    massKg: 3.8170350741115984,
    criticalLoadPerMassNPerKg: 1773.444540820744,
    diameterToWall: 2,
    status: 'notAccepted',
    failures: ['buckling', 'mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('tubeEqualMass', tube(0.0545, 0.0045), {
    areaM2: 0.0007068583470577033,
    secondMomentM4: 2.2268246864652213e-7,
    radiusOfGyrationM: 0.017749119696480724,
    slenderness: 112.68164473512215,
    criticalLoadN: 37911.84080233547,
    bucklingSafetyFactor: 3.7911840802335472,
    eulerStressPa: 53634283.24804177,
    eulerRatio: 0.22347618020017404,
    axialStressPa: 14147106.052612921,
    massKg: 3.817035074111598,
    criticalLoadPerMassNPerKg: 9932.27467556329,
    diameterToWall: 12.111111111111112,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('solid40', solid(0.04), {
    areaM2: 0.0012566370614359172,
    secondMomentM4: 1.2566370614359172e-7,
    radiusOfGyrationM: 0.01,
    slenderness: 200,
    criticalLoadN: 21394.33090940687,
    bucklingSafetyFactor: 2.1394330909406873,
    eulerStressPa: 17025067.59187914,
    eulerRatio: 0.07093778163282975,
    axialStressPa: 7957747.154594767,
    massKg: 6.785840131753953,
    criticalLoadPerMassNPerKg: 3152.7902947924335,
    diameterToWall: 2,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('thinSmallTube', tube(0.015, 0.001), {
    areaM2: 4.398229715025711e-5,
    secondMomentM4: 1.083064067325081e-9,
    radiusOfGyrationM: 0.004962358310319801,
    slenderness: 403.03417748790275,
    criticalLoadN: 184.39238952545045,
    bucklingSafetyFactor: 0.018439238952545046,
    eulerStressPa: 4192422.8945002374,
    eulerRatio: 0.01746842872708432,
    axialStressPa: 227364204.4169933,
    massKg: 0.23750440461138841,
    criticalLoadPerMassNPerKg: 776.3746100926364,
    diameterToWall: 15,
    status: 'notAccepted',
    failures: ['buckling', 'axialStress'],
    warningCodes: [],
    notApplicableCodes: [],
  }),
  row('eulerWarning', tube(0.07, 0.002), {
    areaM2: 0.000427256600888212,
    secondMomentM4: 2.4716794361383076e-7,
    radiusOfGyrationM: 0.02405202694161139,
    slenderness: 83.15307499260634,
    criticalLoadN: 42080.509465712414,
    bucklingSafetyFactor: 4.208050946571241,
    eulerStressPa: 98490016.01902089,
    eulerRatio: 0.41037506674592034,
    axialStressPa: 23405138.6899846,
    massKg: 2.307185644796345,
    criticalLoadPerMassNPerKg: 18238.891855374237,
    diameterToWall: 35,
    status: 'accepted',
    failures: [],
    warningCodes: ['EULER_RANGE'],
    notApplicableCodes: [],
  }),
  row('eulerNotApplicable', tube(0.08, 0.002), {
    areaM2: 0.0004900884539600081,
    secondMomentM4: 3.72957313463566e-7,
    radiusOfGyrationM: 0.027586228448267438,
    slenderness: 72.49994335944139,
    criticalLoadN: 63496.23470602868,
    bucklingSafetyFactor: 6.349623470602868,
    eulerStressPa: 129560764.37420021,
    eulerRatio: 0.5398365182258342,
    axialStressPa: 20404479.88357631,
    massKg: 2.6464776513840436,
    criticalLoadPerMassNPerKg: 23992.73414337041,
    diameterToWall: 40,
    status: 'modelNotApplicable',
    failures: ['mass', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['EULER_RANGE'],
  }),
  row('wallWarning', tube(0.06, 0.001), {
    areaM2: 0.0001853539665617982,
    secondMomentM4: 8.067531394602256e-8,
    radiusOfGyrationM: 0.02086264604502505,
    slenderness: 95.86511680654833,
    criticalLoadN: 13735.02672927104,
    bucklingSafetyFactor: 1.373502672927104,
    eulerStressPa: 74101606.69365385,
    eulerRatio: 0.30875669455689103,
    axialStressPa: 53950828.16674406,
    massKg: 1.0009114194337103,
    criticalLoadPerMassNPerKg: 13722.519758084049,
    diameterToWall: 60,
    status: 'notAccepted',
    failures: ['buckling'],
    warningCodes: ['WALL_SLENDERNESS'],
    notApplicableCodes: [],
  }),
]

/** A worksheet row by name; throws for an unknown name. */
export function worksheetRow(name: string): ColumnFixture {
  const r = COLUMN_WORKSHEET.find((f) => f.name === name)
  if (!r) throw new Error(`No column worksheet row "${name}"`)
  return r
}

const between = (min: number, max: number) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true })

/** Any valid in-range column design of the challenge (solid or tube). */
export function arbColumnDesign(ch: ColumnChallenge): fc.Arbitrary<ColumnDesign> {
  const L = ch.sectionLimits
  return fc.oneof(
    between(L.solid.diameterM.minM, L.solid.diameterM.maxM).map((d) => column('d', solid(d))),
    fc
      .tuple(between(L.tube.outerDiameterM.minM, L.tube.outerDiameterM.maxM), between(L.tube.wallThicknessM.minM, L.tube.wallThicknessM.maxM))
      .map(([D, t]) => column('d', tube(D, t))),
  )
}

/** Every configured-grid value of a range (index-based, so 0.5 mm steps stay exact multiples). */
export function gridValues(r: { minM: number; maxM: number; stepM: number }): number[] {
  const n = Math.round((r.maxM - r.minM) / r.stepM)
  return Array.from({ length: n + 1 }, (_, i) => Number((r.minM + i * r.stepM).toFixed(6)))
}

/** Every grid design of the challenge: all solid diameters, then every tube outer diameter × wall. */
export function* columnGrid(ch: ColumnChallenge): Generator<ColumnDesign> {
  const L = ch.sectionLimits
  for (const d of gridValues(L.solid.diameterM)) yield column('g', solid(d))
  for (const D of gridValues(L.tube.outerDiameterM)) for (const t of gridValues(L.tube.wallThicknessM)) yield column('g', tube(D, t))
}
