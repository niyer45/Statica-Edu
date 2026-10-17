// Feature: torsion-shaft-1, Property 2: Shaft edits keep the draft valid or leave it unchanged
// **Validates: TSH-04, MM-09**
//
// For any valid draft and any edit (section switch, clamp or strict parameter set with any finite
// or non-finite value), applyTorsionEdit either returns a design that validates with the locked
// fields unchanged, or returns errors. Clamp edits of a known parameter with a finite value always
// succeed. Strict edits succeed iff the single-parameter candidate validates.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbTorsionDesign, torsionChallenge } from '../../../test/fixtures/torsion'
import { assertProperty } from '../../../test/pbt'
import { applyTorsionEdit, TORSION_SECTION_PARAMS, type TorsionEdit } from './edit'
import { validateTorsionDesign } from './validate'

const ch = torsionChallenge()

const arbValue = fc.oneof(
  fc.double({ min: -0.1, max: 0.2, noNaN: true }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0),
)
const arbEdit: fc.Arbitrary<TorsionEdit> = fc.oneof(
  fc.constantFrom<'circle' | 'tube'>('circle', 'tube').map((kind) => ({ type: 'setSection', kind }) as TorsionEdit),
  fc.record({
    type: fc.constant('setParam' as const),
    param: fc.constantFrom('diameterM', 'outerDiameterM', 'innerDiameterM', 'widthM'),
    valueM: arbValue,
    mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
  }),
)

describe('Property 2: shaft edits', () => {
  it('produce a valid design with unchanged id and locked fields, or errors', () => {
    assertProperty(
      fc.property(arbTorsionDesign(ch), arbEdit, (d, edit) => {
        const snapshot = structuredClone(d)
        const r = applyTorsionEdit(d, edit, ch)
        expect(d).toEqual(snapshot)
        if (r.ok) {
          expect(validateTorsionDesign(r.value, ch)).toEqual([])
          expect(r.value.id).toBe(d.id)
          expect(r.value.lengthM).toBe(d.lengthM)
          expect(r.value.materialId).toBe(d.materialId)
        } else {
          expect(r.error.length).toBeGreaterThan(0)
        }
        const known = edit.type === 'setParam' && (TORSION_SECTION_PARAMS[d.section.kind] as readonly string[]).includes(edit.param)
        if (edit.type === 'setSection' || (known && edit.mode === 'clamp' && Number.isFinite(edit.valueM))) {
          expect(r.ok).toBe(true)
        }
      }),
    )
  })
})
