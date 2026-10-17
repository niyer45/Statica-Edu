// Feature: braced-frame-1, Property 2: Frame edits keep the draft valid or leave it unchanged
// **Validates: BFR-04, MM-09**
//
// For any valid draft and any edit (toggle or resize, with known or unknown member ids and catalog
// or foreign section ids), applyBracedFrameEdit either returns a design that validates with the
// material unchanged, only the named member changed and every absent diagonal's section kept, or
// returns errors without mutating the draft. Toggling a diagonal always succeeds; resizing to a
// catalog section always succeeds.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracedFrameDesign, bracedFrameChallenge } from '../../../test/fixtures/bracedFrame'
import { assertProperty } from '../../../test/pbt'
import { applyBracedFrameEdit, type BracedFrameEdit } from './edit'
import { FRAME_MEMBER_IDS, isDiagonalId } from './template'
import { validateBracedFrameDesign } from './validate'

const ch = bracedFrameChallenge()
const catalogIds = ch.sections.map((s) => s.id)

const arbMemberId = fc.oneof(fc.constantFrom(...FRAME_MEMBER_IDS), fc.constantFrom('diag3a', 'beam0', '', '__proto__'))
const arbSectionId = fc.oneof(fc.constantFrom(...catalogIds), fc.constantFrom('CHS114.3x6.3', '', 'chs60'))
const arbEdit: fc.Arbitrary<BracedFrameEdit> = fc.oneof(
  arbMemberId.map((memberId) => ({ type: 'toggleDiagonal' as const, memberId })),
  fc.record({ type: fc.constant('setMemberSection' as const), memberId: arbMemberId, sectionId: arbSectionId }),
)

describe('Property 2: frame edits', () => {
  it('produce a valid design or errors, never a mutated draft', () => {
    assertProperty(
      fc.property(arbBracedFrameDesign(), arbEdit, (draft, edit) => {
        const before = structuredClone(draft)
        const r = applyBracedFrameEdit(draft, edit, ch)
        expect(draft).toEqual(before)
        const known = (FRAME_MEMBER_IDS as readonly string[]).includes(edit.memberId)
        const shouldSucceed = known && (edit.type === 'toggleDiagonal' ? isDiagonalId(edit.memberId) : catalogIds.includes(edit.sectionId))
        expect(r.ok).toBe(shouldSucceed)
        if (!r.ok) {
          expect(r.error.length).toBeGreaterThan(0)
          return
        }
        expect(validateBracedFrameDesign(r.value, ch)).toEqual([])
        expect(r.value.materialId).toBe(draft.materialId)
        for (const id of FRAME_MEMBER_IDS) {
          if (id !== edit.memberId) expect(r.value.members[id]).toEqual(draft.members[id])
        }
        if (edit.type === 'toggleDiagonal' && isDiagonalId(edit.memberId)) {
          expect(r.value.members[edit.memberId]).toEqual({ present: !draft.members[edit.memberId].present, sectionId: draft.members[edit.memberId].sectionId })
        }
      }),
    )
  })
})
