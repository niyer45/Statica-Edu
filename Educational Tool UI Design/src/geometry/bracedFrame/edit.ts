import type { BracedFrameChallenge } from '../../challenge/bracedFrame/types'
import type { Result } from '../../challenge/types'
import type { BracedFrameDesign, BracedFrameMembers } from './design'
import { FRAME_MEMBER_LABELS, isDiagonalId, isFrameMemberId } from './template'
import { validateBracedFrameDesign, type BracedFrameDesignError } from './validate'

// Braced frame edit operations (task 49.2; BFR-04, MM-09). Pure: inputs are never mutated; a
// changed design is always a new object (unchanged member choices are shared by reference).
//
//   toggleDiagonal    flips one candidate diagonal's presence; its section choice is kept, so
//                     re-enabling restores it. Any diagonal combination is valid, mechanisms
//                     included, so this edit never fails for a diagonal of a valid draft.
//   setMemberSection  sets one member's section, present or not (an absent diagonal keeps the
//                     choice for later). A section outside the catalog is rejected.
//
// applyBracedFrameEdit either returns a new design that passes validateBracedFrameDesign or the
// errors for the request, so callers keep their draft unchanged on failure. Fixed members cannot
// be toggled (PRESENT_ON_FIXED_MEMBER), an unknown member id is UNKNOWN_MEMBER, and the locked
// material is not editable through any edit.

/** Design-level edits available to the student. Member ids are untrusted strings. */
export type BracedFrameEdit =
  | { type: 'toggleDiagonal'; memberId: string }
  | { type: 'setMemberSection'; memberId: string; sectionId: string }

/** The challenge fields applyBracedFrameEdit reads. */
export type BracedFrameEditContext = Pick<BracedFrameChallenge, 'initialDesign' | 'sections'>

function unknownMember(memberId: string): { ok: false; error: BracedFrameDesignError[] } {
  return { ok: false, error: [{ code: 'UNKNOWN_MEMBER', param: memberId, message: `"${memberId}" is not a member of this frame.` }] }
}

/**
 * Applies one edit to `draft`. Returns a new valid design, or the errors for the request (the
 * caller keeps `draft`). See the header for the rules.
 */
export function applyBracedFrameEdit(
  draft: BracedFrameDesign,
  edit: BracedFrameEdit,
  ch: BracedFrameEditContext,
): Result<BracedFrameDesign, BracedFrameDesignError[]> {
  const id = edit.memberId
  if (!isFrameMemberId(id)) return unknownMember(String(id))
  let members: BracedFrameMembers
  if (edit.type === 'toggleDiagonal') {
    if (!isDiagonalId(id)) {
      const name = FRAME_MEMBER_LABELS[id]
      return {
        ok: false,
        error: [{ code: 'PRESENT_ON_FIXED_MEMBER', param: id, message: `The ${name} (${id}) is always present; only diagonals can be added or removed.` }],
      }
    }
    const current = draft.members[id]
    members = { ...draft.members, [id]: { present: !current.present, sectionId: current.sectionId } }
  } else if (isDiagonalId(id)) {
    members = { ...draft.members, [id]: { present: draft.members[id].present, sectionId: edit.sectionId } }
  } else {
    members = { ...draft.members, [id]: { sectionId: edit.sectionId } }
  }
  const candidate: BracedFrameDesign = { ...draft, members }
  const errors = validateBracedFrameDesign(candidate, ch)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}
