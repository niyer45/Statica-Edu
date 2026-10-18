import { describe, expect, it } from 'vitest'
import { bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import type { BracketChallenge } from '../../challenge/bracket/types'
import { PhysicsInvariantError } from '../analyze'
import { analyzeBracket, BRACKET_MODEL_ID, BRACKET_MODEL_VERSION, BracketInvariantError } from './analyze'
import { BRACKET_ASSUMPTIONS, BRACKET_UNSUPPORTED_EFFECTS } from './constants'
import {
  armBendingDeflection,
  bendMoment,
  bendRadiusRatio,
  boltLeverArm,
  boltTension,
  curvedBeamInnerStress,
  curvedBeamNeutralRadius,
  flangeRotationDeflection,
  lBracketMass,
  nominalBendingStress,
  plateSecondMoment,
} from './formulas'

// Bracket analysis entry point (task 55, `boltedLBracket` v1; MM-03, MM-10).

const ch = bracketChallenge()
const reference = worksheetFixture('reference')

describe('analyzeBracket', () => {
  it('names boltedLBracket v1 and lists assumptions and unsupported effects', () => {
    const a = analyzeBracket(reference.design, ch)
    expect(BRACKET_MODEL_ID).toBe('boltedLBracket')
    expect(BRACKET_MODEL_VERSION).toBe(1)
    expect(a.modelId).toBe('boltedLBracket')
    expect(a.modelVersion).toBe(1)
    expect(a.assumptions).toEqual(BRACKET_ASSUMPTIONS)
    expect(a.unsupportedEffects).toEqual(BRACKET_UNSUPPORTED_EFFECTS)
    expect(a.applicable).toBe(true)
    expect(a.warnings).toEqual([])
    expect(a.notApplicableReasons).toEqual([])
  })

  it('returns exactly the documented keys, with finite positive numbers', () => {
    const a = analyzeBracket(reference.design, ch)
    expect(Object.keys(a).sort()).toEqual(
      [
        'modelId', 'modelVersion', 'applicable', 'warnings', 'notApplicableReasons', 'unsupportedEffects', 'assumptions',
        'bendMomentNm', 'nominalBendStressPa', 'curvedBeamFactor', 'bendStressPa', 'bendRadiusRatio',
        'armDeflectionM', 'flangeRotationDeflectionM', 'deflectionM', 'boltLeverArmM', 'boltTensionN', 'massKg',
      ].sort(),
    )
    for (const [k, v] of Object.entries(a)) if (typeof v === 'number') expect(Number.isFinite(v) && v > 0, k).toBe(true)
    expect(a.bendMomentNm).toBe(24)
    expect(a.deflectionM).toBe(a.armDeflectionM + a.flangeRotationDeflectionM)
    expect(a.curvedBeamFactor).toBe(a.bendStressPa / a.nominalBendStressPa)
  })

  it('is deep-frozen and does not mutate its inputs', () => {
    const d = structuredClone(reference.design)
    const a = analyzeBracket(d, ch)
    expect(Object.isFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.warnings)).toBe(true)
    expect(d).toEqual(reference.design)
  })

  it('a taller flange lowers the bolt tension and raises the deflection and mass; nothing else at the bend changes', () => {
    const lo = analyzeBracket(reference.design, ch)
    const hi = analyzeBracket({ ...reference.design, flangeHeightM: 0.12 }, ch)
    expect(hi.boltTensionN).toBeLessThan(lo.boltTensionN)
    expect(hi.deflectionM).toBeGreaterThan(lo.deflectionM)
    expect(hi.massKg).toBeGreaterThan(lo.massKg)
    expect(hi.bendStressPa).toBe(lo.bendStressPa)
    expect(hi.armDeflectionM).toBe(lo.armDeflectionM)
  })

  it('a larger inner radius lowers the bend stress but shortens the bolt lever arm', () => {
    const sharp = analyzeBracket({ ...reference.design, innerRadiusM: 0.002 }, ch)
    const soft = analyzeBracket({ ...reference.design, innerRadiusM: 0.01 }, ch)
    expect(soft.curvedBeamFactor).toBeLessThan(sharp.curvedBeamFactor)
    expect(soft.bendStressPa).toBeLessThan(sharp.bendStressPa)
    expect(soft.boltTensionN).toBeGreaterThan(sharp.boltTensionN)
    expect(soft.nominalBendStressPa).toBe(sharp.nominalBendStressPa)
  })

  it('throws a typed invariant error naming the first non-finite field', () => {
    const broken: BracketChallenge = { ...ch, load: { ...ch.load, forceN: Number.POSITIVE_INFINITY } }
    expect(() => analyzeBracket(reference.design, broken)).toThrow(BracketInvariantError)
    expect(() => analyzeBracket(reference.design, broken)).toThrow(/bendMomentNm/)
    try {
      analyzeBracket(reference.design, broken)
    } catch (e) {
      expect(e).toBeInstanceOf(PhysicsInvariantError)
    }
    // A config whose bolt row sits in the bend (bypassing the loader) gives a non-positive lever arm.
    const lowBolts: BracketChallenge = { ...ch, bolts: { count: 2, edgeDistanceM: 0.07 } }
    expect(() => analyzeBracket(reference.design, lowBolts)).toThrow(/boltLeverArmM/)
  })
})

describe('L-bracket formulas', () => {
  it('statics, section and deflection building blocks', () => {
    expect(bendMoment(200, 0.12)).toBe(24)
    expect(nominalBendingStress(24, 0.04, 0.007)).toBeCloseTo((6 * 24) / (0.04 * 0.007 ** 2), 3)
    expect(plateSecondMoment(0.04, 0.007)).toBeCloseTo((0.04 * 0.007 ** 3) / 12, 20)
    expect(armBendingDeflection(1, 2, 3, 4)).toBeCloseTo(8 / 36, 15)
    expect(flangeRotationDeflection(1, 2, 5, 3, 4)).toBeCloseTo(20 / 36, 15)
    expect(boltLeverArm(0.08, 0.015, 0.006, 0.007)).toBeCloseTo(0.052, 15)
    expect(boltTension(200, 0.12, 2, 0.052)).toBeCloseTo(24 / 0.104, 10)
  })

  it('curved-beam neutral radius lies between the inner fibre and the centroid', () => {
    const rn = curvedBeamNeutralRadius(0.006, 0.007)
    expect(rn).toBeGreaterThan(0.006)
    expect(rn).toBeLessThan(0.006 + 0.0035)
    expect(bendRadiusRatio(0.001, 0.01)).toBeCloseTo(1.2, 14)
    expect(curvedBeamInnerStress(24, 0.04, 0.007, 0.006)).toBeGreaterThan(nominalBendingStress(24, 0.04, 0.007))
  })

  it('L-bracket mass: straight legs plus a quarter-annulus bend', () => {
    const ro = 0.013
    const area = 0.007 * (0.135 - ro) + 0.007 * (0.08 - ro) + (Math.PI / 4) * (ro ** 2 - 0.006 ** 2)
    expect(lBracketMass(2700, 0.04, 0.007, 0.006, 0.135, 0.08)).toBeCloseTo(2700 * 0.04 * area, 12)
  })
})
