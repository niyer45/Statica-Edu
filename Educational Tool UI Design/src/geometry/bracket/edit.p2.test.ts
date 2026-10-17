// Feature: mounting-bracket-1, Property 2: Bracket edits keep the draft valid or leave it unchanged
// **Validates: MBR-05, MM-09**
//
// For any valid draft and any edit (clamp or strict set of any parameter with any finite or
// non-finite value), applyBracketEdit either returns a design that validates with the id and
// locked material unchanged, or returns errors without mutating the draft. A clamp edit of a known
// parameter with a finite value fails only for the coupled d > D rule. A strict edit succeeds iff
// the single-parameter candidate validates.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracketDesign, bracketChallenge } from '../../../test/fixtures/bracket'
import { assertProperty } from '../../../test/pbt'
import { applyBracketEdit, isBracketParam, type BracketEdit } from './edit'
import { validateBracketDesign } from './validate'

const ch = bracketChallenge()

const arbValue = fc.oneof(
  fc.double({ min: -0.1, max: 0.4, noNaN: true }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0),
)
const arbEdit: fc.Arbitrary<BracketEdit> = fc.record({
  type: fc.constant('setParam' as const),
  param: fc.constantFrom('rootDepthM', 'armDepthM', 'stepLocationM', 'filletRadiusM', 'materialId', 'lengthM'),
  valueM: arbValue,
  mode: fc.constantFrom<'clamp' | 'strict'>('clamp', 'strict'),
})

describe('Property 2: bracket edits', () => {
  it('produce a valid design with unchanged id and material, or errors', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), arbEdit, (d, edit) => {
        const snapshot = structuredClone(d)
        const r = applyBracketEdit(d, edit, ch)
        expect(d).toEqual(snapshot)
        if (r.ok) {
          expect(validateBracketDesign(r.value, ch)).toEqual([])
          expect(r.value.id).toBe(d.id)
          expect(r.value.materialId).toBe(d.materialId)
          expect(r.value.armDepthM).toBeLessThanOrEqual(r.value.rootDepthM)
        } else {
          expect(r.error.length).toBeGreaterThan(0)
        }
        if (!isBracketParam(edit.param)) {
          expect(!r.ok && r.error.map((e) => e.code)).toEqual(['UNKNOWN_PARAM'])
        } else if (edit.mode === 'clamp' && !r.ok) {
          expect(r.error.map((e) => e.code)).toEqual(['ARM_DEEPER_THAN_ROOT'])
        } else if (edit.mode === 'strict') {
          expect(r.ok).toBe(validateBracketDesign({ ...d, [edit.param]: edit.valueM }, ch).length === 0)
        }
      }),
    )
  })
})
