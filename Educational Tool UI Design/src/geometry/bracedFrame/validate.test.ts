import { describe, expect, it } from 'vitest'
import { bracedFrameChallenge, frameDesign, worksheetFixture } from '../../../test/fixtures/bracedFrame'
import { bracedFrameDesignSchema, type BracedFrameDesign } from './design'
import {
  DIAGONAL_IDS,
  FIXED_MEMBER_IDS,
  FRAME_MEMBER_IDS,
  FRAME_MEMBER_LABELS,
  FRAME_MEMBERS,
  FRAME_STOREY_LABELS,
  frameJointCoordinates,
  isDiagonalId,
  isFrameMemberId,
  STOREY_DIAGONALS,
} from './template'
import { BRACED_FRAME_DESIGN_ERROR_CODES, isCatalogSection, validateBracedFrameDesign } from './validate'

// Braced frame template and design validation (task 49.2; BFR-03, BFR-04, BFR-15, MM-09).

const ch = bracedFrameChallenge()
const baseline = worksheetFixture('baseline').design
/** A deliberately malformed design, for totality checks over untrusted input. */
const raw = (v: unknown) => v as BracedFrameDesign
const codes = (d: unknown) => validateBracedFrameDesign(raw(d), ch).map((e) => `${e.param} ${e.code}`)
const withMember = (id: string, choice: unknown) => ({ ...baseline, members: { ...baseline.members, [id]: choice } })

describe('template oneBayTwoStorey (BFR-03)', () => {
  it('places the six joints at the worksheet coordinates', () => {
    expect(frameJointCoordinates(ch.frame)).toEqual({
      j1: { x: 0, y: 0 }, j2: { x: 4, y: 0 }, j3: { x: 0, y: 3 }, j4: { x: 4, y: 3 }, j5: { x: 0, y: 6 }, j6: { x: 4, y: 6 },
    })
  })

  it('defines the member topology and storeys in fixed order', () => {
    expect(FRAME_MEMBER_IDS).toEqual(['col1L', 'col1R', 'col2L', 'col2R', 'beam1', 'beam2', 'diag1a', 'diag1b', 'diag2a', 'diag2b'])
    expect(FRAME_MEMBER_IDS.map((id) => `${FRAME_MEMBERS[id].i}-${FRAME_MEMBERS[id].j}`)).toEqual([
      'j1-j3', 'j2-j4', 'j3-j5', 'j4-j6', 'j3-j4', 'j5-j6', 'j1-j4', 'j2-j3', 'j3-j6', 'j4-j5',
    ])
    expect(STOREY_DIAGONALS).toEqual({ 1: ['diag1a', 'diag1b'], 2: ['diag2a', 'diag2b'] })
    expect(FIXED_MEMBER_IDS.every((id) => FRAME_MEMBERS[id].kind !== 'diagonal')).toBe(true)
    expect(DIAGONAL_IDS.every((id) => FRAME_MEMBERS[id].kind === 'diagonal')).toBe(true)
  })

  it('labels contain no digits, so grounded facts may quote them', () => {
    for (const label of [...Object.values(FRAME_MEMBER_LABELS), ...Object.values(FRAME_STOREY_LABELS)]) expect(label).not.toMatch(/\d/)
  })

  it('recognizes member and diagonal ids', () => {
    expect(isFrameMemberId('beam2')).toBe(true)
    expect(isFrameMemberId('beam3')).toBe(false)
    expect(isFrameMemberId(7)).toBe(false)
    expect(isDiagonalId('diag2b')).toBe(true)
    expect(isDiagonalId('col1L')).toBe(false)
    expect(isCatalogSection(ch.sections, 'CHS60.3x4.0')).toBe(true)
    expect(isCatalogSection(ch.sections, 60)).toBe(false)
  })
})

