// Feature: braced-frame-1, Property 1: Frame validation accepts exactly the configured design space
// **Validates: BFR-04, BFR-15, MM-09**
//
// Every design built from the 16 diagonal sets and the catalog sections validates with no errors
// (mechanisms included); replacing any one member's section with an id outside the catalog always
// yields exactly one UNKNOWN_SECTION error naming that member.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracedFrameDesign, bracedFrameChallenge } from '../../../test/fixtures/bracedFrame'
import { assertProperty } from '../../../test/pbt'
import { FRAME_MEMBER_IDS, isDiagonalId } from './template'
import { validateBracedFrameDesign } from './validate'

const ch = bracedFrameChallenge()
const catalogIds = ch.sections.map((s) => s.id)

describe('Property 1: frame validation', () => {
  it('valid-by-construction designs validate', () => {
    assertProperty(
      fc.property(arbBracedFrameDesign(), (d) => {
        expect(validateBracedFrameDesign(d, ch)).toEqual([])
      }),
    )
  })

  it('a section outside the catalog is rejected for exactly that member', () => {
    const arbForeign = fc.string({ minLength: 1, maxLength: 12 }).filter((s) => !catalogIds.includes(s))
    assertProperty(
      fc.property(arbBracedFrameDesign(), fc.constantFrom(...FRAME_MEMBER_IDS), arbForeign, (d, id, sectionId) => {
        const choice = isDiagonalId(id) ? { present: d.members[id].present, sectionId } : { sectionId }
        const errs = validateBracedFrameDesign({ ...d, members: { ...d.members, [id]: choice } }, ch)
        expect(errs.map((e) => [e.code, e.param])).toEqual([['UNKNOWN_SECTION', id]])
      }),
    )
  })
})
