// Feature: stress-strain-1, Property 1: Rod validation accepts exactly the configured design space
// **Validates: SSR-04, SSR-13, MM-09**
//
// Every valid-by-construction rod validates with no errors; a diameter outside the configured range
// or an unlisted material always yields an error naming that parameter.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbAxialDesign, axialChallenge, rod } from '../../../test/fixtures/axial'
import { assertProperty } from '../../../test/pbt'
import { validateAxialDesign } from './validate'

const ch = axialChallenge()
const r = ch.diameterLimits
const MARGIN = 1e-6

describe('Property 1: rod validation', () => {
  it('valid-by-construction designs validate', () => {
    assertProperty(fc.property(arbAxialDesign(ch), (d) => {
      expect(validateAxialDesign(d, ch)).toEqual([])
    }))
  })

  it('diameters outside the range and unlisted materials are rejected', () => {
    const outside = fc.oneof(fc.double({ min: MARGIN, max: r.minM - MARGIN, noNaN: true }), fc.double({ min: r.maxM + MARGIN, max: 1, noNaN: true }))
    assertProperty(fc.property(outside, (d) => {
      expect(validateAxialDesign(rod('x', d, 'steel'), ch).map((e) => e.param)).toEqual(['diameterM'])
    }))
    const unlisted = fc.string().filter((s) => !ch.materials.some((m) => m.id === s))
    assertProperty(fc.property(arbAxialDesign(ch), unlisted, (d, m) => {
      expect(validateAxialDesign({ ...d, materialId: m }, ch).map((e) => e.code)).toEqual(['MATERIAL_NOT_ALLOWED'])
    }))
  })
})
