import { describe, expect, it } from 'vitest'
import { bracket, bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import { GEOM_TOL } from '../sections'
import { isUniformBar, type BracketDesign } from './design'
import { BRACKET_ERROR_CODES, validateBracketDesign, validateBracketDimensions } from './validate'

// Bracket geometry validation (task 46.2; MBR-05, MBR-17 invalid input, MM-09).

const ch = bracketChallenge()
const base = worksheetFixture('baseline').design
const codes = (d: BracketDesign) => validateBracketDesign(d, ch).map((e) => `${e.param} ${e.code}`)

describe('validateBracketDesign', () => {
  it('accepts the baseline, the reference and a uniform bar', () => {
    expect(validateBracketDesign(base, ch)).toEqual([])
    expect(validateBracketDesign(ch.referenceDesign as BracketDesign, ch)).toEqual([])
    expect(validateBracketDesign(bracket('u', 0.03, 0.03, 0.15, 0.001), ch)).toEqual([])
    expect(isUniformBar(bracket('u', 0.03, 0.03, 0.15, 0.001))).toBe(true)
    expect(isUniformBar(base)).toBe(false)
  })

  it('accepts every range edge, inclusive within GEOM_TOL', () => {
    const L = ch.designLimits
    expect(validateBracketDesign(bracket('lo', L.rootDepthM.minM, L.armDepthM.minM, L.stepLocationM.minM, L.filletRadiusM.minM), ch)).toEqual([])
    expect(validateBracketDesign(bracket('hi', L.rootDepthM.maxM, L.armDepthM.maxM, L.stepLocationM.maxM, L.filletRadiusM.maxM), ch)).toEqual([])
    expect(validateBracketDesign({ ...base, rootDepthM: L.rootDepthM.maxM + 0.5 * GEOM_TOL }, ch)).toEqual([])
    expect(codes({ ...base, rootDepthM: L.rootDepthM.maxM + 2 * GEOM_TOL })).toEqual(['rootDepthM ABOVE_MAX'])
  })

  it('rejects out-of-range values per parameter, in parameter order', () => {
    expect(codes({ ...base, rootDepthM: 0.051, armDepthM: 0.005, stepLocationM: 0.25, filletRadiusM: 0.0004 })).toEqual([
      'rootDepthM ABOVE_MAX',
      'armDepthM BELOW_MIN',
      'stepLocationM ABOVE_MAX',
      'filletRadiusM BELOW_MIN',
    ])
    expect(codes({ ...base, stepLocationM: 0.05 })).toEqual(['stepLocationM BELOW_MIN'])
    expect(codes({ ...base, filletRadiusM: 0.011 })).toEqual(['filletRadiusM ABOVE_MAX'])
  })

  it('rejects an arm deeper than the root (d > D), exactly; d = D is a uniform bar', () => {
    expect(codes({ ...base, armDepthM: 0.0300001 })).toEqual(['armDepthM ARM_DEEPER_THAN_ROOT'])
    expect(codes({ ...base, armDepthM: 0.03 })).toEqual([])
    const [e] = validateBracketDesign({ ...base, rootDepthM: 0.02, armDepthM: 0.03 }, ch)
    expect(e.message).toBe('Arm depth must not exceed the root depth (arm 30 mm, root 20 mm). Equal depths make a uniform bar.')
  })

  it('still applies d ≤ D when a depth is out of range but finite', () => {
    expect(codes({ ...base, rootDepthM: 0.012, armDepthM: 0.0125 })).toEqual(['rootDepthM BELOW_MIN', 'armDepthM ARM_DEEPER_THAN_ROOT'])
  })

  it('reports non-finite and non-positive values once each and skips the coupled rule', () => {
    expect(codes({ ...base, rootDepthM: Number.NaN, armDepthM: 0.04 })).toEqual(['rootDepthM NON_FINITE'])
    expect(codes({ ...base, armDepthM: Number.POSITIVE_INFINITY })).toEqual(['armDepthM NON_FINITE'])
    expect(codes({ ...base, stepLocationM: 0 })).toEqual(['stepLocationM NON_POSITIVE'])
    expect(codes({ ...base, filletRadiusM: -0.001 })).toEqual(['filletRadiusM NON_POSITIVE'])
  })

  it('is total over untrusted input', () => {
    const missing = { id: 'x', materialId: 'al-educational' } as unknown as BracketDesign
    expect(codes(missing)).toEqual(['rootDepthM NON_FINITE', 'armDepthM NON_FINITE', 'stepLocationM NON_FINITE', 'filletRadiusM NON_FINITE'])
    expect(validateBracketDesign({ ...base, rootDepthM: '30' as unknown as number }, ch)[0].message).toBe('Root depth must be a finite number (got "30").')
    expect(validateBracketDesign(null as unknown as BracketDesign, ch).map((e) => e.code)).toEqual([
      'NON_FINITE',
      'NON_FINITE',
      'NON_FINITE',
      'NON_FINITE',
      'LOCKED_FIELD_CHANGED',
    ])
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(validateBracketDesign({ ...base, filletRadiusM: cyclic as unknown as number }, ch)[0].message).toContain('(got object)')
  })

  it('rejects a changed locked material', () => {
    expect(codes({ ...base, materialId: 'steel' })).toEqual(['materialId LOCKED_FIELD_CHANGED'])
    expect(validateBracketDesign({ ...base, materialId: 'steel' }, ch)[0].message).toBe(
      'Material is fixed by the challenge and cannot be changed (expected "al-educational", got "steel").',
    )
  })

  it('writes millimetre messages', () => {
    expect(validateBracketDesign({ ...base, filletRadiusM: 0.0004 }, ch)[0].message).toBe('Fillet radius must be at least 0.5 mm (got 0.4 mm).')
    expect(validateBracketDesign({ ...base, stepLocationM: -0 }, ch)[0].message).toBe('Step location must be greater than zero (got 0 mm).')
  })

  it('validateBracketDimensions ignores the material', () => {
    expect(validateBracketDimensions({ ...base, materialId: 'steel' }, ch.designLimits)).toEqual([])
  })

  it('lists every code it can produce', () => {
    expect(BRACKET_ERROR_CODES).toEqual(['NON_FINITE', 'NON_POSITIVE', 'BELOW_MIN', 'ABOVE_MAX', 'ARM_DEEPER_THAN_ROOT', 'UNKNOWN_PARAM', 'LOCKED_FIELD_CHANGED'])
  })
})
