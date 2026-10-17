import { describe, expect, it } from 'vitest'
import { isolator, vibrationChallenge } from '../../../test/fixtures/vibration'
import { vibrationDesignSchema, type VibrationDesign } from './design'
import { checkStiffness, STIFFNESS_REL_TOL, validateVibrationDesign, VIBRATION_DESIGN_ERROR_CODES } from './validate'

// Vibration isolator design validation (task 50.2; VIB-04, VIB-13 invalid-input rejection, MM-09).

const ch = vibrationChallenge()
const limits = ch.stiffnessLimits
const designCodes = (d: unknown) => validateVibrationDesign(d as VibrationDesign, ch).map((e) => `${e.param} ${e.code}`)
const withK = (k: unknown) => ({ id: 'd', stiffnessNPerM: k, materialId: 'neoprene' })

describe('checkStiffness', () => {
  it('accepts the configured range edges and values between grid steps', () => {
    for (const k of [20000, 2000000, 85000, 61291.5625, 72649.1928025733]) expect(checkStiffness(k, limits)).toBeNull()
  })

  it('rejects 19500 and 2000500 N/m (VIB-13 fixtures) within a relative tolerance', () => {
    expect(checkStiffness(19500, limits)?.code).toBe('BELOW_MIN')
    expect(checkStiffness(2000500, limits)?.code).toBe('ABOVE_MAX')
    expect(checkStiffness(20000 * (1 - 0.5 * STIFFNESS_REL_TOL), limits)).toBeNull()
    expect(checkStiffness(20000 * (1 - 4 * STIFFNESS_REL_TOL), limits)?.code).toBe('BELOW_MIN')
    expect(checkStiffness(2000000 * (1 + 0.5 * STIFFNESS_REL_TOL), limits)).toBeNull()
    expect(checkStiffness(2000000 * (1 + 4 * STIFFNESS_REL_TOL), limits)?.code).toBe('ABOVE_MAX')
  })

  it('reports exactly one error for non-finite or non-positive stiffness', () => {
    expect(checkStiffness(Number.NaN, limits)?.code).toBe('NON_FINITE')
    expect(checkStiffness(Number.POSITIVE_INFINITY, limits)?.code).toBe('NON_FINITE')
    expect(checkStiffness('85000', limits)?.code).toBe('NON_FINITE')
    expect(checkStiffness(undefined, limits)?.code).toBe('NON_FINITE')
    expect(checkStiffness(0, limits)?.code).toBe('NON_POSITIVE')
    expect(checkStiffness(-85000, limits)?.code).toBe('NON_POSITIVE')
  })

  it('writes messages in kN/m and names unusual values', () => {
    expect(checkStiffness(19500, limits)?.message).toBe('Stiffness must be at least 20 kN/m (got 19.5 kN/m).')
    expect(checkStiffness(2000500, limits)?.message).toBe('Stiffness must be at most 2000 kN/m (got 2000.5 kN/m).')
    expect(checkStiffness(-0, limits)?.message).toBe('Stiffness must be greater than zero (got 0 kN/m).')
    expect(checkStiffness(undefined, limits)?.message).toBe('Stiffness must be a finite number (got missing).')
    expect(checkStiffness(Number.NaN, limits)?.message).toBe('Stiffness must be a finite number (got NaN).')
    expect(checkStiffness(10n as unknown, limits)?.message).toBe('Stiffness must be a finite number (got bigint).')
  })
})

