// Feature: mounting-bracket-1, Property 1: Bracket validation accepts exactly the configured design space
// **Validates: task 55 L-bracket, MM-09**
//
// Every valid-by-construction bracket validates with no errors; perturbing one dimension beyond
// its range yields exactly one error naming that parameter.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracketDesign, bracketChallenge } from '../../../test/fixtures/bracket'
import { assertProperty } from '../../../test/pbt'
import { BRACKET_PARAMS } from './design'
import { validateBracketDesign } from './validate'

const ch = bracketChallenge()
const L = ch.designLimits
const MARGIN = 1e-6

describe('Property 1: bracket validation', () => {
  it('valid-by-construction designs validate', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), (d) => {
        expect(validateBracketDesign(d, ch)).toEqual([])
      }),
    )
  })

  it('a single dimension outside its range is rejected, naming that parameter', () => {
    const arb = fc.tuple(arbBracketDesign(ch), fc.constantFrom(...BRACKET_PARAMS), fc.boolean(), fc.double({ min: MARGIN, max: 0.01, noNaN: true }))
    assertProperty(
      fc.property(arb, ([d, param, above, delta]) => {
        const r = L[param]
        const value = above ? r.maxM + delta : Math.max(MARGIN, r.minM - delta)
        if (!above && value >= r.minM) return
        const errs = validateBracketDesign({ ...d, [param]: value }, ch)
        expect(errs.map((e) => e.param)).toEqual([param])
        expect(errs[0].code).toBe(above ? 'ABOVE_MAX' : 'BELOW_MIN')
      }),
    )
  })
})
