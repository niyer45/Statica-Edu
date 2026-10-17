import type { BracedFrameChallenge, ChsSection } from '../../challenge/bracedFrame/types'
import type { BracedFrameDesign } from './design'
import { FRAME_MEMBER_IDS, FRAME_MEMBER_LABELS, isDiagonalId, isFrameMemberId, type FrameMemberId } from './template'

// Braced frame design validator (task 49.2; BFR-04, BFR-15, MM-09). Pure: never mutates or
// throws. Total over untrusted input: anything that is not an object reads as an empty object,
// so every member is reported missing. Every diagonal combination is valid; a mechanism is not an
// invalid design (BFR-04). There are no continuous inputs, so no ranges or tolerances apply.
//
// Error order (deterministic):
//   1. Per member, in FRAME_MEMBER_IDS order, at most one structural error:
//        MISSING_MEMBER  the member key is absent
//        BAD_MEMBER      the choice is not an object, or has a key other than sectionId/present
//      then, for an object choice, in this order:
//        PRESENT_ON_FIXED_MEMBER  a fixed member carries a `present` key (presence is locked)
//        BAD_PRESENT              a diagonal's `present` is not a boolean
//        UNKNOWN_SECTION          sectionId is not an id of the challenge's section catalog
//   2. UNKNOWN_MEMBER for each key of `members` outside the template, in key order
//   3. LOCKED_FIELD_CHANGED for materialId (strict equality with the initial design)

export type BracedFrameDesignErrorCode =
  | 'MISSING_MEMBER'
  | 'UNKNOWN_MEMBER'
  | 'BAD_MEMBER'
  | 'PRESENT_ON_FIXED_MEMBER'
  | 'BAD_PRESENT'
  | 'UNKNOWN_SECTION'
  | 'LOCKED_FIELD_CHANGED'

/** Every code the validator and edits can produce (persistence error tables use this list). */
export const BRACED_FRAME_DESIGN_ERROR_CODES: readonly [BracedFrameDesignErrorCode, ...BracedFrameDesignErrorCode[]] = Object.freeze([
  'MISSING_MEMBER',
  'UNKNOWN_MEMBER',
  'BAD_MEMBER',
  'PRESENT_ON_FIXED_MEMBER',
  'BAD_PRESENT',
  'UNKNOWN_SECTION',
  'LOCKED_FIELD_CHANGED',
] as const) as unknown as readonly [BracedFrameDesignErrorCode, ...BracedFrameDesignErrorCode[]]

export interface BracedFrameDesignError {
  code: BracedFrameDesignErrorCode
  /** The member id, or `materialId`. */
  param?: string
  message: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function describe(v: unknown): string {
  if (v === undefined) return 'missing'
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return typeof v
  }
}

const CHOICE_KEYS: ReadonlySet<string> = new Set(['sectionId', 'present'])

/** The challenge fields validateBracedFrameDesign reads. */
export type BracedFrameValidationContext = Pick<BracedFrameChallenge, 'initialDesign' | 'sections'>

/** Whether `id` names a section of the catalog. */
export function isCatalogSection(sections: readonly ChsSection[], id: unknown): boolean {
  return typeof id === 'string' && sections.some((s) => s.id === id)
}

function label(id: FrameMemberId): string {
  const name = FRAME_MEMBER_LABELS[id]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Errors for one member choice (step 1 of the header order). */
function memberErrors(id: FrameMemberId, choice: unknown, sections: readonly ChsSection[]): BracedFrameDesignError[] {
  if (choice === undefined) {
    return [{ code: 'MISSING_MEMBER', param: id, message: `${label(id)} (${id}) is missing from the design.` }]
  }
  if (!isRecord(choice)) {
    return [{ code: 'BAD_MEMBER', param: id, message: `${label(id)} (${id}) must be an object (got ${describe(choice)}).` }]
  }
  const extra = Object.keys(choice).find((k) => !CHOICE_KEYS.has(k))
  if (extra !== undefined) {
    return [{ code: 'BAD_MEMBER', param: id, message: `${label(id)} (${id}) has an unexpected field "${extra}".` }]
  }
  const errors: BracedFrameDesignError[] = []
  const diagonal = isDiagonalId(id)
  if (!diagonal && Object.prototype.hasOwnProperty.call(choice, 'present')) {
    errors.push({
      code: 'PRESENT_ON_FIXED_MEMBER',
      param: id,
      message: `${label(id)} (${id}) is always present; only diagonals can be added or removed.`,
    })
  }
  if (diagonal && typeof choice.present !== 'boolean') {
    errors.push({ code: 'BAD_PRESENT', param: id, message: `${label(id)} (${id}) must say whether it is present (true or false; got ${describe(choice.present)}).` })
  }
  if (!isCatalogSection(sections, choice.sectionId)) {
    const list = sections.map((s) => s.id).join(', ')
    errors.push({
      code: 'UNKNOWN_SECTION',
      param: id,
      message: `${label(id)} (${id}) uses section ${describe(choice.sectionId)}, which is not in this challenge's catalog (${list}).`,
    })
  }
  return errors
}

/** Validates a full braced-frame design against a challenge. See the header for rule order. */
export function validateBracedFrameDesign(d: BracedFrameDesign, ch: BracedFrameValidationContext): BracedFrameDesignError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const members: Record<string, unknown> = isRecord(design.members) ? design.members : {}
  const errors: BracedFrameDesignError[] = []

  for (const id of FRAME_MEMBER_IDS) {
    const choice = Object.prototype.hasOwnProperty.call(members, id) ? members[id] : undefined
    errors.push(...memberErrors(id, choice, ch.sections))
  }
  for (const key of Object.keys(members)) {
    if (!isFrameMemberId(key)) {
      errors.push({ code: 'UNKNOWN_MEMBER', param: key, message: `"${key}" is not a member of this frame.` })
    }
  }

  const expected = ch.initialDesign.materialId
  if (design.materialId !== expected) {
    errors.push({
      code: 'LOCKED_FIELD_CHANGED',
      param: 'materialId',
      message: `Material is fixed by the challenge and cannot be changed (expected ${describe(expected)}, got ${describe(design.materialId)}).`,
    })
  }
  return errors
}
