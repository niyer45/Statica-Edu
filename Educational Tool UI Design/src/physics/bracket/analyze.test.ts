import { describe, expect, it } from 'vitest'
import { bracket, bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import type { BracketDesign } from '../../geometry/bracket/design'
import { PhysicsInvariantError } from '../analyze'
import { analyzeBracket, BRACKET_MODEL_ID, BRACKET_MODEL_VERSION, BracketInvariantError } from './analyze'
import {
  bendingMoment,
  nominalBendingStress,
  rectSecondMoment,
  steppedBarMass,
  steppedTipDeflection,
  uniformBarMass,
  uniformTipDeflection,
} from './bar'
import { BRACKET_ASSUMPTIONS, BRACKET_UNSUPPORTED_EFFECTS } from './constants'

// Bracket analysis entry point (task 46.2; MBR-07, MBR-11–MBR-15, MM-03, MM-10).

const ch = bracketChallenge()
const reference = worksheetFixture('reference')

describe('analyzeBracket', () => {
  it('names steppedBarBracket v1 and lists assumptions and unsupported effects', () => {
    const a = analyzeBracket(reference.design, ch)
    expect(BRACKET_MODEL_ID).toBe('steppedBarBracket')
    expect(BRACKET_MODEL_VERSION).toBe(1)
    expect(a.modelId).toBe('steppedBarBracket')
    expect(a.modelVersion).toBe(1)
    expect(a.status).toBe('solved')
    expect(a.assumptions).toEqual(BRACKET_ASSUMPTIONS)
    expect(a.unsupportedEffects).toEqual(BRACKET_UNSUPPORTED_EFFECTS)
    expect(a.applicable).toBe(true)
    expect(a.warnings).toEqual([])
    expect(a.notApplicableReasons).toEqual([])
  })

  it('returns exactly the documented keys for a stepped bar, with finite positive numbers', () => {
    const a = analyzeBracket(reference.design, ch)
    expect(Object.keys(a).sort()).toEqual(
      [
        'modelId', 'modelVersion', 'status', 'applicable', 'warnings', 'notApplicableReasons', 'unsupportedEffects', 'assumptions',
        'rootMomentNm', 'rootStressPa', 'tipDeflectionM', 'massKg', 'envelopeDepthM',
        'stepMomentNm', 'stepNominalStressPa', 'heightToRadiusRatio', 'stepRatio', 'ktBranch', 'ktStep', 'stepPeakStressPa', 'peakStressPa', 'peakLocation',
      ].sort(),
    )
    for (const [k, v] of Object.entries(a)) if (typeof v === 'number') expect(Number.isFinite(v) && v > 0, k).toBe(true)
    expect(a.rootMomentNm).toBe(90)
    expect(a.stepMomentNm).toBeCloseTo(37.5, 12)
    expect(a.envelopeDepthM).toBe(0.03)
    expect(a.ktBranch).toBe('lower')
  })

  it('omits every step key for a uniform bar (never NaN), with the peak at the root', () => {
    const a = analyzeBracket(bracket('u', 0.03, 0.03, 0.15, 0.001), ch)
    expect(Object.keys(a).sort()).toEqual(
      ['modelId', 'modelVersion', 'status', 'applicable', 'warnings', 'notApplicableReasons', 'unsupportedEffects', 'assumptions',
        'rootMomentNm', 'rootStressPa', 'tipDeflectionM', 'massKg', 'envelopeDepthM', 'peakStressPa', 'peakLocation'].sort(),
    )
    expect(a.peakStressPa).toBe(a.rootStressPa)
    expect(a.peakLocation).toBe('root')
    expect(a.status).toBe('solved')
  })

  it('omits Kt, the step peak, the peak and its location when the fit is undefined; keeps the rest', () => {
    const a = analyzeBracket(worksheetFixture('fitShallowNA').design, ch)
    expect(a.status).toBe('ktFitUndefined')
    expect(a.applicable).toBe(false)
    for (const k of ['ktBranch', 'ktStep', 'stepPeakStressPa', 'peakStressPa', 'peakLocation']) expect(k in a, k).toBe(false)
    for (const k of ['rootStressPa', 'stepNominalStressPa', 'tipDeflectionM', 'massKg', 'heightToRadiusRatio', 'stepRatio']) expect(k in a, k).toBe(true)
    // KT_FIT_SHARP side: h/r above 20 (D 50, d 10, r 0.5 mm: h/r = 40).
    const sharp = analyzeBracket(bracket('s', 0.05, 0.01, 0.15, 0.0005), ch)
    expect(sharp.status).toBe('ktFitUndefined')
    expect(sharp.notApplicableReasons.map((i) => i.code)).toContain('KT_FIT_SHARP')
    expect(sharp.notApplicableReasons.map((i) => i.code)).not.toContain('PLASTICITY')
  })

  it('applies Kt only at the step: root stress, deflection and mass ignore r', () => {
    const sharp = analyzeBracket(bracket('a', 0.03, 0.02, 0.15, 0.0005), ch)
    const soft = analyzeBracket(bracket('b', 0.03, 0.02, 0.15, 0.01), ch)
    expect(sharp.rootStressPa).toBe(soft.rootStressPa)
    expect(sharp.tipDeflectionM).toBe(soft.tipDeflectionM)
    expect(sharp.massKg).toBe(soft.massKg)
    expect(sharp.stepNominalStressPa).toBe(soft.stepNominalStressPa)
    expect(sharp.ktStep as number).toBeGreaterThan(soft.ktStep as number)
  })

  it('is deep-frozen, deterministic and does not mutate inputs', () => {
    const d = structuredClone(reference.design)
    const before = structuredClone(d)
    const a = analyzeBracket(d, ch)
    expect(Object.isFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.warnings)).toBe(true)
    expect(analyzeBracket(d, ch)).toEqual(a)
    expect(d).toEqual(before)
  })

  it('throws a typed invariant error for designs that violate the precondition', () => {
    // d > D: validation rejects it before analysis; here √(h/r) of a negative h gives NaN Kt.
    const bad: BracketDesign = bracket('bad', 0.02, 0.03, 0.15, 0.001)
    expect(() => analyzeBracket(bad, ch)).toThrow(BracketInvariantError)
    try {
      analyzeBracket(bad, ch)
    } catch (e) {
      expect(e).toBeInstanceOf(PhysicsInvariantError)
      expect(e).toMatchObject({ name: 'BracketInvariantError' })
    }
    expect(() => analyzeBracket(bracket('nan', Number.NaN, 0.02, 0.15, 0.001), ch)).toThrow(/rootStressPa = NaN/)
    expect(() => analyzeBracket(bracket('r', 0.03, 0.02, 0.15, Number.NaN), ch)).toThrow(/heightToRadiusRatio/)
    expect(() => analyzeBracket(bracket('beyond', 0.03, 0.02, 0.3, 0.001), ch)).toThrow(/stepMomentNm/)
  })

  it('reports later fields when earlier ones are fine', () => {
    const soft = { ...ch, material: { ...ch.material, elasticModulusPa: Number.POSITIVE_INFINITY } }
    expect(() => analyzeBracket(reference.design, soft)).toThrow(/tipDeflectionM/)
  })
})

describe('bar formulas', () => {
  it('compute I, M, σ, δ and m from their definitions', () => {
    expect(rectSecondMoment(2, 3)).toBe(54 / 12)
    expect(bendingMoment(2, 5, 1)).toBe(8)
    expect(nominalBendingStress(2, 3, 2)).toBe(1)
    expect(uniformTipDeflection(3, 1, 2, 4)).toBe(2)
    expect(steppedTipDeflection(3, 1, 2, 1, 4, 4)).toBe(uniformTipDeflection(3, 1, 2, 4))
    expect(steppedBarMass(2, 3, 4, 1, 1, 2)).toBe(2 * 3 * (4 + 1))
    expect(uniformBarMass(2, 3, 4, 5)).toBe(120)
  })
})
