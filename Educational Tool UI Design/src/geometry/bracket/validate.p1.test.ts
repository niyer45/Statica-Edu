// Feature: mounting-bracket-1, Property 1: Bracket validation accepts exactly the configured design space
// **Validates: MBR-05, MBR-17 (invalid input), MM-09**
//
// Every valid-by-construction bracket (stepped or uniform) validates with no errors; perturbing one
// dimension beyond its range yields exactly one error naming that parameter; any arm deeper than
// the root yields ARM_DEEPER_THAN_ROOT.
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
    // Out-of-range on the low side for every parameter keeps d ≤ D (D only grows above, d only shrinks below).
    const arb = fc.tuple(arbBracketDesign(ch), fc.constantFrom(...BRACKET_PARAMS), fc.boolean(), fc.double({ min: MARGIN, max: 0.01, noNaN: true }))
    assertProperty(
      fc.property(arb, ([d, param, above, delta]) => {
        const r = L[param]
        const raiseArm = param === 'armDepthM' && above
        const lowerRoot = param === 'rootDepthM' && !above
        if (raiseArm || lowerRoot) return
        const value = above ? r.maxM + delta : Math.max(MARGIN, r.minM - delta)
        if (!above && value >= r.minM) return
        const errs = validateBracketDesign({ ...d, [param]: value }, ch)
        expect(errs.map((e) => e.param)).toEqual([param])
        expect(errs[0].code).toBe(above ? 'ABOVE_MAX' : 'BELOW_MIN')
      }),
    )
  })

  it('any arm deeper than the root is rejected', () => {
    const arb = fc
      .double({ min: L.armDepthM.minM, max: L.rootDepthM.maxM - MARGIN, noNaN: true })
      .chain((D) => fc.double({ min: D + MARGIN * 1e-3, max: L.armDepthM.maxM, noNaN: true }).map((dArm) => [D, dArm] as const))
    assertProperty(
      fc.property(arbBracketDesign(ch), arb, (d, [D, dArm]) => {
        if (!(dArm > D) || D < L.rootDepthM.minM) return
        const errs = validateBracketDesign({ ...d, rootDepthM: D, armDepthM: dArm }, ch)
        expect(errs.map((e) => e.code)).toEqual(['ARM_DEEPER_THAN_ROOT'])
      }),
    )
  })
})
