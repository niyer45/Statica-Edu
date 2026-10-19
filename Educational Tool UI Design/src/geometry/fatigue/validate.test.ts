import { describe, expect, it } from 'vitest'
import { fatigueChallenge, spindle } from '../../../test/fixtures/fatigue'
import { shoulderHeightM, type FatigueDesign } from './design'
import { FATIGUE_ERROR_CODES, validateFatigueDesign, validateFatigueDimensions } from './validate'

const ch = fatigueChallenge()
const ok = spindle('ok', 0.0245, 0.034, 0.002, 'machined')

describe('validateFatigueDesign', () => {
  it('accepts the Baseline, the reference and the range corners that fit', () => {
    expect(validateFatigueDesign(ch.initialDesign, ch)).toEqual([])
    expect(validateFatigueDesign(ch.referenceDesign!, ch)).toEqual([])
    expect(validateFatigueDesign(spindle('lo', 0.02, 0.03, 0.0005, 'ground'), ch)).toEqual([])
    expect(validateFatigueDesign(spindle('hi', 0.04, 0.06, 0.005, 'asForged'), ch)).toEqual([])
  })

  it('reports per-dimension errors in parameter order, then the finish and the material', () => {
    const bad = { ...ok, neckDiameterM: Number.NaN, collarDiameterM: -1, filletRadiusM: 0.01, surfaceFinish: 'polished', materialId: 'x' } as unknown as FatigueDesign
    expect(validateFatigueDesign(bad, ch).map((e) => [e.code, e.param])).toEqual([
      ['NON_FINITE', 'neckDiameterM'],
      ['NON_POSITIVE', 'collarDiameterM'],
      ['ABOVE_MAX', 'filletRadiusM'],
      ['FINISH_NOT_ALLOWED', 'surfaceFinish'],
      ['LOCKED_FIELD_CHANGED', 'materialId'],
    ])
  })

  it('checks ranges inclusively with GEOM_TOL', () => {
    expect(validateFatigueDesign({ ...ok, neckDiameterM: 0.02 - 5e-10 }, ch)).toEqual([])
    expect(validateFatigueDesign({ ...ok, neckDiameterM: 0.02 - 2e-9 }, ch)[0]!.code).toBe('BELOW_MIN')
    expect(validateFatigueDesign({ ...ok, collarDiameterM: 0.06 + 2e-9, neckDiameterM: 0.04 }, ch)[0]!.code).toBe('ABOVE_MAX')
  })

  it('requires the fillet to be smaller than the shoulder height', () => {
    expect(shoulderHeightM(ok)).toBeCloseTo(0.00475, 15)
    expect(validateFatigueDesign({ ...ok, filletRadiusM: 0.00475 }, ch).map((e) => e.code)).toEqual(['FILLET_EXCEEDS_STEP'])
    expect(validateFatigueDesign({ ...ok, filletRadiusM: 0.0047 }, ch)).toEqual([])
    // A collar not larger than the neck has no step at all.
    const flat = validateFatigueDesign({ ...ok, neckDiameterM: 0.035, collarDiameterM: 0.034 }, ch)
    expect(flat.map((e) => e.code)).toEqual(['FILLET_EXCEEDS_STEP'])
    expect(flat[0]!.message).toContain('(0 mm)')
  })

  it('skips the step rule while a dimension is invalid, and is total over junk input', () => {
    expect(validateFatigueDimensions({ ...ok, collarDiameterM: 0.1 }, ch.designLimits).map((e) => e.code)).toEqual(['ABOVE_MAX'])
    expect(validateFatigueDesign(null as unknown as FatigueDesign, ch).map((e) => e.code)).toEqual(['NON_FINITE', 'NON_FINITE', 'NON_FINITE', 'FINISH_NOT_ALLOWED', 'LOCKED_FIELD_CHANGED'])
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const msg = validateFatigueDesign({ ...ok, neckDiameterM: circular as unknown as number }, ch)[0]!.message
    expect(msg).toContain('object')
  })

  it('refuses a finish the challenge does not offer', () => {
    const limited = { ...ch, allowedFinishes: ['machined' as const] }
    expect(validateFatigueDesign({ ...ok, surfaceFinish: 'ground' }, limited).map((e) => e.code)).toEqual(['FINISH_NOT_ALLOWED'])
  })

  it('declares every code it can produce', () => {
    expect([...FATIGUE_ERROR_CODES].sort()).toEqual(['ABOVE_MAX', 'BELOW_MIN', 'FILLET_EXCEEDS_STEP', 'FINISH_NOT_ALLOWED', 'LOCKED_FIELD_CHANGED', 'NON_FINITE', 'NON_POSITIVE', 'UNKNOWN_PARAM'])
  })
})
