// Feature: torsion-shaft-1, Property 1: Shaft validation accepts exactly the configured design space
// **Validates: TSH-04, TSH-13, MM-09**
//
// Every valid-by-construction circle/tube design validates with no errors; perturbing one diameter
// beyond its range or thinning the wall below 2 mm always yields an error naming that parameter.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbTorsionDesign, shaft, solid, torsionChallenge, tube } from '../../../test/fixtures/torsion'
import { assertProperty } from '../../../test/pbt'
import { validateTorsionDesign } from './validate'

const ch = torsionChallenge()
const L = ch.sectionLimits
const MARGIN = 1e-6

describe('Property 1: shaft validation', () => {
  it('valid-by-construction designs validate', () => {
    assertProperty(
      fc.property(arbTorsionDesign(ch), (d) => {
        expect(validateTorsionDesign(d, ch)).toEqual([])
      }),
    )
  })

  it('diameters outside the configured range are rejected', () => {
    const r = L.circle.diameterM
    const outside = fc.oneof(
      fc.double({ min: MARGIN, max: r.minM - MARGIN, noNaN: true }),
      fc.double({ min: r.maxM + MARGIN, max: 1, noNaN: true }),
    )
    assertProperty(
      fc.property(outside, (D) => {
        const errs = validateTorsionDesign(shaft('d', solid(D)), ch)
        expect(errs.map((e) => e.param)).toEqual(['diameterM'])
        expect(['BELOW_MIN', 'ABOVE_MAX']).toContain(errs[0].code)
      }),
    )
  })

  it('tube walls thinner than the minimum are rejected', () => {
    const arb = fc
      .double({ min: L.tube.outerDiameterM.minM, max: L.tube.outerDiameterM.maxM, noNaN: true })
      .chain((D) => fc.double({ min: MARGIN, max: L.tube.minWallM - MARGIN, noNaN: true }).map((t) => tube(D, D - 2 * t)))
    assertProperty(
      fc.property(arb, (s) => {
        const errs = validateTorsionDesign(shaft('d', s), ch)
        expect(errs.map((e) => e.code)).toEqual(['WALL_TOO_THIN'])
      }),
    )
  })
})
