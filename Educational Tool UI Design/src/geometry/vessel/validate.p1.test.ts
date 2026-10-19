// Feature: pressure-vessel-1, Property 1: Vessel validation accepts exactly the configured design space
// **Validates: task 69, PVS-04, MM-09**
//
// Every valid-by-construction vessel validates with no errors; moving one dimension beyond its
// range yields exactly one error naming that parameter.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVesselDesign, vesselChallenge } from '../../../test/fixtures/vessel'
import { assertProperty } from '../../../test/pbt'
import { VESSEL_PARAMS } from './design'
import { validateVesselDesign } from './validate'

const ch = vesselChallenge()
const L = ch.designLimits
const MARGIN = 1e-6

describe('Property 1: vessel validation', () => {
  it('valid-by-construction designs validate', () => {
    assertProperty(
      fc.property(arbVesselDesign(ch), (d) => {
        expect(validateVesselDesign(d, ch)).toEqual([])
      }),
    )
  })

  it('a single dimension outside its range is rejected, naming that parameter', () => {
    const arb = fc.tuple(arbVesselDesign(ch), fc.constantFrom(...VESSEL_PARAMS), fc.boolean(), fc.double({ min: MARGIN, max: 0.05, noNaN: true }))
    assertProperty(
      fc.property(arb, ([d, param, above, delta]) => {
        const r = L[param]
        const value = above ? r.maxM + delta : Math.max(r.minM - delta, 1e-9)
        const errors = validateVesselDesign({ ...d, [param]: value }, ch)
        expect(errors).toHaveLength(1)
        expect(errors[0]!.param).toBe(param)
        expect(errors[0]!.code).toBe(above ? 'ABOVE_MAX' : 'BELOW_MIN')
      }),
    )
  })
})