describe('validateBracedFrameDesign', () => {
  it('accepts every diagonal combination, mechanisms included (BFR-04)', () => {
    for (let k = 0; k < 16; k++) {
      const ids = DIAGONAL_IDS.filter((_, i) => (k >> i) & 1)
      const d = frameDesign('d', [48, 60, 76, 89, 48, 60], Object.fromEntries(ids.map((id) => [id, 89])))
      expect(validateBracedFrameDesign(d, ch)).toEqual([])
    }
  })

  it('lists every error code once in the exported table', () => {
    expect(BRACED_FRAME_DESIGN_ERROR_CODES).toEqual(['MISSING_MEMBER', 'UNKNOWN_MEMBER', 'BAD_MEMBER', 'PRESENT_ON_FIXED_MEMBER', 'BAD_PRESENT', 'UNKNOWN_SECTION', 'LOCKED_FIELD_CHANGED'])
  })

  it('rejects an unknown section id, naming the member', () => {
    const errs = validateBracedFrameDesign(raw(withMember('col1R', { sectionId: 'CHS114.3x6.3' })), ch)
    expect(errs).toEqual([
      {
        code: 'UNKNOWN_SECTION',
        param: 'col1R',
        message: `Lower right column (col1R) uses section "CHS114.3x6.3", which is not in this challenge's catalog (CHS48.3x3.2, CHS60.3x4.0, CHS76.1x4.0, CHS88.9x5.0).`,
      },
    ])
  })

  it('rejects missing and unknown members, a present key on a fixed member and a non-boolean present', () => {
    const { beam2: _omit, ...rest } = baseline.members
    void _omit
    expect(codes({ ...baseline, members: rest })).toEqual(['beam2 MISSING_MEMBER'])
    expect(codes({ ...baseline, members: { ...baseline.members, diag3a: { present: true, sectionId: 'CHS60.3x4.0' } } })).toEqual(['diag3a UNKNOWN_MEMBER'])
    expect(codes(withMember('col1L', { present: true, sectionId: 'CHS60.3x4.0' }))).toEqual(['col1L PRESENT_ON_FIXED_MEMBER'])
    expect(codes(withMember('diag1a', { present: 'yes', sectionId: 'CHS60.3x4.0' }))).toEqual(['diag1a BAD_PRESENT'])
    expect(codes(withMember('diag1a', { sectionId: 'CHS60.3x4.0' }))).toEqual(['diag1a BAD_PRESENT'])
  })

  it('rejects malformed choices with BAD_MEMBER', () => {
    expect(codes(withMember('beam1', 'CHS60.3x4.0'))).toEqual(['beam1 BAD_MEMBER'])
    expect(codes(withMember('beam1', null))).toEqual(['beam1 BAD_MEMBER'])
    expect(codes(withMember('diag2a', { present: true, sectionId: 'CHS60.3x4.0', lengthM: 5 }))).toEqual(['diag2a BAD_MEMBER'])
  })

  it('rejects a changed material as a locked field', () => {
    const errs = validateBracedFrameDesign({ ...baseline, materialId: 'aluminium' }, ch)
    expect(errs.map((e) => e.code)).toEqual(['LOCKED_FIELD_CHANGED'])
    expect(errs[0].message).toBe('Material is fixed by the challenge and cannot be changed (expected "steel-educational", got "aluminium").')
  })

  it('is total over untrusted input and reports in the documented order', () => {
    expect(codes(null)).toEqual([...FRAME_MEMBER_IDS.map((id) => `${id} MISSING_MEMBER`), 'materialId LOCKED_FIELD_CHANGED'])
    expect(codes({ ...baseline, members: [] })).toEqual(FRAME_MEMBER_IDS.map((id) => `${id} MISSING_MEMBER`))
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const errs = validateBracedFrameDesign(raw(withMember('diag1b', { present: cyclic, sectionId: 'x' })), ch)
    expect(errs.map((e) => e.code)).toEqual(['BAD_PRESENT', 'UNKNOWN_SECTION'])
    expect(errs[0].message).toContain('got object')
    const mixed = { materialId: 'x', members: { ...baseline.members, col2L: { present: false, sectionId: 'nope' }, zzz: 1 } }
    expect(codes(mixed)).toEqual(['col2L PRESENT_ON_FIXED_MEMBER', 'col2L UNKNOWN_SECTION', 'zzz UNKNOWN_MEMBER', 'materialId LOCKED_FIELD_CHANGED'])
  })

  it('never mutates its input', () => {
    const d = structuredClone(baseline)
    const before = structuredClone(d)
    validateBracedFrameDesign(d, ch)
    expect(d).toEqual(before)
  })
})

describe('bracedFrameDesignSchema', () => {
  it('accepts a full design and rejects a present key on a fixed member structurally', () => {
    expect(bracedFrameDesignSchema.safeParse(baseline).success).toBe(true)
    expect(bracedFrameDesignSchema.safeParse(withMember('col1L', { present: true, sectionId: 'CHS60.3x4.0' })).success).toBe(false)
    expect(bracedFrameDesignSchema.safeParse({ ...baseline, extra: 1 }).success).toBe(false)
  })
})
