import { z } from 'zod'
import type { Section } from '../sections'

// Torsion Shaft I design types and structural schemas (task 47.2; torsion-shaft-1 TSH-03–TSH-05).
// The shaft reuses the beam's circle and tube section shapes unchanged, so outlines and
// section names can be shared, but its limits, validation and edits are typed separately
// (geometry/torsion/validate.ts, edit.ts). The design has no orientation: a circular shaft is
// axisymmetric. Torque and support are challenge constants, so they are not design fields.

/** Section kinds a shaft may use, in palette order. */
export type TorsionSectionKind = 'circle' | 'tube'

export const TORSION_SECTION_KINDS: readonly TorsionSectionKind[] = Object.freeze(['circle', 'tube'] as const)

/** The circle and tube members of the shared Section union. */
export type TorsionSection = Extract<Section, { kind: TorsionSectionKind }>

export interface TorsionDesign {
  id: string
  section: TorsionSection
  lengthM: number
  materialId: string
}

const lengthM = z.number().finite().positive()

/**
 * Structural shape only; ranges, the minimum wall and d < D live in the validator.
 * Unlike the beam schema, the tube inner diameter may be exactly 0 (TSH-04: "inner diameter
 * from 0"), which the shared validator semantics already allow.
 */
export const torsionSectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle'), diameterM: lengthM }).strict(),
  z
    .object({ kind: z.literal('tube'), outerDiameterM: lengthM, innerDiameterM: z.number().finite().nonnegative() })
    .strict(),
])

export const torsionDesignSchema = z
  .object({
    id: z.string().min(1),
    section: torsionSectionSchema,
    lengthM,
    materialId: z.string().min(1),
  })
  .strict()

// Compile-time guarantee that the schemas and the hand-written types stay identical.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const sectionTypesMatch: Equal<z.infer<typeof torsionSectionSchema>, TorsionSection> = true
const designTypesMatch: Equal<z.infer<typeof torsionDesignSchema>, TorsionDesign> = true
void sectionTypesMatch
void designTypesMatch
