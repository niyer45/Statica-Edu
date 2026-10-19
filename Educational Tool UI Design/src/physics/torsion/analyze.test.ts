import { describe, expect, it } from 'vitest'
import { shaft, solid, torsionChallenge, tube, worksheetFixture } from '../../../test/fixtures/torsion'
import type { TorsionDesign } from '../../geometry/torsion/design'
import { PhysicsInvariantError } from '../analyze'
import { analyzeShaft, TORSION_MODEL_ID, TORSION_MODEL_VERSION, TorsionInvariantError } from './analyze'
import { TORSION_ASSUMPTIONS, TORSION_UNSUPPORTED_EFFECTS } from './constants'
import { maxShearStress, shaftDiameters, shaftSectionProperties, shearStressAtRadius, torsionalStiffness, twistAngle } from './shaft'

// Torsion analysis entry point (task 47.2; TSH-06, TSH-10–TSH-13, MM-03, MM-10).

const ch = torsionChallenge()
const reference = worksheetFixture('reference')

describe('analyzeShaft', () => {
  it('names circularShaftTorsion v1 and lists assumptions and unsupported effects', () => {
    const a = analyzeShaft(reference.design, ch)
    expect(TORSION_MODEL_ID).toBe('circularShaftTorsion')
    expect(TORSION_MODEL_VERSION).toBe(1)
    expect(a.modelId).toBe('circularShaftTorsion')
    expect(a.modelVersion).toBe(1)
    expect(a.assumptions).toEqual(TORSION_ASSUMPTIONS)
    expect(a.unsupportedEffects).toEqual(TORSION_UNSUPPORTED_EFFECTS)
    expect(a.applicable).toBe(true)
    expect(a.warnings).toEqual([])
    expect(a.notApplicableReasons).toEqual([])
  })

  it('returns exactly the documented keys with finite positive numbers', () => {
    const a = analyzeShaft(reference.design, ch)
    expect(Object.keys(a).sort()).toEqual(
      [
        'modelId',
        'modelVersion',
        'applicable',
        'warnings',
        'notApplicableReasons',
        'unsupportedEffects',
        'assumptions',
        'areaM2',
        'polarMomentM4',
        'outerDiameterM',
        'massKg',
        'twistRad',
        'maxShearStressPa',
        'torsionalStiffnessNmPerRad',
      ].sort(),
    )
    for (const k of ['areaM2', 'polarMomentM4', 'outerDiameterM', 'massKg', 'twistRad', 'maxShearStressPa', 'torsionalStiffnessNmPerRad'] as const) {
      expect(Number.isFinite(a[k]) && a[k] > 0, k).toBe(true)
    }
    expect(a.outerDiameterM).toBe(0.05)
  })

  it('is deep-frozen, deterministic and does not mutate inputs', () => {
    const d = structuredClone(reference.design)
    const before = structuredClone(d)
    const a = analyzeShaft(d, ch)
    expect(Object.isFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.warnings)).toBe(true)
    expect(analyzeShaft(d, ch)).toEqual(a)
    expect(d).toEqual(before)
  })

  it('reads length from the design and torque, G and ρ from the challenge', () => {
    const a = analyzeShaft(reference.design, ch)
    const longer = analyzeShaft({ ...reference.design, lengthM: 1.6 }, ch)
    expect(longer.twistRad).toBeCloseTo(2 * a.twistRad, 15)
    expect(longer.massKg).toBeCloseTo(2 * a.massKg, 12)
  })

  it('throws a typed invariant error for designs that violate the precondition', () => {
    // d > D gives a negative area and polar moment; validation rejects it before analysis.
    const bad: TorsionDesign = shaft('bad', tube(0.03, 0.04))
    expect(() => analyzeShaft(bad, ch)).toThrow(TorsionInvariantError)
    try {
      analyzeShaft(bad, ch)
    } catch (e) {
      expect(e).toBeInstanceOf(PhysicsInvariantError)
      expect(e).toMatchObject({ name: 'TorsionInvariantError', field: 'areaM2' })
      expect((e as Error).message).toContain('areaM2')
    }
    expect(() => analyzeShaft(shaft('nan', solid(Number.NaN)), ch)).toThrow(/areaM2 = NaN/)
    // A zero bore-equal tube has A = J = 0.
    expect(() => analyzeShaft(shaft('zero', tube(0.03, 0.03)), ch)).toThrow(TorsionInvariantError)
  })

  it('reports later fields when earlier ones are fine', () => {
    const noTorque = { ...ch, torqueNm: 0 }
    expect(() => analyzeShaft(reference.design, noTorque)).toThrow(/twistRad/)
  })
})

describe('shaft formulas', () => {
  it('treat a solid circle as the d = 0 tube', () => {
    expect(shaftDiameters(solid(0.03))).toEqual({ D: 0.03, d: 0 })
    expect(shaftDiameters(tube(0.05, 0.044))).toEqual({ D: 0.05, d: 0.044 })
    expect(shaftSectionProperties(solid(0.03))).toEqual(shaftSectionProperties(tube(0.03, 0)))
  })

  it('compute φ, τ and k_t from their definitions', () => {
    expect(twistAngle(2, 3, 4, 5)).toBe(6 / 20)
    expect(maxShearStress(2, 3, 5)).toBe(3 / 5)
    expect(torsionalStiffness(4, 5, 2)).toBe(10)
  })

  it('give a shear stress linear in radius: zero on the axis, the maximum at the surface (task 71)', () => {
    const J = shaftSectionProperties(solid(0.03)).polarMomentM4
    expect(shearStressAtRadius(400, 0, J)).toBe(0)
    expect(shearStressAtRadius(400, 0.015, J)).toBe(maxShearStress(400, 0.03, J))
    expect(shearStressAtRadius(400, 0.0075, J)).toBeCloseTo(maxShearStress(400, 0.03, J) / 2, 6)
  })
})
