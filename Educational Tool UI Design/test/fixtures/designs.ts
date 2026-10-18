import bundledChallenge from '../../src/challenge/challenges/cantilever-beam-1.json'
import type { ConstraintId } from '../../src/evaluation/types'
import type { BeamDesign, Section } from '../../src/geometry/sections'
import type { ApplicabilityCode } from '../../src/physics/constants'

// Verified fixtures (design "Verified fixtures" table; Req 8.10).
// All values are SI. The design table lists δ in mm and σ in MPa; they are converted here.
// Expected values are computed with M = F·L = 180 N·m and F L³ = 64.8 N·m³, and agree with
// the design table within FIXTURE_REL_TOL.

export type { ConstraintId }

export type FixtureStatus = 'accepted' | 'notAccepted' | 'modelNotApplicable'

export interface FixtureExpected {
  areaM2: number
  massKg: number
  bendingInertiaM4: number
  tipDeflectionM: number
  nominalMaxStressPa: number
  status: FixtureStatus
  /** Failed constraints, in the fixed constraint order. */
  failures: readonly ConstraintId[]
  warningCodes: readonly ApplicabilityCode[]
  notApplicableCodes: readonly ApplicabilityCode[]
}

export interface Fixture {
  name: string
  design: BeamDesign
  expected: FixtureExpected
}

/** Relative tolerance used when asserting fixture values. */
export const FIXTURE_REL_TOL = 1e-3

// Locked fields come from the bundled challenge so fixtures always pass the locked-field check.
const LENGTH_M: number = bundledChallenge.initialDesign.lengthM
const MATERIAL_ID: string = bundledChallenge.initialDesign.materialId

function design(id: string, section: Section, orientationDeg: 0 | 90 = 0): BeamDesign {
  return { id, section, orientationDeg, lengthM: LENGTH_M, materialId: MATERIAL_ID }
}

/**
 * Challenge v3 baseline (D-47 amendment): a solid Ø31 mm circle. It fails deflection and mass, the
 * most checks any circle fails with no applicability warning (circles failing more carry a
 * LARGE_DEFLECTION or DEPTH_SPAN warning). Values from an independent hand calculation:
 * A = πd²/4, I = πd⁴/64, δ = F L³/(3 E I), σ = F L (d/2)/I.
 */
export const baseline: Fixture = {
  name: 'baseline',
  design: design('baseline', { kind: 'circle', diameterM: 0.031 }),
  expected: {
    areaM2: 7.5477e-4,
    massKg: 1.2227,
    bendingInertiaM4: 4.5333e-8,
    tipDeflectionM: 6.9054e-3,
    nominalMaxStressPa: 61.544e6,
    status: 'notAccepted',
    failures: ['deflection', 'mass'],
    warningCodes: [],
    notApplicableCodes: [],
  },
}

/**
 * Challenge v2 baseline (task 59): an I-section turned on its side (bending about its weak axis),
 * 84 mm wide. It fails deflection, stress, mass and envelope width, the most checks any applicable
 * in-range section fails, with no applicability warning (δ/L = 0.0197 < 0.02). Values from an
 * independent hand calculation: A = 2·b·tf + (h − 2tf)·tw, I = 2·tf·b³/12 + (h − 2tf)·tw³/12.
 */
export const sidewaysI: Fixture = {
  name: 'sidewaysI',
  design: design('sidewaysI', { kind: 'iSection', widthM: 0.0365, heightM: 0.084, flangeThicknessM: 0.003, webThicknessM: 0.007 }, 90),
  expected: {
    areaM2: 7.65e-4,
    massKg: 1.2393,
    bendingInertiaM4: 2.6543e-8,
    tipDeflectionM: 11.794e-3,
    nominalMaxStressPa: 123.76e6,
    status: 'notAccepted',
    failures: ['deflection', 'stress', 'mass', 'envelopeWidth'],
    warningCodes: [],
    notApplicableCodes: [],
  },
}

/** Design-table row "baseline": the solid Ø30 circle that was the challenge v1 baseline. */
export const solid30: Fixture = {
  name: 'solid30',
  design: design('solid30', { kind: 'circle', diameterM: 0.03 }),
  expected: {
    areaM2: 7.0686e-4,
    massKg: 1.1451,
    bendingInertiaM4: 3.9761e-8,
    tipDeflectionM: 7.8732e-3,
    nominalMaxStressPa: 67.906e6,
    status: 'notAccepted',
    failures: ['deflection'],
    warningCodes: [],
    notApplicableCodes: [],
  },
}