describe('validateVibrationDesign', () => {
  it('accepts the configured initial and reference designs and every material', () => {
    expect(validateVibrationDesign(ch.initialDesign, ch)).toEqual([])
    expect(validateVibrationDesign(ch.referenceDesign!, ch)).toEqual([])
    for (const m of ch.materials) expect(validateVibrationDesign({ id: 'm', stiffnessNPerM: 85000, materialId: m.id }, ch)).toEqual([])
  })

  it('rejects an unknown, missing or non-string material id', () => {
    expect(designCodes({ id: 'd', stiffnessNPerM: 85000, materialId: 'cork' })).toEqual(['materialId MATERIAL_NOT_ALLOWED'])
    expect(designCodes({ id: 'd', stiffnessNPerM: 85000 })).toEqual(['materialId MATERIAL_NOT_ALLOWED'])
    expect(designCodes({ id: 'd', stiffnessNPerM: 85000, materialId: 7 })).toEqual(['materialId MATERIAL_NOT_ALLOWED'])
    expect(validateVibrationDesign({ id: 'd', stiffnessNPerM: 85000, materialId: 'cork' }, ch)[0].message).toBe(
      'Material "cork" is not available in this challenge (allowed: steelSpring, naturalRubber, neoprene, butylRubber, highDampingElastomer).',
    )
  })

  it('rejects changes to each locked field, in the fixed order, after design errors (VIB-03, VIB-13)', () => {
    const tampered = {
      ...withK(19500),
      materialId: 'cork',
      linearStrokeM: 0.03,
      amplitudeM: 0.0004,
      operatingBandHz: { minHz: 20, maxHz: 50 },
      massKg: 40,
    }
    expect(designCodes(tampered)).toEqual([
      'stiffnessNPerM BELOW_MIN',
      'materialId MATERIAL_NOT_ALLOWED',
      'massKg LOCKED_FIELD_CHANGED',
      'operatingBandHz LOCKED_FIELD_CHANGED',
      'amplitudeM LOCKED_FIELD_CHANGED',
      'linearStrokeM LOCKED_FIELD_CHANGED',
    ])
    expect(validateVibrationDesign(tampered as unknown as VibrationDesign, ch)[2].message).toBe(
      'Component mass is fixed by the challenge and cannot be changed (expected 50, got 40).',
    )
  })

  it('accepts a carried locked field only when it equals the challenge value', () => {
    expect(designCodes({ ...withK(85000), massKg: 50, operatingBandHz: { minHz: 25, maxHz: 50 } })).toEqual([])
    expect(designCodes({ ...withK(85000), operatingBandHz: { minHz: 25, maxHz: 50, extra: 1 } })).toEqual(['operatingBandHz LOCKED_FIELD_CHANGED'])
    expect(designCodes({ ...withK(85000), operatingBandHz: [25, 50] })).toEqual(['operatingBandHz LOCKED_FIELD_CHANGED'])
    expect(designCodes({ ...withK(85000), massKg: undefined })).toEqual(['massKg LOCKED_FIELD_CHANGED'])
  })

  it('is total over untrusted values', () => {
    for (const v of [null, undefined, 42, 'design', []]) {
      expect(designCodes(v)).toEqual(['stiffnessNPerM NON_FINITE', 'materialId MATERIAL_NOT_ALLOWED'])
    }
    const cyclic: Record<string, unknown> = { ...withK(85000) }
    cyclic.massKg = cyclic
    expect(validateVibrationDesign(cyclic as unknown as VibrationDesign, ch)[0].message).toContain('got object')
  })

  it('rejects each VIB-13 invalid-input class before analysis', () => {
    expect(designCodes(withK(19500))).toEqual(['stiffnessNPerM BELOW_MIN'])
    expect(designCodes(withK(2000500))).toEqual(['stiffnessNPerM ABOVE_MAX'])
    expect(designCodes(withK(Number.NaN))).toEqual(['stiffnessNPerM NON_FINITE'])
    expect(designCodes(withK(Number.NEGATIVE_INFINITY))).toEqual(['stiffnessNPerM NON_FINITE'])
    expect(designCodes(withK(0))).toEqual(['stiffnessNPerM NON_POSITIVE'])
    expect(designCodes(withK(-1))).toEqual(['stiffnessNPerM NON_POSITIVE'])
    expect(designCodes({ ...withK(85000), materialId: 'unknown' })).toEqual(['materialId MATERIAL_NOT_ALLOWED'])
    for (const field of ['massKg', 'operatingBandHz', 'amplitudeM', 'linearStrokeM']) {
      expect(designCodes({ ...withK(85000), [field]: 1 })).toEqual([`${field} LOCKED_FIELD_CHANGED`])
    }
  })

  it('does not mutate its input and lists every error code', () => {
    const d = isolator('d', 85000, 0.1)
    const before = structuredClone(d)
    validateVibrationDesign(d, ch)
    expect(d).toEqual(before)
    expect(VIBRATION_DESIGN_ERROR_CODES).toEqual(['NON_FINITE', 'NON_POSITIVE', 'BELOW_MIN', 'ABOVE_MAX', 'MATERIAL_NOT_ALLOWED', 'LOCKED_FIELD_CHANGED'])
  })
})

describe('vibration design schema', () => {
  it('parses valid designs and rejects unknown keys, locked fields and non-positive stiffness', () => {
    expect(vibrationDesignSchema.safeParse(ch.initialDesign).success).toBe(true)
    expect(vibrationDesignSchema.safeParse({ ...ch.initialDesign, massKg: 50 }).success).toBe(false)
    expect(vibrationDesignSchema.safeParse({ ...ch.initialDesign, stiffnessNPerM: 0 }).success).toBe(false)
    expect(vibrationDesignSchema.safeParse({ ...ch.initialDesign, materialId: '' }).success).toBe(false)
  })
})
