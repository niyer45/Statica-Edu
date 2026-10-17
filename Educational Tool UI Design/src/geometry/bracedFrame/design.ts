import { z } from 'zod'
import type { DiagonalId, FixedMemberId } from './template'

// Braced Frame I design types and structural schemas (task 49.2; braced-frame-1 BFR-03–BFR-05).
// A design chooses, per member, one section from the challenge's CHS catalog, and for each of
// the four candidate diagonals whether it is present. An absent diagonal keeps its section
// choice so that it is restored when re-enabled; it contributes nothing to analysis or mass.
// Every combination is a valid design, mechanisms included (MM-09). There are no continuous
// inputs. Fixed members carry no `present` key: their presence is locked by the template.

/** A fixed member's choice: only its section. */
export interface FixedMemberChoice {
  sectionId: string
}

/** A candidate diagonal's choice: presence and the (kept) section. */
export interface DiagonalChoice {
  present: boolean
  sectionId: string
}

export type BracedFrameMembers = { [K in FixedMemberId]: FixedMemberChoice } & { [K in DiagonalId]: DiagonalChoice }

export interface BracedFrameDesign {
  id: string
  materialId: string
  members: BracedFrameMembers
}

const sectionId = z.string().min(1)
const fixedChoice = z.object({ sectionId }).strict()
const diagonalChoice = z.object({ present: z.boolean(), sectionId }).strict()

/**
 * Structural shape only: every member key is required and unknown keys are rejected at every
 * level (so a `present` key on a fixed member fails here). Catalog membership of section ids
 * and the locked material are checked by the validator.
 */
export const bracedFrameMembersSchema = z
  .object({
    col1L: fixedChoice,
    col1R: fixedChoice,
    col2L: fixedChoice,
    col2R: fixedChoice,
    beam1: fixedChoice,
    beam2: fixedChoice,
    diag1a: diagonalChoice,
    diag1b: diagonalChoice,
    diag2a: diagonalChoice,
    diag2b: diagonalChoice,
  })
  .strict()

export const bracedFrameDesignSchema = z
  .object({
    id: z.string().min(1),
    materialId: z.string().min(1),
    members: bracedFrameMembersSchema,
  })
  .strict()

// Compile-time guarantee that the schemas and the hand-written types stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const membersTypesMatch: Equal<z.infer<typeof bracedFrameMembersSchema>, BracedFrameMembers> = true
const designTypesMatch: Equal<z.infer<typeof bracedFrameDesignSchema>, BracedFrameDesign> = true
void membersTypesMatch
void designTypesMatch
