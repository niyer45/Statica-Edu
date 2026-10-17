// Feature: vibration-isolation-1, Property 1: Isolator validation accepts exactly the configured design space
// **Validates: VIB-04, VIB-13, MM-09**
//
// Every valid-by-construction design (any stiffness in the configured range, any listed material)
// validates with no errors; a stiffness outside the range always yields exactly one range error
// naming the stiffness, and an unlisted material always yields MATERIAL_NOT_ALLOWED.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVibrationDesign, vibrationChallenge } from '../../../test/fixtures/vibration'
import { assertProperty } from '../../../test/pbt'
import { validateVibrationDesign } from './validate'

const ch = vibrationChallenge()
const k = ch.stiffnessLimits
const ids = ch.materials.map((m) => m.id)

describe('Property 1: isolator validation', () => {
  it('valid-by-construction designs validate', () => {
    assertProperty(
      fc.property(arbVibrationDesign(ch), (d) => {
        expect(validateVibrationDesign(d, ch)).toEqual([])
      }),
    )
  })

  it('stiffness outside the configured range is rejected', () => {
    const outside = fc.oneof(
      fc.double({ min: 1, max: k.minNPerM * (1 - 1e-6), noNaN: true }),
      fc.double({ min: k.maxNPerM * (1 + 1e-6), max: 1e9, noNaN: true }),
    )
    assertProperty(
      fc.property(outside, fc.constantFrom(...ids), (stiffnessNPerM, materialId) => {
        const errs = validateVibrationDesign({ id: 'd', stiffnessNPerM, materialId }, ch)
        expect(errs.map((e) => e.param)).toEqual(['stiffnessNPerM'])
        expect(['BELOW_MIN', 'ABOVE_MAX']).toContain(errs[0].code)
      }),
    )
  })

  it('unlisted materials are rejected', () => {
    const unlisted = fc.string().filter((s) => !ids.includes(s))
    assertProperty(
      fc.property(arbVibrationDesign(ch), unlisted, (d, materialId) => {
        const errs = validateVibrationDesign({ ...d, materialId }, ch)
        expect(errs.map((e) => e.code)).toEqual(['MATERIAL_NOT_ALLOWED'])
      }),
    )
  })
})
