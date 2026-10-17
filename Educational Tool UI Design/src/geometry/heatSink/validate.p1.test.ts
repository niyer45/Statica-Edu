// Feature: heat-sink-1, Property 1: Heat sink validation accepts exactly the configured design space
// **Validates: HSK-04, HSK-13, MM-09**
//
// Every valid-by-construction design validates with no errors; a fin count outside 2–20 or not an
// integer, an off-step thickness or height, and any (N, t) whose gap falls below 1 mm always yield
// an error naming that parameter. Validity agrees with the gap rule exactly on the whole grid.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbHeatSinkDesign, heatSink, heatSinkChallenge } from '../../../test/fixtures/heatSink'
import { assertProperty } from '../../../test/pbt'
import { finGap } from './design'
import { validateHeatSinkDesign } from './validate'

const ch = heatSinkChallenge()
const L = ch.designLimits
const W = ch.base.widthM

describe('Property 1: heat sink validation', () => {
  it('valid-by-construction designs validate', () => {
    assertProperty(
      fc.property(arbHeatSinkDesign(ch), (d) => {
        expect(validateHeatSinkDesign(d, ch)).toEqual([])
      }),
    )
  })

  it('fin counts outside the range or not integers are rejected', () => {
    const bad = fc.oneof(
      fc.integer({ min: -50, max: L.finCount.min - 1 }),
      fc.integer({ min: L.finCount.max + 1, max: 200 }),
      fc.double({ min: 2, max: 20, noNaN: true }).filter((n) => !Number.isInteger(n)),
    )
    assertProperty(
      fc.property(bad, (N) => {
        const errs = validateHeatSinkDesign(heatSink('d', N, 0.001, 0.015), ch)
        expect(errs[0].param).toBe('finCount')
        expect(['BELOW_MIN', 'ABOVE_MAX', 'NOT_INTEGER']).toContain(errs[0].code)
      }),
    )
  })

  it('off-step thicknesses and heights are rejected', () => {
    // At least 1e-5 of a step (5 nm), well beyond the 1 nm GEOM_TOL grid tolerance.
    const offset = fc.double({ min: 1e-5, max: 1 - 1e-5, noNaN: true })
    assertProperty(
      fc.property(fc.integer({ min: 0, max: 7 }), fc.integer({ min: 0, max: 39 }), offset, fc.boolean(), (kt, kh, u, thickness) => {
        const t = L.finThicknessM.minM + (kt + (thickness ? u : 0)) * L.finThicknessM.stepM
        const H = L.finHeightM.minM + (kh + (thickness ? 0 : u)) * L.finHeightM.stepM
        const errs = validateHeatSinkDesign(heatSink('d', 2, t, H), ch)
        expect(errs.map((e) => `${e.param} ${e.code}`)).toEqual([thickness ? 'finThicknessM OFF_STEP' : 'finHeightM OFF_STEP'])
      }),
    )
  })

  it('on the grid, a design is valid iff its gap is at least the 1 mm floor', () => {
    assertProperty(
      fc.property(fc.integer({ min: 2, max: 20 }), fc.integer({ min: 0, max: 8 }), (N, kt) => {
        const t = Math.round((L.finThicknessM.minM + kt * L.finThicknessM.stepM) * 1e9) / 1e9
        const errs = validateHeatSinkDesign(heatSink('d', N, t, 0.015), ch)
        const s = finGap(W, N, t)
        expect(errs.length === 0).toBe(s >= L.minGeometricGapM - 1e-9)
        if (errs.length > 0) expect(errs.map((e) => e.code)).toEqual(['GAP_TOO_SMALL'])
      }),
    )
  })
})
