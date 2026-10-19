// Feature: pressure-vessel-1, Property 2: Vessel edits keep the draft valid or leave it unchanged
// **Validates: task 69, MM-09**
//
// For any valid draft and any edit (clamp or strict set of any parameter with any finite or
// non-finite value), applyVesselEdit either returns a design that validates with the id and
// locked material unchanged, or returns errors without mutating the draft. A clamp edit of a known
// parameter always succeeds (the parameters are independent). A strict edit succeeds iff the
// single-parameter candidate validates.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbVesselDesign, vesselChallenge } from '../../../test/fixtures/vessel'
import { assertProperty } from '../../../test/pbt'
import { applyVesselEdit, isVesselParam, type VesselEdit } from './edit'
import { validateVesselDesign } from './validate'

const ch = vesselChallenge()

const arbValue = fc.oneof(
  fc.double({ min: -0.1, max: 2, noNaN: true }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0),
)
const arbEdit: fc.Arbitrary<VesselEdit> = fc.record({
  type: fc.constant('setParam' as const),
  param: fc.constantFrom('innerDiameterM', 'shellLengthM', 'shellThicknessM', 'headThicknessM', 'materialId', 'pressurePa'),
  valueM: arbValue,
  mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
})

describe('Property 2: vessel edits', () => {
  it('produce a valid design with unchanged id and material, or errors', () => {
    assertProperty(
      fc.property(arbVesselDesign(ch), arbEdit, (d, edit) => {
        const before = JSON.stringify(d)
        const r = applyVesselEdit(d, edit, ch)
        expect(JSON.stringify(d)).toBe(before)
        if (r.ok) {
          expect(validateVesselDesign(r.value, ch)).toEqual([])
          expect(r.value.id).toBe(d.id)
          expect(r.value.materialId).toBe(d.materialId)
        } else {
          expect(r.error.length).toBeGreaterThan(0)
        }
        if (edit.mode === 'clamp' && isVesselParam(edit.param)) expect(r.ok).toBe(true)
        if (edit.mode === 'strict' && isVesselParam(edit.param)) {
          expect(r.ok).toBe(validateVesselDesign({ ...d, [edit.param]: edit.valueM }, ch).length === 0)
        }
        if (!isVesselParam(edit.param)) expect(r.ok).toBe(false)
      }),
    )
  })
})
