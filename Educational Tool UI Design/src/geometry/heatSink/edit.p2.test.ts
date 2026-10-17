// Feature: heat-sink-1, Property 2: Heat sink edits keep the draft valid or leave it unchanged
// **Validates: HSK-04, MM-09**
//
// For any valid draft and any edit (clamp or strict set of any parameter name with any finite or
// non-finite value), applyHeatSinkEdit either returns a design that validates with the id and the
// locked material unchanged, or returns errors. Clamp edits of a known parameter always succeed
// (a non-finite value leaves the design equal). Strict edits succeed iff the single-parameter
// candidate validates, and then change only that parameter.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbHeatSinkDesign, heatSinkChallenge } from '../../../test/fixtures/heatSink'
import { assertProperty } from '../../../test/pbt'
import type { HeatSinkDesign } from './design'
import { applyHeatSinkEdit, HEAT_SINK_DESIGN_PARAMS, isHeatSinkParam, type HeatSinkEdit } from './edit'
import { validateHeatSinkDesign } from './validate'

const ch = heatSinkChallenge()

const arbValue = fc.oneof(
  fc.double({ min: -1, max: 30, noNaN: true }),
  fc.double({ min: -0.01, max: 0.06, noNaN: true }),
  fc.integer({ min: -2, max: 25 }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0),
)
const arbEdit: fc.Arbitrary<HeatSinkEdit> = fc.record({
  type: fc.constant('setParam' as const),
  param: fc.constantFrom(...HEAT_SINK_DESIGN_PARAMS, 'materialId', 'baseWidthM'),
  value: arbValue,
  mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
})

describe('Property 2: heat sink edits', () => {
  it('produce a valid design with unchanged id and locked material, or errors', () => {
    assertProperty(
      fc.property(arbHeatSinkDesign(ch), arbEdit, (d, edit) => {
        const snapshot = structuredClone(d)
        const r = applyHeatSinkEdit(d, edit, ch)
        expect(d).toEqual(snapshot)
        if (r.ok) {
          expect(validateHeatSinkDesign(r.value, ch)).toEqual([])
          expect(r.value).not.toBe(d)
          expect(r.value.id).toBe(d.id)
          expect(r.value.materialId).toBe(d.materialId)
          for (const p of HEAT_SINK_DESIGN_PARAMS) if (p !== edit.param) expect(r.value[p]).toBe(d[p])
        } else {
          expect(r.error.length).toBeGreaterThan(0)
        }
        const known = isHeatSinkParam(edit.param)
        if (known && edit.mode === 'clamp') {
          expect(r.ok).toBe(true)
          if (!Number.isFinite(edit.value)) expect(r.ok && r.value).toEqual(d)
        }
        if (known && edit.mode === 'strict') {
          const candidate: HeatSinkDesign = { ...d, [edit.param]: edit.value }
          expect(r.ok).toBe(validateHeatSinkDesign(candidate, ch).length === 0)
          if (r.ok) expect(r.value).toEqual(candidate)
        }
        if (!known) expect(r.ok).toBe(false)
      }),
    )
  })
})
