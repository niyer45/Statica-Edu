import { z } from 'zod'

// Column Buckling I design types and structural schemas (task 68; column-buckling-1 CBK-04–CBK-06).
// The column is a solid round bar or a round tube. A tube is described by its outer diameter and
// wall thickness (students reason about walls more easily than about bores), so these sections
// are typed separately from the beam's shared Section union, whose tube uses an inner diameter.
// The length and material are locked design fields; the load and the pinned ends are challenge
// constants, so they are not design fields. There is no orientation: a round column is the same
// about every axis.

/** Section kinds a column may use, in palette order. */
export type ColumnSectionKind = 'solid' | 'tube'

export const COLUMN_SECTION_KINDS: readonly ColumnSectionKind[] = Object.freeze(['solid', 'tube'] as const)

export type ColumnSection =
  | { kind: 'solid'; diameterM: number }
  | { kind: 'tube'; outerDiameterM: number; wallThicknessM: number }

export interface ColumnDesign {
  id: string
  section: ColumnSection
  lengthM: number
  materialId: string
}

const lengthM = z.number().finite().positive()

/** Structural shape only; ranges live in the validator (geometry/column/validate.ts). */
export const columnSectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('solid'), diameterM: lengthM }).strict(),
  z.object({ kind: z.literal('tube'), outerDiameterM: lengthM, wallThicknessM: lengthM }).strict(),
])

export const columnDesignSchema = z
  .object({
    id: z.string().min(1),
    section: columnSectionSchema,
    lengthM,
    materialId: z.string().min(1),
  })
  .strict()

/** Outer diameter of a column section, m. */
export function columnOuterDiameterM(s: Readonly<ColumnSection>): number {
  return s.kind === 'solid' ? s.diameterM : s.outerDiameterM
}

/** Inner (bore) diameter of a column section, m; 0 for a solid bar. */
export function columnInnerDiameterM(s: Readonly<ColumnSection>): number {
  return s.kind === 'solid' ? 0 : s.outerDiameterM - 2 * s.wallThicknessM
}

// Compile-time guarantee that the schemas and the hand-written types stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const sectionTypesMatch: Equal<z.infer<typeof columnSectionSchema>, ColumnSection> = true
const designTypesMatch: Equal<z.infer<typeof columnDesignSchema>, ColumnDesign> = true
void sectionTypesMatch
void designTypesMatch