export const reference: Fixture = {
  name: 'reference',
  design: design('reference', {
    kind: 'iSection',
    widthM: 0.04,
    heightM: 0.06,
    flangeThicknessM: 0.004,
    webThicknessM: 0.003,
  }),
  expected: {
    areaM2: 4.76e-4,
    massKg: 0.77112,
    bendingInertiaM4: 2.8646e-7,
    tipDeflectionM: 1.0928e-3,
    nominalMaxStressPa: 18.851e6,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  },
}

export const tubeSameMass: Fixture = {
  name: 'tubeSameMass',
  design: design('tubeSameMass', { kind: 'tube', outerDiameterM: 0.05, innerDiameterM: 0.04 }),
  expected: {
    areaM2: 7.0686e-4,
    massKg: 1.1451,
    bendingInertiaM4: 1.8113e-7,
    tipDeflectionM: 1.7283e-3,
    nominalMaxStressPa: 24.844e6,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  },
}

export const rectTall: Fixture = {
  name: 'rectTall',
  design: design('rectTall', { kind: 'rectangle', widthM: 0.015, heightM: 0.045 }, 0),
  expected: {
    areaM2: 6.75e-4,
    massKg: 1.0935,
    bendingInertiaM4: 1.1391e-7,
    tipDeflectionM: 2.7483e-3,
    nominalMaxStressPa: 35.556e6,
    status: 'accepted',
    failures: [],
    warningCodes: [],
    notApplicableCodes: [],
  },
}

export const rectFlat: Fixture = {
  name: 'rectFlat',
  design: design('rectFlat', { kind: 'rectangle', widthM: 0.015, heightM: 0.045 }, 90),
  expected: {
    areaM2: 6.75e-4,
    massKg: 1.0935,
    bendingInertiaM4: 1.2656e-8,
    tipDeflectionM: 24.734e-3,
    nominalMaxStressPa: 106.67e6,
    status: 'notAccepted',
    failures: ['deflection'],
    // δ/L = 0.041 > 0.02
    warningCodes: ['LARGE_DEFLECTION'],
    notApplicableCodes: [],
  },
}

export const heavySquare: Fixture = {
  name: 'heavySquare',
  design: design('heavySquare', { kind: 'rectangle', widthM: 0.04, heightM: 0.04 }),
  expected: {
    areaM2: 1.6e-3,
    massKg: 2.592,
    bendingInertiaM4: 2.1333e-7,
    tipDeflectionM: 1.4674e-3,
    nominalMaxStressPa: 16.875e6,
    status: 'notAccepted',
    failures: ['mass'],
    warningCodes: [],
    notApplicableCodes: [],
  },
}

export const wideI: Fixture = {
  name: 'wideI',
  design: design('wideI', {
    kind: 'iSection',
    widthM: 0.09,
    heightM: 0.06,
    flangeThicknessM: 0.004,
    webThicknessM: 0.003,
  }),
  expected: {
    areaM2: 8.76e-4,
    massKg: 1.4191,
    bendingInertiaM4: 6.0059e-7,
    tipDeflectionM: 0.52122e-3,
    nominalMaxStressPa: 8.9911e6,
    status: 'notAccepted',
    failures: ['mass', 'envelopeWidth'],
    // (b − tw)/(2 tf) = 10.875 > 10
    warningCodes: ['FLANGE_OUTSTAND'],
    notApplicableCodes: [],
  },
}

export const tinyCircle: Fixture = {
  name: 'tinyCircle',
  design: design('tinyCircle', { kind: 'circle', diameterM: 0.005 }),
  expected: {
    areaM2: 1.9635e-5,
    massKg: 0.031809,
    bendingInertiaM4: 3.068e-11,
    tipDeflectionM: 10.204,
    nominalMaxStressPa: 14668e6,
    status: 'modelNotApplicable',
    // Derived (the design table lists only the status): δ 10.2 m ≫ 4 mm and σ 14.7 GPa ≫ 120 MPa
    // fail; mass 0.032 kg and the 5 mm envelope pass; applicability fails (not applicable).
    failures: ['deflection', 'stress', 'applicability'],
    warningCodes: [],
    notApplicableCodes: ['LARGE_DEFLECTION', 'PLASTICITY'],
  },
}

export const FIXTURES: readonly Fixture[] = [
  baseline,
  sidewaysI,
  solid30,
  reference,
  tubeSameMass,
  rectTall,
  rectFlat,
  heavySquare,
  wideI,
  tinyCircle,
]
