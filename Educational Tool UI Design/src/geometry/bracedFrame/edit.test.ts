import { describe, expect, it } from 'vitest'
import { bracedFrameChallenge, worksheetFixture } from '../../../test/fixtures/bracedFrame'
import { applyBracedFrameEdit } from './edit'
import { validateBracedFrameDesign } from './validate'

// Braced frame edits (task 49.2; BFR-04, MM-09).

const ch = bracedFrameChallenge()
const baseline = worksheetFixture('baseline').design

function ok<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`edit rejected: ${JSON.stringify(r.error)}`)
  return r.value
}

describe('toggleDiagonal', () => {
  it('flips presence and keeps the section choice, so re-enabling restores it', () => {
    const off = ok(applyBracedFrameEdit(baseline, { type: 'toggleDiagonal', memberId: 'diag2b' }, ch))
    expect(off.members.diag2b).toEqual({ present: false, sectionId: 'CHS48.3x3.2' })
    const resized = ok(applyBracedFrameEdit(off, { type: 'setMemberSection', memberId: 'diag2b', sectionId: 'CHS88.9x5.0' }, ch))
    expect(resized.members.diag2b).toEqual({ present: false, sectionId: 'CHS88.9x5.0' })
    const on = ok(applyBracedFrameEdit(resized, { type: 'toggleDiagonal', memberId: 'diag2b' }, ch))
    expect(on.members.diag2b).toEqual({ present: true, sectionId: 'CHS88.9x5.0' })
  })

  it('allows an unbraced storey: a mechanism is a valid design', () => {
    const d = ok(applyBracedFrameEdit(baseline, { type: 'toggleDiagonal', memberId: 'diag1b' }, ch))
    expect(d.members.diag1b.present).toBe(false)
    expect(validateBracedFrameDesign(d, ch)).toEqual([])
  })

  it('rejects toggling a fixed member and an unknown member', () => {
    const fixed = applyBracedFrameEdit(baseline, { type: 'toggleDiagonal', memberId: 'col1L' }, ch)
    expect(!fixed.ok && fixed.error).toEqual([
      { code: 'PRESENT_ON_FIXED_MEMBER', param: 'col1L', message: 'The lower left column (col1L) is always present; only diagonals can be added or removed.' },
    ])
    const unknown = applyBracedFrameEdit(baseline, { type: 'toggleDiagonal', memberId: 'diag3a' }, ch)
    expect(!unknown.ok && unknown.error.map((e) => e.code)).toEqual(['UNKNOWN_MEMBER'])
  })
})

describe('setMemberSection', () => {
  it('sets one member and shares the other choices by reference', () => {
    const d = ok(applyBracedFrameEdit(baseline, { type: 'setMemberSection', memberId: 'col1R', sectionId: 'CHS88.9x5.0' }, ch))
    expect(d.members.col1R).toEqual({ sectionId: 'CHS88.9x5.0' })
    expect(d.members.col1L).toBe(baseline.members.col1L)
    expect(d.id).toBe(baseline.id)
    expect(d.materialId).toBe(baseline.materialId)
  })

  it('keeps a diagonal’s presence when resizing it', () => {
    const d = ok(applyBracedFrameEdit(baseline, { type: 'setMemberSection', memberId: 'diag1b', sectionId: 'CHS76.1x4.0' }, ch))
    expect(d.members.diag1b).toEqual({ present: true, sectionId: 'CHS76.1x4.0' })
  })

  it('rejects a section outside the catalog and an unknown member, leaving the input unchanged', () => {
    const before = structuredClone(baseline)
    const bad = applyBracedFrameEdit(baseline, { type: 'setMemberSection', memberId: 'beam1', sectionId: 'CHS114.3x6.3' }, ch)
    expect(!bad.ok && bad.error.map((e) => [e.code, e.param])).toEqual([['UNKNOWN_SECTION', 'beam1']])
    const unknown = applyBracedFrameEdit(baseline, { type: 'setMemberSection', memberId: 'beam3', sectionId: 'CHS60.3x4.0' }, ch)
    expect(!unknown.ok && unknown.error).toEqual([{ code: 'UNKNOWN_MEMBER', param: 'beam3', message: '"beam3" is not a member of this frame.' }])
    expect(baseline).toEqual(before)
  })
})
