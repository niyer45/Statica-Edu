// Feature: vibration-isolation-1, Property 2: Isolator edits keep the draft valid or leave it unchanged
// **Validates: VIB-04, MM-09**
//
// For any valid draft and any edit (clamp or strict stiffness with any finite or non-finite value,
// or any material id), applyVibrationEdit either returns a design that validates with the id
// unchanged, or returns errors, and never mutates the draft. Clamp edits always succeed; strict
// edits succeed iff the stiffness validates; material edits succeed iff the id is listed.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVibrationDesign, vibrationChallenge } from '../../../test/fixtures/vibration'
import { assertProperty } from '../../../test/pbt'
import { applyVibrationEdit, type VibrationEdit } from './edit'
import { checkStiffness, validateVibrationDesign } from './validate'

const ch = vibrationChallenge()
const ids = ch.materials.map((m) => m.id)

const arbValue = fc.oneof(
  fc.double({ min: -1e5, max: 5e6, noNaN: true }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0, 19500, 2000500),
)
const arbEdit: fc.Arbitrary<VibrationEdit> = fc.oneof(
  fc.record({ type: fc.constant('setStiffness' as const), valueNPerM: arbValue, mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict') }),
  fc.record({ type: fc.constant('setMaterial' as const), materialId: fc.oneof(fc.constantFrom(...ids), fc.constantFrom('cork', '')) }),
)

describe('Property 2: isolator edits', () => {
  it('produce a valid design with unchanged id, or errors', () => {
    assertProperty(
      fc.property(arbVibrationDesign(ch), arbEdit, (d, edit) => {
        const snapshot = structuredClone(d)
        const r = applyVibrationEdit(d, edit, ch)
        expect(d).toEqual(snapshot)
        if (r.ok) {
          expect(validateVibrationDesign(r.value, ch)).toEqual([])
          expect(r.value.id).toBe(d.id)
          expect(r.value).not.toBe(d)
        } else {
          expect(r.error.length).toBeGreaterThan(0)
        }
        if (edit.type === 'setMaterial') {
          expect(r.ok).toBe(ids.includes(edit.materialId))
          if (r.ok) expect(r.value.stiffnessNPerM).toBe(d.stiffnessNPerM)
        } else if (edit.mode === 'clamp') {
          expect(r.ok).toBe(true)
          if (r.ok) expect(r.value.materialId).toBe(d.materialId)
        } else {
          expect(r.ok).toBe(checkStiffness(edit.valueNPerM, ch.stiffnessLimits) === null)
        }
      }),
    )
  })
})
