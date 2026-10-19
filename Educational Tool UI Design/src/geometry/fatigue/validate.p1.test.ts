// Feature: fatigue-analysis-1, Property 1: Spindle validation accepts exactly the configured design space
// **Validates: task 70, FAT-05, MM-09**
//
// Every valid-by-construction spindle validates with no errors; a single dimension beyond its range
// yields exactly one error naming that parameter; a fillet at or above the shoulder height yields
// exactly FILLET_EXCEEDS_STEP.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbFatigueDesign, fatigueChallenge } from '../../../test/fixtures/fatigue'
import { assertProperty } from '../../../test/pbt'
import { FATIGUE_PARAMS } from './design'
import { validateFatigueDesign } from './validate'

const ch = fatigueChallenge()
const L = ch.designLimits

describe('Property 1: spindle validation', () => {
  it('valid-by-construction designs validate', () => {
    assertProperty(fc.property(arbFatigueDesign(ch), (d) => { expect(validateFatigueDesign(d, ch)).toEqual([]) }))
  })

  it('a single dimension outside its range is rejected, naming that parameter', () => {
    const arb = fc.tuple(arbFatigueDesign(ch), fc.constantFrom(...FATIGUE_PARAMS), fc.boolean(), fc.double({ min: 1e-6, max: 0.01, noNaN: true }))
    assertProperty(
      fc.property(arb, ([d, param, above, delta]) => {
        const r = L[param]
        const value = above ? r.maxM + delta : r.minM - delta
        if (value <= 0) return
        const errs = validateFatigueDesign({ ...d, [param]: value }, ch)
        expect(errs.map((e) => e.param)).toEqual([param])
        expect(errs[0]!.code).toBe(above ? 'ABOVE_MAX' : 'BELOW_MIN')
      }),
    )
  })

  it('a fillet that does not fit inside the step is rejected', () => {
    assertProperty(
      fc.property(arbFatigueDesign(ch), fc.double({ min: 0, max: 0.004, noNaN: true }), (d, extra) => {
        const h = (d.collarDiameterM - d.neckDiameterM) / 2
        const r = h + extra
        if (r < L.filletRadiusM.minM || r > L.filletRadiusM.maxM) return
        expect(validateFatigueDesign({ ...d, filletRadiusM: r }, ch).map((e) => e.code)).toEqual(['FILLET_EXCEEDS_STEP'])
      }),
    )
  })
})
