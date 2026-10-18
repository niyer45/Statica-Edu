import { describe, expect, it } from 'vitest'
import { bracket, bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import { GEOM_TOL } from '../sections'
import type { BracketDesign } from './design'
import { BRACKET_ERROR_CODES, BRACKET_PARAM_LABELS, validateBracketDesign, validateBracketDimensions } from './validate'

// Bracket geometry validation (task 55 L-bracket; MM-09).

const ch = bracketChallenge()
const base = worksheetFixture('baseline').design
const codes = (d: BracketDesign) => validateBracketDesign(d, ch).map((e) => `${e.param} ${e.code}`)

describe('validateBracketDesign', () => {
  it('accepts the baseline and the reference', () => {
    expect(validateBracketDesign(base, ch)).toEqual([])
    expect(validateBracketDesign(ch.referenceDesign as BracketDesign, ch)).toEqual([])
  })

  it('accepts every range edge, inclusive within GEOM_TOL', () => {
    const L = ch.designLimits
    expect(validateBracketDesign(bracket('lo', L.thicknessM.minM, L.widthM.minM, L.flangeHeightM.minM, L.innerRadiusM.minM), ch)).toEqual([])
    expect(validateBracketDesign(bracket('hi', L.thicknessM.maxM, L.widthM.maxM, L.flangeHeightM.maxM, L.innerRadiusM.maxM), ch)).toEqual([])
    expect(validateBracketDesign({ ...base, widthM: L.widthM.maxM + 0.5 * GEOM_TOL }, ch)).toEqual([])
    expect(codes({ ...base, widthM: L.widthM.maxM + 2 * GEOM_TOL })).toEqual(['widthM ABOVE_MAX'])
  })

  it('rejects out-of-range values per parameter, in parameter order', () => {
    expect(codes({ ...base, thicknessM: 0.011, widthM: 0.03, flangeHeightM: 0.16, innerRadiusM: 0.0005 })).toEqual([
      'thicknessM ABOVE_MAX',
      'widthM BELOW_MIN',
      'flangeHeightM ABOVE_MAX',
      'innerRadiusM BELOW_MIN',
    ])
    expect(codes({ ...base, flangeHeightM: 0.045 })).toEqual(['flangeHeightM BELOW_MIN'])
    expect(codes({ ...base, innerRadiusM: 0.013 })).toEqual(['innerRadiusM ABOVE_MAX'])
  })

  it('reports non-finite and non-positive values once each', () => {
    expect(codes({ ...base, thicknessM: Number.NaN })).toEqual(['thicknessM NON_FINITE'])
    expect(codes({ ...base, widthM: Number.POSITIVE_INFINITY })).toEqual(['widthM NON_FINITE'])
    expect(codes({ ...base, flangeHeightM: 0 })).toEqual(['flangeHeightM NON_POSITIVE'])
    expect(codes({ ...base, innerRadiusM: -0.001 })).toEqual(['innerRadiusM NON_POSITIVE'])
  })

  it('is total over untrusted input', () => {
    const missing = { id: 'x', materialId: 'al-educational' } as unknown as BracketDesign
    expect(codes(missing)).toEqual(['thicknessM NON_FINITE', 'widthM NON_FINITE', 'flangeHeightM NON_FINITE', 'innerRadiusM NON_FINITE'])
    expect(validateBracketDesign({ ...base, thicknessM: '3' as unknown as number }, ch)[0].message).toBe('Thickness must be a finite number (got "3").')
    expect(validateBracketDesign(null as unknown as BracketDesign, ch).map((e) => e.code)).toEqual([
      'NON_FINITE',
      'NON_FINITE',
      'NON_FINITE',
      'NON_FINITE',
      'LOCKED_FIELD_CHANGED',
    ])
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(validateBracketDesign({ ...base, innerRadiusM: cyclic as unknown as number }, ch)[0].message).toContain('(got object)')
  })

  it('rejects a changed locked material', () => {
    expect(codes({ ...base, materialId: 'steel' })).toEqual(['materialId LOCKED_FIELD_CHANGED'])
    expect(validateBracketDesign({ ...base, materialId: 'steel' }, ch)[0].message).toBe(
      'Material is fixed by the challenge and cannot be changed (expected "al-educational", got "steel").',
    )
  })

  it('writes millimetre messages with the student-facing labels', () => {
    expect(validateBracketDesign({ ...base, innerRadiusM: 0.0004 }, ch)[0].message).toBe('Inner bend radius must be at least 1 mm (got 0.4 mm).')
    expect(validateBracketDesign({ ...base, flangeHeightM: -0 }, ch)[0].message).toBe('Flange height must be greater than zero (got 0 mm).')
    expect(BRACKET_PARAM_LABELS).toEqual({ thicknessM: 'Thickness', widthM: 'Width', flangeHeightM: 'Flange height', innerRadiusM: 'Inner bend radius' })
  })

  it('validateBracketDimensions ignores the material', () => {
    expect(validateBracketDimensions({ ...base, materialId: 'steel' }, ch.designLimits)).toEqual([])
  })

  it('lists every code it can produce', () => {
    expect(BRACKET_ERROR_CODES).toEqual(['NON_FINITE', 'NON_POSITIVE', 'BELOW_MIN', 'ABOVE_MAX', 'UNKNOWN_PARAM', 'LOCKED_FIELD_CHANGED'])
  })
})
