// Feature: fatigue-analysis-1, Property 2: Spindle edits keep the draft valid or leave it unchanged
// **Validates: task 70, MM-09**
//
// For any valid draft and any edit (clamp or strict set of any dimension with any value, or any
// finish), applyFatigueEdit either returns a design that validates with id and material unchanged,
// or returns errors without mutating the draft; an edit succeeds iff its candidate validates.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbFatigueDesign, fatigueChallenge } from '../../../test/fixtures/fatigue'
import { assertProperty } from '../../../test/pbt'
import { applyFatigueEdit, clampFatigueParam, isFatigueParam, type FatigueEdit } from './edit'
import { validateFatigueDesign } from './validate'

const ch = fatigueChallenge()

const arbValue = fc.oneof(fc.double({ min: -0.01, max: 0.08, noNaN: true }), fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, 0, -0))
const arbEdit: fc.Arbitrary<FatigueEdit> = fc.oneof(
  fc.record({
    type: fc.constant('setParam' as const),
    param: fc.constantFrom('neckDiameterM', 'collarDiameterM', 'filletRadiusM', 'materialId', 'surfaceFinish'),
    valueM: arbValue,
    mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
  }),
  fc.record({ type: fc.constant('setFinish' as const), finish: fc.constantFrom('ground', 'machined', 'asForged', 'polished') }),
)

describe('Property 2: spindle edits', () => {
  it('produce a valid design with unchanged id and material, or errors', () => {
    assertProperty(
      fc.property(arbFatigueDesign(ch), arbEdit, (d, edit) => {
        const snapshot = structuredClone(d)
        const r = applyFatigueEdit(d, edit, ch)
        expect(d).toEqual(snapshot)
        if (r.ok) {
          expect(validateFatigueDesign(r.value, ch)).toEqual([])
          expect(r.value.id).toBe(d.id)
          expect(r.value.materialId).toBe(d.materialId)
        } else {
          expect(r.error.length).toBeGreaterThan(0)
        }
        if (edit.type === 'setFinish') {
          expect(r.ok).toBe(validateFatigueDesign({ ...d, surfaceFinish: edit.finish as never }, ch).length === 0)
        } else if (!isFatigueParam(edit.param)) {
          expect(!r.ok && r.error.map((e) => e.code)).toEqual(['UNKNOWN_PARAM'])
        } else {
          const candidate = edit.mode === 'strict' ? { ...d, [edit.param]: edit.valueM } : clampFatigueParam(d, edit.param, edit.valueM, ch.designLimits)
          expect(r.ok).toBe(validateFatigueDesign(candidate, ch).length === 0)
        }
      }),
    )
  })
})
